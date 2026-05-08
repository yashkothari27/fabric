# CTI (Case Tracking Information) Chaincode

This is an **enterprise-grade Hyperledger Fabric chaincode** for managing Case Tracking Information with comprehensive security features including certificate validation, identity verification, role-based access control, and endorsement validation.

## 🔐 Security Features

- **✅ X.509 Certificate Validation** - Validates certificate expiry, validity period, and digital signature capability
- **✅ Identity Verification** - Extracts and validates complete user identity from certificates
- **✅ Transaction Signature Verification** - Verifies digital signatures on all write operations
- **✅ Role-Based Access Control (RBAC)** - 5 roles with granular permission matrix
- **✅ Organization-Based Access Control** - Data isolation by organization MSP ID
- **✅ Attribute-Based Access Control (ABAC)** - Optional fine-grained access using certificate attributes
- **✅ Endorsement Validation** - Validates transaction endorsers against required organizations
- **✅ Comprehensive Audit Logging** - Every operation logged with full context for compliance

📚 **See [SECURITY.md](SECURITY.md) for detailed security documentation**
📚 **See [ENDORSEMENT_POLICIES.md](ENDORSEMENT_POLICIES.md) for endorsement policy configuration**

## Features

- **Create, Read, Update, Delete (CRUD)** operations for CTI records with permission checks
- **Role-based access control** - 5 roles: Admin, Manager, Engineer, Viewer, Auditor
- **Rich queries** - query by status, priority, category, organization, assignee
- **History tracking** - view complete audit trail of changes to any CTI
- **Document references** - attach references to external documents
- **Metadata support** - flexible key-value metadata for each CTI
- **Identity management** - Get identity and permissions for any user

## Data Structure

### CTI Record
```json
{
  "id": "CTI001",
  "title": "Case Title",
  "description": "Detailed description",
  "status": "OPEN",
  "priority": "HIGH",
  "category": "Technical",
  "createdBy": "user@org1",
  "assignedTo": "engineer@org1",
  "organization": "Org1MSP",
  "createdAt": "2025-11-06T10:00:00Z",
  "updatedAt": "2025-11-06T10:00:00Z",
  "metadata": {
    "key1": "value1",
    "key2": "value2"
  },
  "documents": ["doc-ref-1", "doc-ref-2"]
}
```

### Valid Values

**Status**: `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`

**Priority**: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`

## Functions

### Initialize
- `InitLedger()` - Initialize ledger with sample data (optional, for testing)

### CRUD Operations
- `CreateCTI(id, title, description, status, priority, category, assignedTo, metadataJSON)` - Create a new CTI
- `ReadCTI(id)` - Retrieve a CTI by ID
- `UpdateCTI(id, title, description, status, priority, category, assignedTo, metadataJSON)` - Update an existing CTI
- `DeleteCTI(id)` - Delete a CTI
- `CTIExists(id)` - Check if a CTI exists

### Query Operations
- `GetAllCTIs()` - Get all CTIs accessible to the caller
- `QueryCTIsByStatus(status)` - Get CTIs by status
- `QueryCTIsByPriority(priority)` - Get CTIs by priority
- `QueryCTIsByCategory(category)` - Get CTIs by category
- `QueryCTIsByOrganization(organization)` - Get CTIs by organization
- `QueryCTIsByAssignee(assignedTo)` - Get CTIs assigned to a user

### History & Documents
- `GetCTIHistory(id)` - Get complete history of changes to a CTI
- `AddDocumentReference(id, documentRef)` - Add a document reference to a CTI

### Security & Identity Management
- `GetFullUserIdentity()` - Extract and validate complete user identity with certificate validation
- `GetMyIdentity()` - Get caller's full identity information
- `GetMyPermissions()` - Get list of permissions for caller's role
- `ValidateCertificate(certPEM)` - Validate an X.509 certificate
- `VerifyTransactionSignature()` - Verify digital signature of transaction
- `CheckPermission(permission)` - Validate if user has specific permission
- `CheckAttribute(attributeName, expectedValue)` - Verify certificate attribute value
- `AssertOrgMembership(allowedOrgs)` - Verify caller belongs to allowed organizations
- `ValidateEndorsement(requiredOrgs)` - Check transaction has proper endorsements
- `GetEndorsementInfo()` - Get transaction endorsement metadata

### Audit & Compliance
- `LogAuditEvent(eventType, resourceID, action)` - Log audit event for compliance tracking

## Access Control

The chaincode implements multi-layer access control with certificate validation, role-based permissions, and organization isolation.

### User Roles & Permissions

| Role | Create | Read | Update | Delete | Audit | Cross-Org Access |
|------|--------|------|--------|--------|-------|------------------|
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ All organizations |
| **Manager** | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ Own org only |
| **Engineer** | ✅ | ✅ | ✅ (own) | ❌ | ❌ | ❌ Own org only |
| **Viewer** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ Own org only |
| **Auditor** | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ All organizations |

### Security Layers

1. **Certificate Validation**: X.509 certificate expiry and validity checks
2. **Identity Verification**: Extract and validate identity from certificate
3. **Role-Based Access**: Permission matrix enforced for all operations
4. **Organization Isolation**: Data segregated by MSP ID
5. **Resource-Level Control**: Engineers can only modify CTIs they created or are assigned to
6. **Attribute-Based Control**: Optional fine-grained access using certificate attributes
7. **Audit Logging**: All operations logged with full context

Access is controlled by checking:
- Certificate validity and expiry
- User role from certificate attributes
- Organization MSP ID matching
- Resource-level permissions (creator/assignee for engineers)
- Transaction signature validation

## Installation & Deployment

### Prerequisites
- Go 1.21 or higher
- Hyperledger Fabric network (2.x)
- Fabric peer CLI tools

### Build
```bash
cd chaincode/cti
go mod tidy
go build
```

### Package Chaincode
```bash
peer lifecycle chaincode package cti.tar.gz \
  --path ./chaincode/cti \
  --lang golang \
  --label cti_1.0
```

### Install on Peer
```bash
peer lifecycle chaincode install cti.tar.gz
```

### Approve for Organization
```bash
export PACKAGE_ID=$(peer lifecycle chaincode queryinstalled --output json | jq -r '.installed_chaincodes[0].package_id')

peer lifecycle chaincode approveformyorg \
  --channelID mychannel \
  --name cti \
  --version 1.0 \
  --package-id $PACKAGE_ID \
  --sequence 1
```

### Commit Chaincode Definition
```bash
peer lifecycle chaincode commit \
  --channelID mychannel \
  --name cti \
  --version 1.0 \
  --sequence 1
```

## Usage Examples

### Create a CTI
```bash
peer chaincode invoke \
  -o orderer.example.com:7050 \
  -C mychannel \
  -n cti \
  -c '{"function":"CreateCTI","Args":["CTI001","System Down","Production system is down","OPEN","CRITICAL","Technical","engineer@org1","{\"severity\":\"critical\",\"impact\":\"high\"}"]}'
```

### Read a CTI
```bash
peer chaincode query \
  -C mychannel \
  -n cti \
  -c '{"function":"ReadCTI","Args":["CTI001"]}'
```

### Update CTI Status
```bash
peer chaincode invoke \
  -o orderer.example.com:7050 \
  -C mychannel \
  -n cti \
  -c '{"function":"UpdateCTI","Args":["CTI001","System Down","Production system is down","IN_PROGRESS","CRITICAL","Technical","engineer@org1","{}"]}'
```

### Query by Status
```bash
peer chaincode query \
  -C mychannel \
  -n cti \
  -c '{"function":"QueryCTIsByStatus","Args":["OPEN"]}'
```

### Get CTI History
```bash
peer chaincode query \
  -C mychannel \
  -n cti \
  -c '{"function":"GetCTIHistory","Args":["CTI001"]}'
```

### Get All CTIs
```bash
peer chaincode query \
  -C mychannel \
  -n cti \
  -c '{"function":"GetAllCTIs","Args":[]}'
```

## API Integration

When integrating with your backend (as per Phase 5), use the Fabric Gateway SDK:

```javascript
// Example Node.js integration
const contract = network.getContract('cti');

// Create CTI
await contract.submitTransaction(
  'CreateCTI',
  'CTI001',
  'Title',
  'Description',
  'OPEN',
  'HIGH',
  'Technical',
  'engineer@org1',
  JSON.stringify({key: 'value'})
);

// Query CTI
const result = await contract.evaluateTransaction('ReadCTI', 'CTI001');
const cti = JSON.parse(result.toString());
```

## Testing

The chaincode can be tested using:

1. **Fabric Test Network**: Deploy on the test-network included with Fabric samples
2. **Unit Tests**: Add unit tests using the Fabric Contract API testing framework
3. **Integration Tests**: Test end-to-end flows with your backend application

## Security Considerations

1. **Identity Verification**: All transactions are authenticated using X.509 certificates
2. **Organization Isolation**: Users can only access their organization's data (unless admin)
3. **Audit Trail**: Complete history of all changes is maintained and queryable
4. **Input Validation**: All inputs are validated before processing
5. **Access Control**: Role-based access control enforced at chaincode level

## Customization

You can customize the access control logic in the `hasAccessToCTI()` function to implement:
- Cross-organization sharing
- Fine-grained role-based permissions
- Custom attribute-based access control
- Time-based access restrictions

## License

This chaincode is part of the CTI Management System project.

