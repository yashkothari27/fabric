'use strict';

const express = require('express');
const { pool } = require('../gatewayPool');

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function sessionToIdentity(req) {
  // Session is populated during login (Phase 3).
  // Expected shape: { certPem, keyPem, mspId, username, organization }
  const s = req.session;
  if (!s || !s.certPem || !s.keyPem || !s.mspId) {
    throw Object.assign(new Error('No valid Fabric identity in session'), { status: 401 });
  }
  return { certPem: s.certPem, keyPem: s.keyPem, mspId: s.mspId };
}

function chaincodeError(err) {
  const msg = err.message || '';
  if (msg.includes('access denied'))    return { status: 403, message: 'Access denied' };
  if (msg.includes('does not exist'))   return { status: 404, message: 'CTI not found' };
  if (msg.includes('already exists'))   return { status: 409, message: 'CTI already exists' };
  if (msg.includes('invalid'))          return { status: 400, message: msg };
  return { status: 500, message: 'Internal server error' };
}

// Wraps a route handler: acquires a pooled gateway, runs fn, releases on finish.
function withGateway(fn) {
  return async (req, res) => {
    let session;
    try {
      session = sessionToIdentity(req);
    } catch (e) {
      return res.status(e.status || 401).json({ error: e.message });
    }

    let network, contract;
    try {
      ({ network, contract } = await pool.acquire(session));
    } catch (e) {
      console.error('Gateway pool error:', e);
      return res.status(503).json({ error: 'Fabric network unavailable' });
    }

    try {
      await fn(req, res, network, contract);
    } catch (e) {
      console.error('Chaincode error:', e);
      const { status, message } = chaincodeError(e);
      res.status(status).json({ error: message });
    } finally {
      pool.release(session);
    }
  };
}

function decode(bytes) {
  return JSON.parse(Buffer.from(bytes).toString('utf8'));
}

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/cti:
 *   get:
 *     tags: [Phase 5 — Retrieve CTI]
 *     summary: List all CTIs accessible to the logged-in user
 *     description: Role-based access control is enforced by the chaincode.
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: Array of CTI records
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CTI'
 *       401:
 *         description: Not logged in
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       503:
 *         description: Fabric network unavailable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', withGateway(async (req, res, _network, contract) => {
  const bytes = await contract.evaluateTransaction('GetAllCTIs');
  res.json({ success: true, data: decode(bytes) });
}));

/**
 * @openapi
 * /api/cti/query/status/{status}:
 *   get:
 *     tags: [Phase 5 — Retrieve CTI]
 *     summary: Query CTIs by status
 *     security:
 *       - sessionCookie: []
 *     parameters:
 *       - in: path
 *         name: status
 *         required: true
 *         schema:
 *           type: string
 *           enum: [OPEN, IN_PROGRESS, RESOLVED, CLOSED]
 *     responses:
 *       200:
 *         description: Matching CTI records
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CTI'
 *       401:
 *         description: Not logged in
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/query/status/:status', withGateway(async (req, res, _network, contract) => {
  const bytes = await contract.evaluateTransaction('QueryCTIsByStatus', req.params.status);
  res.json({ success: true, data: decode(bytes) });
}));

/**
 * @openapi
 * /api/cti/query/priority/{priority}:
 *   get:
 *     tags: [Phase 5 — Retrieve CTI]
 *     summary: Query CTIs by priority
 *     security:
 *       - sessionCookie: []
 *     parameters:
 *       - in: path
 *         name: priority
 *         required: true
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *     responses:
 *       200:
 *         description: Matching CTI records
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CTI'
 *       401:
 *         description: Not logged in
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/query/priority/:priority', withGateway(async (req, res, _network, contract) => {
  const bytes = await contract.evaluateTransaction('QueryCTIsByPriority', req.params.priority);
  res.json({ success: true, data: decode(bytes) });
}));

/**
 * @openapi
 * /api/cti/{id}:
 *   get:
 *     tags: [Phase 5 — Retrieve CTI]
 *     summary: Get a single CTI by ID
 *     security:
 *       - sessionCookie: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: CTI001
 *     responses:
 *       200:
 *         description: CTI record
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   $ref: '#/components/schemas/CTI'
 *       401:
 *         description: Not logged in
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: CTI not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', withGateway(async (req, res, _network, contract) => {
  const bytes = await contract.evaluateTransaction('ReadCTI', req.params.id);
  res.json({ success: true, data: decode(bytes) });
}));

/**
 * @openapi
 * /api/cti:
 *   post:
 *     tags: [Phase 4 — Create CTI]
 *     summary: Create a new CTI on the ledger
 *     description: Submits a transaction to the chaincode. Requires create permission (engineer, manager, admin).
 *     security:
 *       - sessionCookie: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCTIRequest'
 *     responses:
 *       201:
 *         description: CTI created on the blockchain
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 ctiId:   { type: string, example: CTI002 }
 *       400:
 *         description: Missing id or title
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Not logged in
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Insufficient role permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: CTI ID already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', withGateway(async (req, res, _network, contract) => {
  const { id, title, description, status, priority, category, assignedTo, metadata } = req.body;

  if (!id || !title) {
    return res.status(400).json({ error: 'id and title are required' });
  }

  await contract.submitTransaction(
    'CreateCTI',
    id,
    title,
    description ?? '',
    status ?? 'OPEN',
    priority ?? 'MEDIUM',
    category ?? '',
    assignedTo ?? '',
    JSON.stringify(metadata ?? {})
  );

  res.status(201).json({ success: true, message: 'CTI created', ctiId: id });
}));

/**
 * @openapi
 * /api/cti/{id}:
 *   put:
 *     tags: [Phase 4 — Create CTI]
 *     summary: Update an existing CTI
 *     security:
 *       - sessionCookie: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: CTI001
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateCTIRequest'
 *     responses:
 *       200:
 *         description: CTI updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessMessage'
 *       401:
 *         description: Not logged in
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Access denied
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: CTI not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   delete:
 *     tags: [Phase 4 — Create CTI]
 *     summary: Delete a CTI (admin / manager only)
 *     security:
 *       - sessionCookie: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: CTI001
 *     responses:
 *       200:
 *         description: CTI deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessMessage'
 *       401:
 *         description: Not logged in
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: CTI not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id', withGateway(async (req, res, _network, contract) => {
  const { title, description, status, priority, category, assignedTo, metadata } = req.body;

  await contract.submitTransaction(
    'UpdateCTI',
    req.params.id,
    title ?? '',
    description ?? '',
    status ?? '',
    priority ?? '',
    category ?? '',
    assignedTo ?? '',
    JSON.stringify(metadata ?? {})
  );

  res.json({ success: true, message: 'CTI updated' });
}));

router.delete('/:id', withGateway(async (req, res, _network, contract) => {
  await contract.submitTransaction('DeleteCTI', req.params.id);
  res.json({ success: true, message: 'CTI deleted' });
}));

/**
 * @openapi
 * /api/cti/{id}/history:
 *   get:
 *     tags: [Phase 5 — Retrieve CTI]
 *     summary: Get the full audit history of a CTI from the ledger
 *     description: Returns every transaction that ever touched this CTI, in chronological order.
 *     security:
 *       - sessionCookie: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: CTI001
 *     responses:
 *       200:
 *         description: Ordered list of historical states
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CTIHistory'
 *       401:
 *         description: Not logged in
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: CTI not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id/history', withGateway(async (req, res, _network, contract) => {
  const bytes = await contract.evaluateTransaction('GetCTIHistory', req.params.id);
  res.json({ success: true, data: decode(bytes) });
}));

/**
 * @openapi
 * /api/cti/{id}/documents:
 *   post:
 *     tags: [Phase 4 — Create CTI]
 *     summary: Attach a document reference to a CTI
 *     description: Stores an IPFS hash, URL, or any string reference alongside the CTI on the ledger.
 *     security:
 *       - sessionCookie: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: CTI001
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddDocumentRequest'
 *     responses:
 *       200:
 *         description: Document reference added
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessMessage'
 *       400:
 *         description: documentRef missing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Not logged in
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: CTI not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:id/documents', withGateway(async (req, res, _network, contract) => {
  const { documentRef } = req.body;
  if (!documentRef) {
    return res.status(400).json({ error: 'documentRef is required' });
  }
  await contract.submitTransaction('AddDocumentReference', req.params.id, documentRef);
  res.json({ success: true, message: 'Document reference added' });
}));

module.exports = router;
