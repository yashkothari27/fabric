'use strict';

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CTI Management System API',
      version: '1.0.0',
      description:
        'REST API for the Hyperledger Fabric CTI (Case Tracking Information) Management System. ' +
        'Covers user registration, CA enrollment, login, and full CTI lifecycle on the blockchain.',
      contact: { name: 'Reltime' },
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Local development' },
    ],
    components: {
      securitySchemes: {
        sessionCookie: {
          type: 'apiKey',
          in: 'cookie',
          name: 'connect.sid',
          description: 'Session cookie set after a successful login',
        },
      },
      schemas: {
        // ── Shared primitives ──────────────────────────────────────────────
        SuccessMessage: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Descriptive error message' },
          },
        },

        // ── Registration (Phase 1) ─────────────────────────────────────────
        RegisterRequest: {
          type: 'object',
          required: ['name', 'org', 'role'],
          properties: {
            name: { type: 'string', example: 'Alice Smith' },
            org:  { type: 'string', example: 'Org1' },
            role: {
              type: 'string',
              enum: ['admin', 'manager', 'engineer', 'viewer', 'auditor'],
              example: 'engineer',
            },
          },
        },
        RegisterResponse: {
          type: 'object',
          properties: {
            success:    { type: 'boolean', example: true },
            trackingId: { type: 'string', example: 'a3f9c2d1b8e04712' },
          },
        },
        StatusResponse: {
          type: 'object',
          properties: {
            success:      { type: 'boolean', example: true },
            status:       { type: 'string', enum: ['PENDING', 'APPROVED'], example: 'APPROVED' },
            enrollmentId: { type: 'string', example: 'alice-enroll', description: 'Only present when APPROVED' },
            secret:       { type: 'string', example: 's3cr3t',        description: 'Only present when APPROVED' },
          },
        },
        ApproveRequest: {
          type: 'object',
          required: ['trackingId', 'enrollmentId', 'secret'],
          properties: {
            trackingId:   { type: 'string', example: 'a3f9c2d1b8e04712' },
            enrollmentId: { type: 'string', example: 'alice-enroll' },
            secret:       { type: 'string', example: 's3cr3t' },
          },
        },
        PendingRequest: {
          type: 'object',
          properties: {
            trackingId: { type: 'string' },
            name:       { type: 'string' },
            org:        { type: 'string' },
            role:       { type: 'string' },
            status:     { type: 'string' },
            createdAt:  { type: 'string', format: 'date-time' },
          },
        },

        // ── Enrollment & user creation (Phase 2) ───────────────────────────
        EnrollRequest: {
          type: 'object',
          required: ['enrollmentId', 'secret', 'csrPem'],
          properties: {
            enrollmentId: { type: 'string', example: 'alice-enroll' },
            secret:       { type: 'string', example: 's3cr3t' },
            csrPem: {
              type: 'string',
              description: 'PKCS#10 Certificate Signing Request in PEM format, generated in the browser',
              example: '-----BEGIN CERTIFICATE REQUEST-----\n...\n-----END CERTIFICATE REQUEST-----',
            },
          },
        },
        EnrollResponse: {
          type: 'object',
          properties: {
            success:        { type: 'boolean', example: true },
            certificatePem: {
              type: 'string',
              description: 'Signed X.509 certificate from Fabric CA',
              example: '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----',
            },
          },
        },
        CreateUserRequest: {
          type: 'object',
          required: ['username', 'password', 'certPem', 'role', 'org'],
          properties: {
            username: { type: 'string', example: 'alice' },
            password: { type: 'string', format: 'password', example: 'hunter2' },
            certPem: {
              type: 'string',
              description: 'X.509 certificate PEM obtained from /api/auth/enroll',
              example: '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----',
            },
            role:  { type: 'string', enum: ['admin', 'manager', 'engineer', 'viewer', 'auditor'], example: 'engineer' },
            org:   { type: 'string', example: 'Org1' },
            mspId: { type: 'string', example: 'Org1MSP' },
          },
        },

        // ── Login (Phase 3) ────────────────────────────────────────────────
        LoginRequest: {
          type: 'object',
          required: ['username', 'password', 'certPem', 'keyPem'],
          properties: {
            username: { type: 'string', example: 'alice' },
            password: { type: 'string', format: 'password', example: 'hunter2' },
            certPem:  { type: 'string', description: 'X.509 certificate PEM' },
            keyPem:   { type: 'string', description: 'EC private key PEM matching the certificate' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success:  { type: 'boolean', example: true },
            username: { type: 'string', example: 'alice' },
            role:     { type: 'string', example: 'engineer' },
            org:      { type: 'string', example: 'Org1' },
          },
        },

        // ── CTI (Phases 4 & 5) ─────────────────────────────────────────────
        CTI: {
          type: 'object',
          properties: {
            id:           { type: 'string', example: 'CTI001' },
            title:        { type: 'string', example: 'System Integration Issue' },
            description:  { type: 'string', example: 'Modules A and B failing to communicate' },
            status:       { type: 'string', enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'], example: 'OPEN' },
            priority:     { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], example: 'HIGH' },
            category:     { type: 'string', example: 'Technical' },
            createdBy:    { type: 'string', example: 'x509::CN=alice::CN=ca.org1' },
            assignedTo:   { type: 'string', example: 'engineer@org1' },
            organization: { type: 'string', example: 'Org1MSP' },
            createdAt:    { type: 'string', format: 'date-time' },
            updatedAt:    { type: 'string', format: 'date-time' },
            metadata:     { type: 'object', additionalProperties: { type: 'string' }, example: { module: 'auth', severity: 'high' } },
            documents:    { type: 'array', items: { type: 'string' }, example: ['ipfs://QmXxx'] },
          },
        },
        CreateCTIRequest: {
          type: 'object',
          required: ['id', 'title'],
          properties: {
            id:          { type: 'string', example: 'CTI002' },
            title:       { type: 'string', example: 'Auth service timeout' },
            description: { type: 'string', example: 'Login endpoint times out under load' },
            status:      { type: 'string', enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'], default: 'OPEN' },
            priority:    { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },
            category:    { type: 'string', example: 'Security' },
            assignedTo:  { type: 'string', example: 'engineer@org1' },
            metadata:    { type: 'object', additionalProperties: { type: 'string' } },
          },
        },
        UpdateCTIRequest: {
          type: 'object',
          properties: {
            title:       { type: 'string' },
            description: { type: 'string' },
            status:      { type: 'string', enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] },
            priority:    { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
            category:    { type: 'string' },
            assignedTo:  { type: 'string' },
            metadata:    { type: 'object', additionalProperties: { type: 'string' } },
          },
        },
        CTIHistory: {
          type: 'object',
          properties: {
            txId:      { type: 'string', example: 'abc123def456' },
            timestamp: { type: 'string', format: 'date-time' },
            isDelete:  { type: 'boolean', example: false },
            value:     { $ref: '#/components/schemas/CTI' },
          },
        },
        AddDocumentRequest: {
          type: 'object',
          required: ['documentRef'],
          properties: {
            documentRef: { type: 'string', example: 'ipfs://QmXxxYyyZzz' },
          },
        },
      },
    },
  },
  // swagger-jsdoc scans these files for @openapi / @swagger JSDoc annotations
  apis: [
    './src/routes/auth.js',
    './src/routes/cti.js',
  ],
};

module.exports = swaggerJsdoc(options);
