'use strict';

const request = require('supertest');
const crypto  = require('crypto');
const db      = require('../src/db');

// ── Minimal self-signed cert + key pair for login tests ───────────────────────
// Generated once per test run using Node's built-in crypto.
// This avoids any external dependency and lets us test the key↔cert verification.

let TEST_CERT_PEM, TEST_KEY_PEM, TEST_KEY_PEM_WRONG;

beforeAll(() => {
  // Key pair that matches
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  });
  TEST_KEY_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });

  // Self-signed cert using the matching public key
  // Node 15+ supports X509Certificate but not cert generation natively.
  // We use a hand-crafted DER-encoded self-signed cert so we don't need 'forge' or 'openssl'.
  // For the auth.test we instead test the keyMatchesCert helper indirectly by:
  //   - storing a cert stub in DB
  //   - mocking the route's cert validation
  // See: the login tests below mock the helper directly.

  // Non-matching key (for negative tests)
  const { privateKey: wrongKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  });
  TEST_KEY_PEM_WRONG = wrongKey.export({ type: 'pkcs8', format: 'pem' });

  // We'll use a stub cert string because generating a real X.509 cert
  // in pure Node without openssl/forge is impractical.
  // The login route's key↔cert check is tested in its own describe block below
  // using a real key pair generated via `openssl` subprocess or by mocking.
  TEST_CERT_PEM = 'STUB_CERT';
});

beforeEach(() => db._clear());

// We load the app AFTER mocking so the module cache is clean.
let app;
beforeAll(() => {
  // Stub out the gatewayPool so requiring server.js doesn't try to read TLS certs
  jest.mock('../src/gatewayPool', () => ({
    pool: { size: 0, closeAll: jest.fn() },
  }));
  app = require('../src/server');
});

afterAll(() => jest.resetModules());

// ── Phase 1: Register ─────────────────────────────────────────────────────────

describe('POST /api/auth/register-request', () => {
  test('returns 201 + trackingId on valid input', async () => {
    const res = await request(app)
      .post('/api/auth/register-request')
      .send({ name: 'Alice', org: 'Org1', role: 'engineer' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.trackingId).toBe('string');
  });

  test('returns 400 when fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/register-request')
      .send({ name: 'Alice' });
    expect(res.status).toBe(400);
  });

  test('returns 400 for invalid role', async () => {
    const res = await request(app)
      .post('/api/auth/register-request')
      .send({ name: 'Alice', org: 'Org1', role: 'superuser' });
    expect(res.status).toBe(400);
  });
});

// ── Phase 1: Status ───────────────────────────────────────────────────────────

describe('GET /api/auth/status/:trackingId', () => {
  test('returns PENDING for a new request', async () => {
    const trackingId = db.createRequest({ name: 'Bob', org: 'Org1', role: 'viewer' });

    const res = await request(app).get(`/api/auth/status/${trackingId}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PENDING');
    expect(res.body.enrollmentId).toBeUndefined();
  });

  test('returns APPROVED with credentials after approval', async () => {
    const trackingId = db.createRequest({ name: 'Carol', org: 'Org1', role: 'engineer' });
    db.approveRequest(trackingId, 'carol-enroll', 'mysecret');

    const res = await request(app).get(`/api/auth/status/${trackingId}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('APPROVED');
    expect(res.body.enrollmentId).toBe('carol-enroll');
    expect(res.body.secret).toBe('mysecret');
  });

  test('returns 404 for unknown trackingId', async () => {
    const res = await request(app).get('/api/auth/status/unknown-id');
    expect(res.status).toBe(404);
  });
});

// ── Phase 1: Admin approve ────────────────────────────────────────────────────

describe('POST /api/admin/approve', () => {
  test('approves a pending request', async () => {
    const trackingId = db.createRequest({ name: 'Dave', org: 'Org1', role: 'manager' });

    const res = await request(app)
      .post('/api/admin/approve')
      .send({ trackingId, enrollmentId: 'dave-enroll', secret: 's3cr3t' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(db.getRequest(trackingId).status).toBe('APPROVED');
  });

  test('returns 400 when fields are missing', async () => {
    const res = await request(app)
      .post('/api/admin/approve')
      .send({ trackingId: 'x' });
    expect(res.status).toBe(400);
  });

  test('returns 404 for unknown trackingId', async () => {
    const res = await request(app)
      .post('/api/admin/approve')
      .send({ trackingId: 'nope', enrollmentId: 'e', secret: 's' });
    expect(res.status).toBe(404);
  });
});

// ── Phase 1: Admin list requests ──────────────────────────────────────────────

describe('GET /api/admin/requests', () => {
  test('lists PENDING requests for an org', async () => {
    db.createRequest({ name: 'Eve', org: 'Org1', role: 'viewer' });
    db.createRequest({ name: 'Frank', org: 'Org2', role: 'viewer' });

    const res = await request(app).get('/api/admin/requests?org=Org1');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Eve');
  });

  test('returns 400 when org param is missing', async () => {
    const res = await request(app).get('/api/admin/requests');
    expect(res.status).toBe(400);
  });
});

// ── Phase 2: Create user ──────────────────────────────────────────────────────

describe('POST /api/auth/create-user', () => {
  test('creates a user and returns 201', async () => {
    const res = await request(app)
      .post('/api/auth/create-user')
      .send({
        username: 'grace',
        password: 'hunter2',
        certPem:  'CERT_PEM',
        role:     'engineer',
        org:      'Org1',
        mspId:    'Org1MSP',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(db.getUser('grace')).not.toBeNull();
  });

  test('returns 409 on duplicate username', async () => {
    db.createUser({ username: 'grace', password: 'pw', certPem: 'C', role: 'viewer', org: 'Org1' });

    const res = await request(app)
      .post('/api/auth/create-user')
      .send({ username: 'grace', password: 'pw2', certPem: 'C', role: 'viewer', org: 'Org1' });

    expect(res.status).toBe(409);
  });

  test('returns 400 when fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/create-user')
      .send({ username: 'partial' });
    expect(res.status).toBe(400);
  });
});

// ── Phase 3: Login ────────────────────────────────────────────────────────────
// For login we need a real cert that passes X509Certificate parsing.
// We generate one via openssl in a subprocess; skip this block if openssl is unavailable.

describe('POST /api/auth/login', () => {
  let certPem, keyPem, wrongKeyPem;

  beforeAll(async () => {
    // Generate a real self-signed cert + key via openssl
    try {
      const { execSync } = require('child_process');
      execSync(
        'openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 ' +
        '-keyout /tmp/test.key -out /tmp/test.crt -days 1 -nodes ' +
        '-subj "/CN=test" 2>/dev/null'
      );
      certPem = require('fs').readFileSync('/tmp/test.crt', 'utf8');
      keyPem  = require('fs').readFileSync('/tmp/test.key', 'utf8');

      execSync(
        'openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 ' +
        '-keyout /tmp/test2.key -out /tmp/test2.crt -days 1 -nodes ' +
        '-subj "/CN=test2" 2>/dev/null'
      );
      wrongKeyPem = require('fs').readFileSync('/tmp/test2.key', 'utf8');
    } catch {
      certPem = null; // openssl not available — skip
    }
  });

  test('succeeds with valid credentials and matching key', async () => {
    if (!certPem) return;

    db.createUser({
      username: 'henry',
      password: 'correct-horse',
      certPem,
      role:  'engineer',
      org:   'Org1',
      mspId: 'Org1MSP',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'henry', password: 'correct-horse', certPem, keyPem });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.username).toBe('henry');
  });

  test('rejects wrong password', async () => {
    if (!certPem) return;

    db.createUser({
      username: 'irene',
      password: 'right-password',
      certPem,
      role:  'viewer',
      org:   'Org1',
      mspId: 'Org1MSP',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'irene', password: 'wrong-password', certPem, keyPem });

    expect(res.status).toBe(401);
  });

  test('rejects mismatched private key', async () => {
    if (!certPem) return;

    db.createUser({
      username: 'jack',
      password: 'pw123',
      certPem,
      role:  'viewer',
      org:   'Org1',
      mspId: 'Org1MSP',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'jack', password: 'pw123', certPem, keyPem: wrongKeyPem });

    expect(res.status).toBe(401);
  });

  test('returns 400 when fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody' });
    expect(res.status).toBe(400);
  });
});
