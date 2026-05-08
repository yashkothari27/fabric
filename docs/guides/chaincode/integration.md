# Backend Integration Guide

This guide explains how to integrate the CTI chaincode with your Node.js backend application (as described in Phase 4 & 5).

## Prerequisites

- Node.js 16+ 
- Fabric Gateway SDK (`@hyperledger/fabric-gateway`)
- User session with stored certificate and private key

## Installation

```bash
npm install @hyperledger/fabric-gateway @grpc/grpc-js
```

## Connection Setup

### 1. Gateway Configuration

```javascript
const { connect, signers, hash } = require('@hyperledger/fabric-gateway');
const grpc = require('@grpc/grpc-js');
const fs = require('fs');
const path = require('path');

// Load connection profile
const peerEndpoint = 'localhost:7051';
const peerHostAlias = 'peer0.org1.example.com';

// TLS credentials
const tlsRootCert = fs.readFileSync(
  path.join(__dirname, 'crypto', 'org1', 'peer', 'tls', 'ca.crt')
);

// Create gRPC client
const client = new grpc.Client(
  peerEndpoint,
  grpc.credentials.createSsl(tlsRootCert),
  {
    'grpc.ssl_target_name_override': peerHostAlias,
  }
);
```

### 2. User Identity from Session

```javascript
// Get user identity from session (stored during login - Phase 3)
async function getUserIdentity(sessionId) {
  const session = await sessionStore.get(sessionId);
  
  return {
    credentials: {
      certificate: Buffer.from(session.certPem),
      privateKey: Buffer.from(session.keyPem)
    },
    mspId: session.organization, // e.g., 'Org1MSP'
    userId: session.username
  };
}

// Create signer from user's private key
function createSigner(privateKeyPem) {
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  return signers.newPrivateKeySigner(privateKey);
}
```

## Backend API Implementation

### Express Route Handler Example

```javascript
const express = require('express');
const router = express.Router();

// Middleware to verify session and load Fabric identity
async function loadFabricIdentity(req, res, next) {
  try {
    const sessionId = req.cookies.sid;
    const identity = await getUserIdentity(sessionId);
    
    // Create gateway connection
    const signer = createSigner(identity.credentials.privateKey);
    
    const gateway = connect({
      client,
      identity: {
        mspId: identity.mspId,
        credentials: identity.credentials.certificate
      },
      signer: signer,
      hash: hash.sha256,
      evaluateOptions: () => ({ deadline: Date.now() + 5000 }),
      endorseOptions: () => ({ deadline: Date.now() + 15000 }),
      submitOptions: () => ({ deadline: Date.now() + 5000 }),
      commitStatusOptions: () => ({ deadline: Date.now() + 60000 }),
    });
    
    req.gateway = gateway;
    req.identity = identity;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
}

// GET /cti - Get all CTIs (Phase 5)
router.get('/cti', loadFabricIdentity, async (req, res) => {
  try {
    const network = req.gateway.getNetwork(req.query.channel || 'mychannel');
    const contract = network.getContract('cti');
    
    // Evaluate transaction (read-only)
    const resultBytes = await contract.evaluateTransaction('GetAllCTIs');
    const ctis = JSON.parse(resultBytes.toString());
    
    res.json({ success: true, data: ctis });
  } catch (error) {
    console.error('Failed to get CTIs:', error);
    res.status(500).json({ error: error.message });
  } finally {
    req.gateway.close();
  }
});

// GET /cti/:id - Get specific CTI
router.get('/cti/:id', loadFabricIdentity, async (req, res) => {
  try {
    const network = req.gateway.getNetwork(req.query.channel || 'mychannel');
    const contract = network.getContract('cti');
    
    const resultBytes = await contract.evaluateTransaction('ReadCTI', req.params.id);
    const cti = JSON.parse(resultBytes.toString());
    
    res.json({ success: true, data: cti });
  } catch (error) {
    console.error('Failed to read CTI:', error);
    res.status(500).json({ error: error.message });
  } finally {
    req.gateway.close();
  }
});

// POST /cti - Create new CTI (Phase 4)
router.post('/cti', loadFabricIdentity, async (req, res) => {
  try {
    const { id, title, description, status, priority, category, assignedTo, metadata } = req.body;
    
    const network = req.gateway.getNetwork(req.query.channel || 'mychannel');
    const contract = network.getContract('cti');
    
    // Submit transaction (writes to ledger)
    await contract.submitTransaction(
      'CreateCTI',
      id,
      title,
      description,
      status,
      priority,
      category,
      assignedTo,
      JSON.stringify(metadata || {})
    );
    
    res.json({ success: true, message: 'CTI created successfully', ctiId: id });
  } catch (error) {
    console.error('Failed to create CTI:', error);
    res.status(500).json({ error: error.message });
  } finally {
    req.gateway.close();
  }
});

// PUT /cti/:id - Update CTI
router.put('/cti/:id', loadFabricIdentity, async (req, res) => {
  try {
    const { title, description, status, priority, category, assignedTo, metadata } = req.body;
    
    const network = req.gateway.getNetwork(req.query.channel || 'mychannel');
    const contract = network.getContract('cti');
    
    await contract.submitTransaction(
      'UpdateCTI',
      req.params.id,
      title,
      description,
      status,
      priority,
      category,
      assignedTo,
      JSON.stringify(metadata || {})
    );
    
    res.json({ success: true, message: 'CTI updated successfully' });
  } catch (error) {
    console.error('Failed to update CTI:', error);
    res.status(500).json({ error: error.message });
  } finally {
    req.gateway.close();
  }
});

// DELETE /cti/:id - Delete CTI
router.delete('/cti/:id', loadFabricIdentity, async (req, res) => {
  try {
    const network = req.gateway.getNetwork(req.query.channel || 'mychannel');
    const contract = network.getContract('cti');
    
    await contract.submitTransaction('DeleteCTI', req.params.id);
    
    res.json({ success: true, message: 'CTI deleted successfully' });
  } catch (error) {
    console.error('Failed to delete CTI:', error);
    res.status(500).json({ error: error.message });
  } finally {
    req.gateway.close();
  }
});

// GET /cti/:id/history - Get CTI history
router.get('/cti/:id/history', loadFabricIdentity, async (req, res) => {
  try {
    const network = req.gateway.getNetwork(req.query.channel || 'mychannel');
    const contract = network.getContract('cti');
    
    const resultBytes = await contract.evaluateTransaction('GetCTIHistory', req.params.id);
    const history = JSON.parse(resultBytes.toString());
    
    res.json({ success: true, data: history });
  } catch (error) {
    console.error('Failed to get CTI history:', error);
    res.status(500).json({ error: error.message });
  } finally {
    req.gateway.close();
  }
});

// GET /cti/query/status/:status - Query by status
router.get('/cti/query/status/:status', loadFabricIdentity, async (req, res) => {
  try {
    const network = req.gateway.getNetwork(req.query.channel || 'mychannel');
    const contract = network.getContract('cti');
    
    const resultBytes = await contract.evaluateTransaction(
      'QueryCTIsByStatus',
      req.params.status
    );
    const ctis = JSON.parse(resultBytes.toString());
    
    res.json({ success: true, data: ctis });
  } catch (error) {
    console.error('Failed to query CTIs:', error);
    res.status(500).json({ error: error.message });
  } finally {
    req.gateway.close();
  }
});

// GET /cti/query/priority/:priority - Query by priority
router.get('/cti/query/priority/:priority', loadFabricIdentity, async (req, res) => {
  try {
    const network = req.gateway.getNetwork(req.query.channel || 'mychannel');
    const contract = network.getContract('cti');
    
    const resultBytes = await contract.evaluateTransaction(
      'QueryCTIsByPriority',
      req.params.priority
    );
    const ctis = JSON.parse(resultBytes.toString());
    
    res.json({ success: true, data: ctis });
  } catch (error) {
    console.error('Failed to query CTIs:', error);
    res.status(500).json({ error: error.message });
  } finally {
    req.gateway.close();
  }
});

// POST /cti/:id/documents - Add document reference
router.post('/cti/:id/documents', loadFabricIdentity, async (req, res) => {
  try {
    const { documentRef } = req.body;
    
    const network = req.gateway.getNetwork(req.query.channel || 'mychannel');
    const contract = network.getContract('cti');
    
    await contract.submitTransaction('AddDocumentReference', req.params.id, documentRef);
    
    res.json({ success: true, message: 'Document reference added' });
  } catch (error) {
    console.error('Failed to add document:', error);
    res.status(500).json({ error: error.message });
  } finally {
    req.gateway.close();
  }
});

module.exports = router;
```

## Frontend Integration Example

### React/JavaScript Client

```javascript
// CTI Service
class CTIService {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  async getAllCTIs(channel = 'mychannel') {
    const response = await fetch(`${this.baseURL}/cti?channel=${channel}`, {
      credentials: 'include', // Include session cookie
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('jwt')}`
      }
    });
    return response.json();
  }

  async getCTI(id, channel = 'mychannel') {
    const response = await fetch(`${this.baseURL}/cti/${id}?channel=${channel}`, {
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('jwt')}`
      }
    });
    return response.json();
  }

  async createCTI(ctiData, channel = 'mychannel') {
    const response = await fetch(`${this.baseURL}/cti?channel=${channel}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('jwt')}`
      },
      body: JSON.stringify(ctiData)
    });
    return response.json();
  }

  async updateCTI(id, ctiData, channel = 'mychannel') {
    const response = await fetch(`${this.baseURL}/cti/${id}?channel=${channel}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('jwt')}`
      },
      body: JSON.stringify(ctiData)
    });
    return response.json();
  }

  async getCTIHistory(id, channel = 'mychannel') {
    const response = await fetch(`${this.baseURL}/cti/${id}/history?channel=${channel}`, {
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('jwt')}`
      }
    });
    return response.json();
  }

  async queryCTIsByStatus(status, channel = 'mychannel') {
    const response = await fetch(`${this.baseURL}/cti/query/status/${status}?channel=${channel}`, {
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('jwt')}`
      }
    });
    return response.json();
  }
}

// Usage in React component
const CTIList = () => {
  const [ctis, setCTIs] = useState([]);
  const ctiService = new CTIService('http://localhost:3000/api');

  useEffect(() => {
    async function loadCTIs() {
      try {
        const result = await ctiService.getAllCTIs();
        if (result.success) {
          setCTIs(result.data);
        }
      } catch (error) {
        console.error('Failed to load CTIs:', error);
      }
    }
    loadCTIs();
  }, []);

  return (
    <div>
      {ctis.map(cti => (
        <CTICard key={cti.id} cti={cti} />
      ))}
    </div>
  );
};
```

## Error Handling

```javascript
// Common error handler middleware
function handleChaincodError(error) {
  if (error.message.includes('access denied')) {
    return { status: 403, message: 'Access denied' };
  }
  if (error.message.includes('does not exist')) {
    return { status: 404, message: 'CTI not found' };
  }
  if (error.message.includes('already exists')) {
    return { status: 409, message: 'CTI already exists' };
  }
  return { status: 500, message: 'Internal server error' };
}
```

## Environment Configuration

```env
# .env file
FABRIC_PEER_ENDPOINT=localhost:7051
FABRIC_PEER_HOST_ALIAS=peer0.org1.example.com
FABRIC_TLS_CERT_PATH=./crypto/org1/peer/tls/ca.crt
FABRIC_DEFAULT_CHANNEL=mychannel
FABRIC_CHAINCODE_NAME=cti
```

## Connection Pooling (Optional for Better Performance)

```javascript
// Gateway pool for reusing connections
class GatewayPool {
  constructor(maxConnections = 10) {
    this.pool = [];
    this.maxConnections = maxConnections;
  }

  async acquire(identity) {
    // Get or create gateway connection
    // ... implementation
  }

  release(gateway) {
    // Return gateway to pool
    // ... implementation
  }
}
```

## Testing Backend Integration

```javascript
// Jest test example
describe('CTI API Integration', () => {
  it('should create a CTI', async () => {
    const ctiData = {
      id: 'TEST001',
      title: 'Test CTI',
      description: 'Test description',
      status: 'OPEN',
      priority: 'HIGH',
      category: 'Test',
      assignedTo: 'test@org1',
      metadata: { test: 'value' }
    };

    const response = await request(app)
      .post('/api/cti')
      .set('Cookie', sessionCookie)
      .send(ctiData);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
```

## Complete Flow Alignment with Phases

This integration directly implements **Phase 5** from your sequence diagrams:

1. User opens ManageView/Timeline/Graph (Frontend)
2. Frontend requests CTI data via GET /cti
3. Backend loads session identity (from Phase 3 login)
4. Backend connects to Fabric Gateway with user's certificate and key
5. Gateway evaluates transaction on peers
6. Peers execute chaincode query
7. Chaincode checks role-based access and returns data
8. Backend returns data to frontend
9. Frontend displays CTI in UI

This maintains the complete security model where each user's blockchain identity is used for all transactions.

