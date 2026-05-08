'use strict';

const grpc   = require('@grpc/grpc-js');
const { connect, signers, hash } = require('@hyperledger/fabric-gateway');
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

// ── gRPC client ───────────────────────────────────────────────────────────────
//
// One TLS-secured gRPC connection to the peer, shared by every gateway in the
// pool.  Built lazily on first use, and rebuilt automatically if the channel
// enters SHUTDOWN (peer restart, network blip, etc.).

let sharedClient      = null;
let reconnectTimer    = null;
const RECONNECT_MS    = 5_000;   // wait before retrying after a drop

function tlsCertPath() {
  return process.env.FABRIC_TLS_CERT_PATH
    ? path.resolve(process.env.FABRIC_TLS_CERT_PATH)
    : path.resolve(__dirname, '../../crypto/org1/peer/tls/ca.crt');
}

function buildGrpcClient() {
  const tlsRootCert   = fs.readFileSync(tlsCertPath());
  const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);

  return new grpc.Client(
    process.env.FABRIC_PEER_ENDPOINT  || 'localhost:7051',
    tlsCredentials,
    {
      // Allow TLS hostname to differ from DNS name (common in test networks)
      'grpc.ssl_target_name_override':    process.env.FABRIC_PEER_HOST_ALIAS || 'peer0.org1.example.com',
      // Keep the HTTP/2 connection alive even when idle
      'grpc.keepalive_time_ms':           120_000,
      'grpc.keepalive_timeout_ms':         20_000,
      'grpc.keepalive_permit_without_calls': 1,
      'grpc.http2.max_pings_without_data':   0,
      // Reconnect backoff — gRPC will retry internally on transient failures
      'grpc.initial_reconnect_backoff_ms':  1_000,
      'grpc.max_reconnect_backoff_ms':     30_000,
    }
  );
}

/**
 * Returns the shared gRPC client, rebuilding it if the channel has shut down.
 * A SHUTDOWN state means the client is permanently broken and must be replaced.
 */
function getSharedClient() {
  if (sharedClient) {
    const state = sharedClient.getChannel().getConnectivityState(false);
    if (state === grpc.connectivityState.SHUTDOWN) {
      console.warn('[GatewayPool] gRPC client shut down — rebuilding');
      sharedClient = null;
    }
  }
  if (!sharedClient) {
    sharedClient = buildGrpcClient();
    watchChannelState(sharedClient);
  }
  return sharedClient;
}

/**
 * Watches the gRPC channel for state transitions.
 * When the channel enters TRANSIENT_FAILURE or SHUTDOWN while the pool has open
 * gateways, we schedule a pool-wide reconnect so stale gateways are replaced.
 */
function watchChannelState(client) {
  const channel = client.getChannel();

  function subscribe(currentState) {
    channel.watchConnectivityState(currentState, Date.now() + 60_000, (err) => {
      if (err) return; // deadline expired — resubscribe

      const newState = channel.getConnectivityState(false);

      if (
        newState === grpc.connectivityState.TRANSIENT_FAILURE ||
        newState === grpc.connectivityState.SHUTDOWN
      ) {
        console.warn(`[GatewayPool] gRPC channel entered ${connectivityStateName(newState)} — scheduling reconnect`);
        schedulePoolReconnect();
      }

      // Keep watching as long as this client is the active one
      if (sharedClient === client) {
        subscribe(newState);
      }
    });
  }

  subscribe(channel.getConnectivityState(false));
}

function connectivityStateName(state) {
  return (
    ['IDLE', 'CONNECTING', 'READY', 'TRANSIENT_FAILURE', 'SHUTDOWN'][state] ?? state
  );
}

/**
 * Schedules a pool-wide reconnect after RECONNECT_MS.
 * Debounced so rapid state flaps don't trigger multiple rebuilds.
 */
function schedulePoolReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    pool._rebuildAll();
  }, RECONNECT_MS);
}

// ── GatewayPool ───────────────────────────────────────────────────────────────
//
// Maintains one open Gateway per user identity (keyed by MSP ID + cert
// fingerprint).  A gateway wraps the shared gRPC client with a specific X.509
// identity and signer, giving each user their own signed blockchain sessions.
//
// Lifecycle per slot:
//   acquire()  →  refCount++, eviction timer paused
//   release()  →  refCount--, eviction timer armed (idleTimeoutMs)
//   [idle]     →  timer fires, gateway.close(), slot removed
//   evict()    →  immediate close + removal (used on logout)
//
// Usage:
//   const { contract } = await pool.acquire(session);
//   try {
//     const bytes = await contract.evaluateTransaction('ReadCTI', id);
//   } finally {
//     pool.release(session);
//   }

class GatewayPool {
  /**
   * @param {object}  opts
   * @param {number}  opts.maxConnections   Hard cap on open gateways      (default 20)
   * @param {number}  opts.idleTimeoutMs    ms before an idle slot closes  (default 5 min)
   * @param {string}  opts.channel          Fabric channel name
   * @param {string}  opts.chaincode        Chaincode / smart-contract name
   */
  constructor(opts = {}) {
    this.maxConnections = opts.maxConnections ?? 20;
    this.idleTimeoutMs  = opts.idleTimeoutMs  ?? 5 * 60_000;
    this.channel        = opts.channel   ?? process.env.FABRIC_DEFAULT_CHANNEL ?? 'mychannel';
    this.chaincode      = opts.chaincode ?? process.env.FABRIC_CHAINCODE_NAME  ?? 'cti';

    // Map<slotKey, { gateway, network, contract, timer, refCount, session }>
    this._slots = new Map();
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  _slotKey(session) {
    const certBuf = Buffer.isBuffer(session.certPem)
      ? session.certPem
      : Buffer.from(session.certPem);
    const fingerprint = crypto
      .createHash('sha256')
      .update(certBuf)
      .digest('hex')
      .slice(0, 16);
    return `${session.mspId}::${fingerprint}`;
  }

  _openGateway(session) {
    const certPem = Buffer.isBuffer(session.certPem)
      ? session.certPem
      : Buffer.from(session.certPem);
    const keyPem = Buffer.isBuffer(session.keyPem)
      ? session.keyPem
      : Buffer.from(session.keyPem);

    const privateKey = crypto.createPrivateKey(keyPem);
    const signer     = signers.newPrivateKeySigner(privateKey);

    const gateway = connect({
      client:   getSharedClient(),
      identity: { mspId: session.mspId, credentials: certPem },
      signer,
      hash:     hash.sha256,
      // Per-call deadlines — adjust to match your network's expected latency
      evaluateOptions:     () => ({ deadline: Date.now() +  5_000 }),
      endorseOptions:      () => ({ deadline: Date.now() + 15_000 }),
      submitOptions:       () => ({ deadline: Date.now() +  5_000 }),
      commitStatusOptions: () => ({ deadline: Date.now() + 60_000 }),
    });

    const network  = gateway.getNetwork(this.channel);
    const contract = network.getContract(this.chaincode);

    return { gateway, network, contract };
  }

  _armEviction(key) {
    const slot = this._slots.get(key);
    if (!slot) return;

    clearTimeout(slot.timer);
    slot.timer = setTimeout(() => {
      const s = this._slots.get(key);
      if (s && s.refCount === 0) {
        s.gateway.close();
        this._slots.delete(key);
      }
    }, this.idleTimeoutMs);
  }

  _evictOldestIdle() {
    for (const [k, s] of this._slots) {
      if (s.refCount === 0) {
        clearTimeout(s.timer);
        s.gateway.close();
        this._slots.delete(k);
        return true;
      }
    }
    return false;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Borrow a { gateway, network, contract } for the given session.
   * Reuses the existing open gateway if this user already has one.
   * Always call release() in a finally block when done.
   *
   * @param {{ certPem: string|Buffer, keyPem: string|Buffer, mspId: string }} session
   */
  async acquire(session) {
    const key = this._slotKey(session);

    if (this._slots.has(key)) {
      const slot = this._slots.get(key);
      slot.refCount++;
      clearTimeout(slot.timer);
      return { gateway: slot.gateway, network: slot.network, contract: slot.contract };
    }

    // Enforce the connection cap — evict the oldest idle slot if needed
    if (this._slots.size >= this.maxConnections) {
      const evicted = this._evictOldestIdle();
      if (!evicted) {
        throw new Error(
          `GatewayPool exhausted: ${this.maxConnections} connections are all active`
        );
      }
    }

    const { gateway, network, contract } = this._openGateway(session);
    this._slots.set(key, { gateway, network, contract, timer: null, refCount: 1, session });

    return { gateway, network, contract };
  }

  /**
   * Return a borrowed gateway back to the pool.
   * The gateway stays open until the idle timer fires.
   *
   * @param {{ certPem: string|Buffer, mspId: string }} session
   */
  release(session) {
    const key  = this._slotKey(session);
    const slot = this._slots.get(key);
    if (!slot) return;

    slot.refCount = Math.max(0, slot.refCount - 1);
    if (slot.refCount === 0) {
      this._armEviction(key);
    }
  }

  /**
   * Immediately close and remove a user's gateway.
   * Call this on logout so stale credentials are never reused.
   *
   * @param {{ certPem: string|Buffer, mspId: string }} session
   */
  evict(session) {
    const key  = this._slotKey(session);
    const slot = this._slots.get(key);
    if (!slot) return;
    clearTimeout(slot.timer);
    slot.gateway.close();
    this._slots.delete(key);
  }

  /**
   * Rebuild all open gateways against the new shared gRPC client.
   * Called automatically when the channel drops (TRANSIENT_FAILURE / SHUTDOWN).
   * Active slots (refCount > 0) are reopened immediately; idle slots are dropped.
   */
  _rebuildAll() {
    console.log(`[GatewayPool] Rebuilding ${this._slots.size} gateway(s) after channel drop`);

    // Force a fresh gRPC client on the next acquire
    if (sharedClient) {
      try { sharedClient.close(); } catch {}
      sharedClient = null;
    }

    for (const [key, slot] of this._slots) {
      clearTimeout(slot.timer);
      try { slot.gateway.close(); } catch {}

      if (slot.refCount > 0) {
        // Session is mid-flight — reopen immediately so the in-progress
        // request can be retried by the caller
        try {
          const { gateway, network, contract } = this._openGateway(slot.session);
          slot.gateway  = gateway;
          slot.network  = network;
          slot.contract = contract;
        } catch (err) {
          console.error(`[GatewayPool] Failed to reopen gateway for ${key}:`, err.message);
          this._slots.delete(key);
        }
      } else {
        // Idle — just drop it; next acquire() will reopen
        this._slots.delete(key);
      }
    }
  }

  /**
   * Close every gateway and the shared gRPC client.
   * Call during graceful process shutdown (SIGTERM / SIGINT).
   */
  closeAll() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    for (const [, slot] of this._slots) {
      clearTimeout(slot.timer);
      try { slot.gateway.close(); } catch {}
    }
    this._slots.clear();
    if (sharedClient) {
      try { sharedClient.close(); } catch {}
      sharedClient = null;
    }
  }

  /** Number of currently open gateway slots. */
  get size() { return this._slots.size; }
}

// Singleton — imported by routes so all requests share one pool
const pool = new GatewayPool();

module.exports = { GatewayPool, pool };
