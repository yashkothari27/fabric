'use strict';

/**
 * In-memory database for users and registration requests.
 * Replace Map storage with Postgres/MySQL calls for production.
 */

const crypto = require('crypto');

// ── Storage ───────────────────────────────────────────────────────────────────

const requestsStore = new Map(); // trackingId → request record
const usersStore    = new Map(); // username   → user record

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateId() {
  return crypto.randomBytes(8).toString('hex');
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const candidate = crypto.pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'));
}

// ── Registration requests (Phase 1) ───────────────────────────────────────────

function createRequest({ name, org, role }) {
  const trackingId = generateId();
  requestsStore.set(trackingId, {
    trackingId,
    name,
    org,
    role,
    status: 'PENDING',
    enrollmentId: null,
    secret: null,
    createdAt: new Date().toISOString(),
  });
  return trackingId;
}

function getRequest(trackingId) {
  return requestsStore.get(trackingId) ?? null;
}

function getPendingRequestsByOrg(org) {
  return [...requestsStore.values()].filter(
    (r) => r.org === org && r.status === 'PENDING'
  );
}

function approveRequest(trackingId, enrollmentId, secret) {
  const req = requestsStore.get(trackingId);
  if (!req) throw new Error(`Request ${trackingId} not found`);
  req.status       = 'APPROVED';
  req.enrollmentId = enrollmentId;
  req.secret       = secret;
  return req;
}

// ── Users (Phase 2 & 3) ───────────────────────────────────────────────────────

function createUser({ username, password, certPem, role, org, mspId }) {
  if (usersStore.has(username)) {
    throw new Error(`User ${username} already exists`);
  }
  usersStore.set(username, {
    username,
    passwordHash: hashPassword(password),
    certPem,
    role,
    org,
    mspId: mspId || `${org}MSP`,
    createdAt: new Date().toISOString(),
  });
}

function getUser(username) {
  return usersStore.get(username) ?? null;
}

function checkPassword(username, password) {
  const user = usersStore.get(username);
  if (!user) return false;
  return verifyPassword(password, user.passwordHash);
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  createRequest,
  getRequest,
  getPendingRequestsByOrg,
  approveRequest,
  createUser,
  getUser,
  checkPassword,
  // exposed for tests
  _clear() {
    requestsStore.clear();
    usersStore.clear();
  },
};
