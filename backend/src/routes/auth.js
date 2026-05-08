'use strict';

/**
 * Auth routes — implements Phases 1, 2, and 3.
 *
 * Phase 1 (Registration & Admin approval):
 *   POST   /api/auth/register-request   → submit name/org/role, get trackingId
 *   GET    /api/admin/requests          → admin lists PENDING requests for their org
 *   POST   /api/admin/approve           → admin sets enrollmentId + secret
 *   GET    /api/auth/status/:trackingId → user polls for status + enrollment creds
 *
 * Phase 2 (Enrollment & User Creation):
 *   POST   /api/auth/enroll             → call Fabric CA with CSR, get cert back
 *   POST   /api/auth/create-user        → store hashed password + cert in DB
 *
 * Phase 3 (Login):
 *   POST   /api/auth/login              → verify password, verify key↔cert, set session
 *   POST   /api/auth/logout             → destroy session
 */

const express  = require('express');
const crypto   = require('crypto');
const https    = require('https');
const db       = require('../db');

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Verifies that a private key (PEM) matches the public key embedded in a
 * certificate (PEM) by signing a random challenge and verifying it.
 * Returns true if the key pair is consistent.
 */
function keyMatchesCert(certPem, keyPem) {
  try {
    const challenge = crypto.randomBytes(32);
    const privateKey = crypto.createPrivateKey(keyPem);

    const sign = crypto.createSign('SHA256');
    sign.update(challenge);
    const signature = sign.sign(privateKey);

    const x509 = new crypto.X509Certificate(certPem);
    const verify = crypto.createVerify('SHA256');
    verify.update(challenge);
    return verify.verify(x509.publicKey, signature);
  } catch {
    return false;
  }
}

/**
 * Calls the Fabric CA REST API to enroll a user with a CSR.
 * The CA issues a signed certificate in return.
 *
 * @param {string} caUrl        e.g. "https://ca.org1.example.com:7054"
 * @param {string} enrollmentId
 * @param {string} secret
 * @param {string} csrPem       PKCS#10 CSR in PEM format (generated in browser)
 * @returns {Promise<string>}   Signed certificate PEM
 */
function enrollWithCA(caUrl, enrollmentId, secret, csrPem) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ certificate_request: csrPem });
    const auth = Buffer.from(`${enrollmentId}:${secret}`).toString('base64');
    const url  = new URL(`${caUrl}/api/v1/enroll`);

    const options = {
      hostname: url.hostname,
      port:     url.port || 443,
      path:     url.pathname,
      method:   'POST',
      // In production set ca: fs.readFileSync(caCertPath) instead of rejectUnauthorized: false
      rejectUnauthorized: process.env.NODE_ENV === 'production',
      headers: {
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(body),
        Authorization:   `Basic ${auth}`,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (!parsed.success) {
            return reject(new Error(parsed.errors?.[0]?.message || 'CA enrollment failed'));
          }
          resolve(parsed.result.Cert); // base64-encoded PEM from Fabric CA
        } catch (e) {
          reject(new Error(`Failed to parse CA response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Phase 1: Registration ─────────────────────────────────────────────────────

/**
 * @openapi
 * /api/auth/register-request:
 *   post:
 *     tags: [Phase 1 — Registration]
 *     summary: Submit a registration request
 *     description: >
 *       A new user submits their name, organisation, and desired role.
 *       An admin must approve the request before the user can enroll.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Request submitted — trackingId returned for status polling
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RegisterResponse'
 *       400:
 *         description: Missing or invalid fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/register-request', (req, res) => {
  const { name, org, role } = req.body;

  if (!name || !org || !role) {
    return res.status(400).json({ error: 'name, org, and role are required' });
  }

  const validRoles = ['admin', 'manager', 'engineer', 'viewer', 'auditor'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${validRoles.join(', ')}` });
  }

  const trackingId = db.createRequest({ name, org, role });
  res.status(201).json({ success: true, trackingId });
});

/**
 * @openapi
 * /api/auth/status/{trackingId}:
 *   get:
 *     tags: [Phase 1 — Registration]
 *     summary: Poll registration request status
 *     description: >
 *       Returns PENDING or APPROVED. When APPROVED, the enrollmentId and
 *       one-time secret needed for CA enrollment are included.
 *     parameters:
 *       - in: path
 *         name: trackingId
 *         required: true
 *         schema:
 *           type: string
 *         example: a3f9c2d1b8e04712
 *     responses:
 *       200:
 *         description: Current status of the request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StatusResponse'
 *       404:
 *         description: Tracking ID not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/status/:trackingId', (req, res) => {
  const record = db.getRequest(req.params.trackingId);
  if (!record) {
    return res.status(404).json({ error: 'Tracking ID not found' });
  }

  const payload = { status: record.status };
  if (record.status === 'APPROVED') {
    payload.enrollmentId = record.enrollmentId;
    payload.secret       = record.secret;
  }
  res.json({ success: true, ...payload });
});

// ── Admin router (mounted at /api/admin in server.js) ────────────────────────

const adminRouter = express.Router();

/**
 * @openapi
 * /api/admin/requests:
 *   get:
 *     tags: [Phase 1 — Admin]
 *     summary: List pending registration requests for an organisation
 *     parameters:
 *       - in: query
 *         name: org
 *         required: true
 *         schema:
 *           type: string
 *         example: Org1
 *     responses:
 *       200:
 *         description: Array of pending requests
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PendingRequest'
 *       400:
 *         description: Missing org query param
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
adminRouter.get('/requests', (req, res) => {
  const { org } = req.query;
  if (!org) {
    return res.status(400).json({ error: 'org query param is required' });
  }
  const requests = db.getPendingRequestsByOrg(org);
  res.json({ success: true, data: requests });
});

/**
 * @openapi
 * /api/admin/approve:
 *   post:
 *     tags: [Phase 1 — Admin]
 *     summary: Approve a registration request
 *     description: >
 *       Admin sets the enrollmentId and one-time secret on an approved request.
 *       The user can then retrieve these via the status endpoint and proceed to enroll.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApproveRequest'
 *     responses:
 *       200:
 *         description: Request approved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessMessage'
 *       400:
 *         description: Missing fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Tracking ID not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
adminRouter.post('/approve', (req, res) => {
  const { trackingId, enrollmentId, secret } = req.body;
  if (!trackingId || !enrollmentId || !secret) {
    return res.status(400).json({ error: 'trackingId, enrollmentId, and secret are required' });
  }

  try {
    db.approveRequest(trackingId, enrollmentId, secret);
    res.json({ success: true, message: 'Request approved' });
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

// ── Phase 2: Enroll ───────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/auth/enroll:
 *   post:
 *     tags: [Phase 2 — Enrollment]
 *     summary: Enroll with Fabric CA using a CSR
 *     description: >
 *       The browser generates a key pair and builds a PKCS#10 CSR.
 *       This endpoint forwards the CSR to the Fabric CA and returns the signed certificate.
 *       The private key never leaves the browser.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EnrollRequest'
 *     responses:
 *       200:
 *         description: Signed certificate returned
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnrollResponse'
 *       400:
 *         description: Missing fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       502:
 *         description: Fabric CA enrollment failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       503:
 *         description: FABRIC_CA_URL not configured
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/enroll', async (req, res) => {
  const { enrollmentId, secret, csrPem } = req.body;
  if (!enrollmentId || !secret || !csrPem) {
    return res.status(400).json({ error: 'enrollmentId, secret, and csrPem are required' });
  }

  const caUrl = process.env.FABRIC_CA_URL;
  if (!caUrl) {
    return res.status(503).json({ error: 'FABRIC_CA_URL is not configured' });
  }

  try {
    const certPem = await enrollWithCA(caUrl, enrollmentId, secret, csrPem);
    res.json({ success: true, certificatePem: certPem });
  } catch (e) {
    console.error('Enrollment error:', e);
    res.status(502).json({ error: `CA enrollment failed: ${e.message}` });
  }
});

// ── Phase 2: Create user ──────────────────────────────────────────────────────

/**
 * @openapi
 * /api/auth/create-user:
 *   post:
 *     tags: [Phase 2 — Enrollment]
 *     summary: Create a user account with a certificate
 *     description: >
 *       Stores the user's hashed password and X.509 certificate. Must be called
 *       after a successful /enroll to bind the Fabric identity to a username.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserRequest'
 *     responses:
 *       201:
 *         description: User created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessMessage'
 *       400:
 *         description: Missing fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Username already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/create-user', (req, res) => {
  const { username, password, certPem, role, org, mspId } = req.body;
  if (!username || !password || !certPem || !role || !org) {
    return res.status(400).json({ error: 'username, password, certPem, role, and org are required' });
  }

  try {
    db.createUser({ username, password, certPem, role, org, mspId });
    res.status(201).json({ success: true, message: 'User created' });
  } catch (e) {
    if (e.message.includes('already exists')) {
      return res.status(409).json({ error: e.message });
    }
    res.status(500).json({ error: e.message });
  }
});

// ── Phase 3: Login ────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Phase 3 — Login]
 *     summary: Login with username, password, and Fabric identity
 *     description: >
 *       Verifies the password hash, then cryptographically confirms the private key
 *       matches the certificate (sign-and-verify challenge). On success a session
 *       cookie is set containing the Fabric identity for subsequent blockchain calls.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Logged in — session cookie set
 *         headers:
 *           Set-Cookie:
 *             schema:
 *               type: string
 *               example: connect.sid=abc123; Path=/; HttpOnly
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Missing fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid credentials or key does not match certificate
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/login', (req, res) => {
  const { username, password, certPem, keyPem } = req.body;
  if (!username || !password || !certPem || !keyPem) {
    return res.status(400).json({ error: 'username, password, certPem, and keyPem are required' });
  }

  // Step 1: verify password against stored hash
  const user = db.getUser(username);
  if (!user || !db.checkPassword(username, password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Step 2: verify the provided key matches the certificate
  if (!keyMatchesCert(certPem, keyPem)) {
    return res.status(401).json({ error: 'Private key does not match certificate' });
  }

  // Step 3: store Fabric identity in session
  req.session.certPem  = certPem;
  req.session.keyPem   = keyPem;
  req.session.mspId    = user.mspId;
  req.session.username = username;
  req.session.role     = user.role;
  req.session.org      = user.org;

  res.json({ success: true, username, role: user.role, org: user.org });
});

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags: [Phase 3 — Login]
 *     summary: Logout and destroy session
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: Logged out
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessMessage'
 */
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Logged out' });
  });
});

module.exports = { authRouter: router, adminRouter };
