'use strict';

const db = require('../src/db');

beforeEach(() => db._clear());

// ── Registration requests ─────────────────────────────────────────────────────

describe('createRequest / getRequest', () => {
  test('returns a tracking ID and PENDING status', () => {
    const id = db.createRequest({ name: 'Alice', org: 'Org1', role: 'engineer' });
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);

    const rec = db.getRequest(id);
    expect(rec.status).toBe('PENDING');
    expect(rec.name).toBe('Alice');
    expect(rec.org).toBe('Org1');
  });

  test('getRequest returns null for unknown ID', () => {
    expect(db.getRequest('nope')).toBeNull();
  });
});

describe('getPendingRequestsByOrg', () => {
  test('filters by org and PENDING status', () => {
    const id1 = db.createRequest({ name: 'A', org: 'Org1', role: 'engineer' });
    db.createRequest({ name: 'B', org: 'Org2', role: 'viewer' });
    db.approveRequest(id1, 'enroll1', 'secret1');

    const pending = db.getPendingRequestsByOrg('Org1');
    expect(pending).toHaveLength(0); // id1 is now APPROVED

    db.createRequest({ name: 'C', org: 'Org1', role: 'manager' });
    expect(db.getPendingRequestsByOrg('Org1')).toHaveLength(1);
  });
});

describe('approveRequest', () => {
  test('sets APPROVED status with enrollmentId and secret', () => {
    const id = db.createRequest({ name: 'Bob', org: 'Org1', role: 'viewer' });
    db.approveRequest(id, 'bob-enroll', 'supersecret');

    const rec = db.getRequest(id);
    expect(rec.status).toBe('APPROVED');
    expect(rec.enrollmentId).toBe('bob-enroll');
    expect(rec.secret).toBe('supersecret');
  });

  test('throws for unknown trackingId', () => {
    expect(() => db.approveRequest('bad-id', 'e', 's')).toThrow();
  });
});

// ── Users ─────────────────────────────────────────────────────────────────────

describe('createUser / getUser / checkPassword', () => {
  test('creates a user and verifies password correctly', () => {
    db.createUser({
      username: 'carol',
      password: 'p@ssw0rd',
      certPem:  'CERT',
      role:     'engineer',
      org:      'Org1',
      mspId:    'Org1MSP',
    });

    const user = db.getUser('carol');
    expect(user).not.toBeNull();
    expect(user.role).toBe('engineer');

    expect(db.checkPassword('carol', 'p@ssw0rd')).toBe(true);
    expect(db.checkPassword('carol', 'wrong')).toBe(false);
  });

  test('throws on duplicate username', () => {
    db.createUser({ username: 'dave', password: 'x', certPem: 'C', role: 'viewer', org: 'Org1' });
    expect(() =>
      db.createUser({ username: 'dave', password: 'y', certPem: 'C', role: 'viewer', org: 'Org1' })
    ).toThrow(/already exists/);
  });

  test('getUser returns null for unknown username', () => {
    expect(db.getUser('nobody')).toBeNull();
  });

  test('checkPassword returns false for unknown user', () => {
    expect(db.checkPassword('ghost', 'pw')).toBe(false);
  });
});
