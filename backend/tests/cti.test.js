'use strict';

// ── Mock external deps BEFORE any require ─────────────────────────────────────

const mockContract = {
  evaluateTransaction: jest.fn(),
  submitTransaction:   jest.fn(),
};

const mockPool = {
  size:     0,
  closeAll: jest.fn(),
  acquire:  jest.fn().mockResolvedValue({ network: {}, contract: mockContract }),
  release:  jest.fn(),
};

jest.mock('../src/gatewayPool', () => ({ pool: mockPool }));

// Mock express-session so every request arrives with a pre-seeded Fabric identity.
// This avoids needing a live session store or a test-only seeding endpoint.
jest.mock('express-session', () => {
  return () => (req, _res, next) => {
    req.session = {
      certPem:  'FAKE_CERT',
      keyPem:   'FAKE_KEY',
      mspId:    'Org1MSP',
      username: 'test-user',
      role:     'engineer',
      org:      'Org1',
      destroy:  (cb) => cb && cb(),
    };
    next();
  };
});

// ── Load app after mocks ──────────────────────────────────────────────────────

const request = require('supertest');
let app;

beforeAll(() => {
  app = require('../src/server');
});

afterAll(() => jest.resetModules());

beforeEach(() => {
  jest.clearAllMocks();
  mockPool.acquire.mockResolvedValue({ network: {}, contract: mockContract });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function encode(obj) {
  return Buffer.from(JSON.stringify(obj));
}

// ── GET /api/cti ──────────────────────────────────────────────────────────────

describe('GET /api/cti', () => {
  test('returns list of CTIs from chaincode', async () => {
    const ctis = [{ id: 'CTI001', title: 'Issue A' }];
    mockContract.evaluateTransaction.mockResolvedValue(encode(ctis));

    const res = await request(app).get('/api/cti');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(ctis);
    expect(mockContract.evaluateTransaction).toHaveBeenCalledWith('GetAllCTIs');
    expect(mockPool.release).toHaveBeenCalled();
  });

  test('returns 503 when pool acquisition fails', async () => {
    mockPool.acquire.mockRejectedValue(new Error('Pool exhausted'));

    const res = await request(app).get('/api/cti');
    expect(res.status).toBe(503);
  });
});

// ── GET /api/cti/:id ──────────────────────────────────────────────────────────

describe('GET /api/cti/:id', () => {
  test('returns a single CTI', async () => {
    const cti = { id: 'CTI001', title: 'Issue A' };
    mockContract.evaluateTransaction.mockResolvedValue(encode(cti));

    const res = await request(app).get('/api/cti/CTI001');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(cti);
    expect(mockContract.evaluateTransaction).toHaveBeenCalledWith('ReadCTI', 'CTI001');
  });

  test('returns 404 when chaincode says it does not exist', async () => {
    mockContract.evaluateTransaction.mockRejectedValue(new Error('CTI CTI999 does not exist'));

    const res = await request(app).get('/api/cti/CTI999');
    expect(res.status).toBe(404);
  });
});

// ── POST /api/cti ─────────────────────────────────────────────────────────────

describe('POST /api/cti', () => {
  const body = {
    id: 'CTI002', title: 'New Issue', description: 'Details',
    status: 'OPEN', priority: 'HIGH', category: 'Security',
    assignedTo: 'eng@org1', metadata: { key: 'val' },
  };

  test('creates a CTI and returns 201', async () => {
    mockContract.submitTransaction.mockResolvedValue(undefined);

    const res = await request(app).post('/api/cti').send(body);

    expect(res.status).toBe(201);
    expect(res.body.ctiId).toBe('CTI002');
    expect(mockContract.submitTransaction).toHaveBeenCalledWith(
      'CreateCTI',
      'CTI002', 'New Issue', 'Details', 'OPEN', 'HIGH', 'Security',
      'eng@org1', JSON.stringify({ key: 'val' })
    );
  });

  test('returns 400 when id or title is missing', async () => {
    const res = await request(app).post('/api/cti').send({ title: 'No ID' });
    expect(res.status).toBe(400);
  });

  test('returns 409 when CTI already exists', async () => {
    mockContract.submitTransaction.mockRejectedValue(new Error('CTI already exists'));

    const res = await request(app).post('/api/cti').send(body);
    expect(res.status).toBe(409);
  });

  test('returns 403 when chaincode reports access denied', async () => {
    mockContract.submitTransaction.mockRejectedValue(new Error('access denied'));

    const res = await request(app).post('/api/cti').send(body);
    expect(res.status).toBe(403);
  });
});

// ── PUT /api/cti/:id ──────────────────────────────────────────────────────────

describe('PUT /api/cti/:id', () => {
  test('updates a CTI', async () => {
    mockContract.submitTransaction.mockResolvedValue(undefined);

    const res = await request(app).put('/api/cti/CTI001').send({
      title: 'Updated', description: 'Desc', status: 'IN_PROGRESS',
      priority: 'MEDIUM', category: 'Technical', assignedTo: 'eng@org1',
    });

    expect(res.status).toBe(200);
    expect(mockContract.submitTransaction).toHaveBeenCalledWith(
      'UpdateCTI', 'CTI001', 'Updated', 'Desc',
      'IN_PROGRESS', 'MEDIUM', 'Technical', 'eng@org1', '{}'
    );
  });

  test('returns 404 when CTI does not exist', async () => {
    mockContract.submitTransaction.mockRejectedValue(new Error('CTI CTI999 does not exist'));

    const res = await request(app).put('/api/cti/CTI999').send({ title: 'X', status: 'OPEN', priority: 'LOW' });
    expect(res.status).toBe(404);
  });
});

// ── DELETE /api/cti/:id ───────────────────────────────────────────────────────

describe('DELETE /api/cti/:id', () => {
  test('deletes a CTI', async () => {
    mockContract.submitTransaction.mockResolvedValue(undefined);

    const res = await request(app).delete('/api/cti/CTI001');
    expect(res.status).toBe(200);
    expect(mockContract.submitTransaction).toHaveBeenCalledWith('DeleteCTI', 'CTI001');
  });

  test('returns 403 when user lacks delete permission', async () => {
    mockContract.submitTransaction.mockRejectedValue(new Error('access denied'));

    const res = await request(app).delete('/api/cti/CTI001');
    expect(res.status).toBe(403);
  });
});

// ── GET /api/cti/:id/history ──────────────────────────────────────────────────

describe('GET /api/cti/:id/history', () => {
  test('returns history array', async () => {
    const history = [{ txId: 'tx1', isDelete: false }];
    mockContract.evaluateTransaction.mockResolvedValue(encode(history));

    const res = await request(app).get('/api/cti/CTI001/history');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(history);
    expect(mockContract.evaluateTransaction).toHaveBeenCalledWith('GetCTIHistory', 'CTI001');
  });
});

// ── GET /api/cti/query/status/:status ────────────────────────────────────────

describe('GET /api/cti/query/status/:status', () => {
  test('queries by status', async () => {
    const ctis = [{ id: 'CTI001', status: 'OPEN' }];
    mockContract.evaluateTransaction.mockResolvedValue(encode(ctis));

    const res = await request(app).get('/api/cti/query/status/OPEN');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(ctis);
    expect(mockContract.evaluateTransaction).toHaveBeenCalledWith('QueryCTIsByStatus', 'OPEN');
  });
});

// ── GET /api/cti/query/priority/:priority ────────────────────────────────────

describe('GET /api/cti/query/priority/:priority', () => {
  test('queries by priority', async () => {
    const ctis = [{ id: 'CTI001', priority: 'HIGH' }];
    mockContract.evaluateTransaction.mockResolvedValue(encode(ctis));

    const res = await request(app).get('/api/cti/query/priority/HIGH');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(ctis);
    expect(mockContract.evaluateTransaction).toHaveBeenCalledWith('QueryCTIsByPriority', 'HIGH');
  });
});

// ── POST /api/cti/:id/documents ───────────────────────────────────────────────

describe('POST /api/cti/:id/documents', () => {
  test('adds a document reference', async () => {
    mockContract.submitTransaction.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/cti/CTI001/documents')
      .send({ documentRef: 'ipfs://QmXxx' });

    expect(res.status).toBe(200);
    expect(mockContract.submitTransaction).toHaveBeenCalledWith(
      'AddDocumentReference', 'CTI001', 'ipfs://QmXxx'
    );
  });

  test('returns 400 when documentRef is missing', async () => {
    const res = await request(app).post('/api/cti/CTI001/documents').send({});
    expect(res.status).toBe(400);
  });
});
