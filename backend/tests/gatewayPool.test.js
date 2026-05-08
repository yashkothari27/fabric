'use strict';

// ── Mock external modules before requiring gatewayPool ────────────────────────

// Each call to connect() returns a fresh mock so we can track individual
// gateway.close() calls across multiple open slots.
function makeMockGateway() {
  return {
    getNetwork: jest.fn().mockReturnValue({
      getContract: jest.fn().mockReturnValue({ evaluateTransaction: jest.fn() }),
    }),
    close: jest.fn(),
  };
}

const mockConnect = jest.fn(() => makeMockGateway());

jest.mock('@hyperledger/fabric-gateway', () => ({
  connect:  mockConnect,
  signers:  { newPrivateKeySigner: jest.fn(() => 'mock-signer') },
  hash:     { sha256: 'mock-hash' },
}));

// Mock gRPC client with channel state support
const mockChannel = {
  getConnectivityState:   jest.fn(() => 4), // 4 = SHUTDOWN (forces rebuild)
  watchConnectivityState: jest.fn(),
};
const mockGrpcClient = {
  close:      jest.fn(),
  getChannel: jest.fn(() => mockChannel),
};

jest.mock('@grpc/grpc-js', () => ({
  Client:      jest.fn(() => mockGrpcClient),
  credentials: { createSsl: jest.fn(() => 'mock-tls') },
  connectivityState: {
    IDLE:               0,
    CONNECTING:         1,
    READY:              2,
    TRANSIENT_FAILURE:  3,
    SHUTDOWN:           4,
  },
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn(() => Buffer.from('fake-cert')),
}));

// ── Load module under test ────────────────────────────────────────────────────

const { GatewayPool } = require('../src/gatewayPool');
const crypto = require('crypto');

// ── Shared fixtures ───────────────────────────────────────────────────────────

const { privateKey: baseKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const keyPem  = baseKey.export({ type: 'pkcs8', format: 'pem' });
const certPem = Buffer.from('FAKE_CERT_PEM');

function makeSession() {
  return { mspId: 'Org1MSP', certPem, keyPem };
}

function makeUniqueSession() {
  const { privateKey: pk } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return {
    mspId:   'Org1MSP',
    certPem: crypto.randomBytes(32),
    keyPem:  pk.export({ type: 'pkcs8', format: 'pem' }),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GatewayPool', () => {
  let pool;

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: channel is READY so getSharedClient() reuses without rebuild
    mockChannel.getConnectivityState.mockReturnValue(2); // READY
    pool = new GatewayPool({ idleTimeoutMs: 10_000 });
  });

  afterEach(() => {
    pool.closeAll();
  });

  // ── acquire ────────────────────────────────────────────────────────────────

  test('acquire opens a new gateway and returns a contract', async () => {
    const session = makeSession();
    const result  = await pool.acquire(session);

    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(result.contract).toBeDefined();
    expect(pool.size).toBe(1);
  });

  test('acquire reuses the same gateway for the same identity', async () => {
    const session = makeSession();
    await pool.acquire(session);
    await pool.acquire(session);

    expect(mockConnect).toHaveBeenCalledTimes(1); // only one gateway opened
    expect(pool.size).toBe(1);
  });

  test('acquire opens separate gateways for different identities', async () => {
    const { privateKey: pk2 } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const s1 = { mspId: 'Org1MSP', certPem,                      keyPem };
    const s2 = { mspId: 'Org2MSP', certPem: Buffer.from('CERT2'), keyPem: pk2.export({ type: 'pkcs8', format: 'pem' }) };

    await pool.acquire(s1);
    await pool.acquire(s2);

    expect(mockConnect).toHaveBeenCalledTimes(2);
    expect(pool.size).toBe(2);
  });

  // ── release ────────────────────────────────────────────────────────────────

  test('release decrements refCount but keeps the gateway alive', async () => {
    const session = makeSession();
    await pool.acquire(session);
    pool.release(session);

    expect(pool.size).toBe(1); // still in pool, timer armed
  });

  test('double acquire requires double release before idle timer arms', async () => {
    const session = makeSession();
    await pool.acquire(session); // refCount → 1
    await pool.acquire(session); // refCount → 2

    pool.release(session);       // refCount → 1
    expect(pool.size).toBe(1);

    pool.release(session);       // refCount → 0, eviction timer armed
    expect(pool.size).toBe(1);   // still open until timer fires
  });

  // ── evict ──────────────────────────────────────────────────────────────────

  test('evict closes and removes the gateway immediately', async () => {
    const session = makeSession();
    const { gateway } = await pool.acquire(session);

    pool.evict(session);

    expect(pool.size).toBe(0);
    expect(gateway.close).toHaveBeenCalledTimes(1);
  });

  test('evict on an unknown session is a no-op', () => {
    expect(() => pool.evict(makeSession())).not.toThrow();
  });

  // ── closeAll ───────────────────────────────────────────────────────────────

  test('closeAll closes every open gateway and empties the pool', async () => {
    const s1 = makeUniqueSession();
    const s2 = makeUniqueSession();

    const r1 = await pool.acquire(s1);
    const r2 = await pool.acquire(s2);

    pool.closeAll();

    expect(pool.size).toBe(0);
    expect(r1.gateway.close).toHaveBeenCalledTimes(1);
    expect(r2.gateway.close).toHaveBeenCalledTimes(1);
  });

  // ── cap enforcement ────────────────────────────────────────────────────────

  test('evicts the oldest idle slot when maxConnections is reached', async () => {
    pool = new GatewayPool({ maxConnections: 2, idleTimeoutMs: 10_000 });

    const s1 = makeUniqueSession();
    const s2 = makeUniqueSession();
    const s3 = makeUniqueSession();

    const r1 = await pool.acquire(s1);
    pool.release(s1); // idle — eligible for eviction

    await pool.acquire(s2);
    pool.release(s2); // idle

    await pool.acquire(s3); // pool full → s1 evicted (oldest idle)

    expect(pool.size).toBe(2);           // s2 + s3
    expect(r1.gateway.close).toHaveBeenCalledTimes(1); // s1 was closed
  });

  test('throws when all slots are active and cap is reached', async () => {
    pool = new GatewayPool({ maxConnections: 1, idleTimeoutMs: 10_000 });

    const s1 = makeUniqueSession();
    const s2 = makeUniqueSession();

    await pool.acquire(s1); // refCount > 0 — cannot be evicted

    await expect(pool.acquire(s2)).rejects.toThrow(/exhausted/);
  });

  // ── _rebuildAll (automatic reconnect after channel drop) ───────────────────

  test('_rebuildAll reopens gateways for active sessions and drops idle ones', async () => {
    const activeSession = makeUniqueSession();
    const idleSession   = makeUniqueSession();

    const { gateway: activeGw } = await pool.acquire(activeSession); // refCount = 1 (active)
    const { gateway: idleGw }   = await pool.acquire(idleSession);
    pool.release(idleSession);                                         // refCount = 0 (idle)

    expect(pool.size).toBe(2);

    pool._rebuildAll();

    // Idle slot was dropped; active slot was reopened (new gateway created)
    expect(pool.size).toBe(1);
    expect(idleGw.close).toHaveBeenCalledTimes(1);   // idle gateway closed
    expect(activeGw.close).toHaveBeenCalledTimes(1); // old active gateway closed
    expect(mockConnect).toHaveBeenCalledTimes(3);    // 2 original + 1 reopen
  });

  test('_rebuildAll drops a slot if reopening fails', async () => {
    const session = makeUniqueSession();
    await pool.acquire(session); // refCount = 1

    // Make the next connect() call throw
    mockConnect.mockImplementationOnce(() => { throw new Error('peer unreachable'); });

    pool._rebuildAll();

    // Slot removed because reopen failed
    expect(pool.size).toBe(0);
  });
});
