# Newsroom Blockchain User Manual

**(Login, Credentials, Setup & Usage Guide)**

---

## 1. Executive Summary

The **Newsroom Blockchain System** is a **private, permissioned blockchain platform** designed to function as a **trusted, immutable, and auditable system of record** for Newsroom case management across one or more organizations. The system addresses environments where **data integrity, accountability, traceability, and controlled collaboration** are essential.

By leveraging cryptographic identities, smart contract–enforced logic, and a distributed ledger architecture, the system ensures that every action taken—whether creating, updating, or reviewing a case—is **verifiable, time-stamped, and permanently recorded**.

Unlike traditional applications, the Newsroom Blockchain System does **not** rely on:

* Public websites or browser-based login pages 


* Usernames and passwords 


* Manual credential handling 



Instead, access is governed through **strong cryptographic identities** issued to approved users and organizations. Authentication and authorization are enforced **automatically at the protocol level** on every transaction, eliminating common security risks such as credential reuse, phishing, or unauthorized access.

### Operational Perspective

The system is designed to be **simple for end users**. Daily usage follows a clear and intuitive workflow—accessing a secured environment, creating and updating Newsroom cases, attaching supporting documentation, and reviewing complete audit histories—without requiring any blockchain or cryptographic expertise.

### Governance and Compliance

The system provides exceptionally strong assurances:

* Records cannot be modified, deleted, or overwritten 


* Audit trails are complete, immutable, and non-repudiable 


* Organizational and role-based boundaries are strictly enforced 


* Invalid access, incorrect data, and duplicate records are automatically rejected 


* All actions and failures are traceable 



The system is supported by a **comprehensive automated testing and validation framework**, providing objective evidence that it is **secure, reliable, and production-ready**.

### Summary of Delivery

* A **single source of truth** for Newsroom case lifecycle management 


* Security by design, enforced at the protocol and smart contract levels 


* 
**Operational simplicity** for non-technical users 


* 
**Full transparency and accountability** for audits and investigations 


* Audit-readiness as a built-in property, not an afterthought 



---

## 2. Introduction

The **Newsroom Blockchain System** is a **private, permissioned blockchain platform** designed to provide a **trusted, immutable, and auditable system of record** for Newsroom case management across multiple organizations. It ensures every action is **cryptographically verifiable, time-stamped, and permanently recorded**.

### Purpose and Scope

The primary purpose is to act as a **single source of truth** for Newsroom cases throughout their entire lifecycle, including creation, modification, review, escalation, resolution, and closure.

Specifically, the system is used to:

* 
**Create and register Newsroom cases** as authoritative on-chain records 


* 
**Track all state changes** in a transparent and immutable manner 


* Maintain a complete historical audit trail (who, when, and what) 


* Enable secure collaboration while enforcing strict organizational boundaries 



Once a record is committed, it **cannot be altered, deleted, or overwritten**; subsequent changes are recorded as new, traceable transactions.

### Architectural Model

The system operates as a **closed, permissioned network**. Key characteristics include:

* No public endpoints or anonymous access 


* Identity-based interaction using digital certificates 


* Smart contract–driven business logic 


* Distributed ledger replication across authorized organizations 


* Consensus-backed transaction finality 



### Access and Authentication Model

Access is governed by a **strong cryptographic identity model**. These identities are:

* Bound to a specific organization 


* Enforced through secure credentials 


* Verified automatically on every transaction 



### Trust, Integrity, and Auditability

Trust is established through **cryptographic proof**. Every transaction is digitally signed, validated against business rules, and committed through consensus. This results in an **immutable audit trail** suitable for internal and external regulatory scrutiny.

### Core Principles

* 
**Immutability by default** – history is preserved 


* 
**Least-privilege access** – authorized actions only 


* 
**Transparency with control** – shared visibility without leakage 


* 
**Security-first architecture** – protocol-level protection 


* 
**Operational simplicity** – no blockchain expertise required 



---

## 3. Login Information

### Authentication Model Overview

The system employs a **non-interactive, identity-based authentication model**. Users do not "log in" using traditional usernames and passwords; instead, they **operate under a verified digital identity** enforced automatically for every interaction.

### Comparison with Traditional Login Models

| Traditional Application Model | Newsroom Blockchain Model |
| --- | --- |
| Web-based login page | Secure terminal or pre-configured client access 

 |
| Username and password | Digital certificate (X.509 identity) 

 |
| Session-based authentication | Transaction-level identity verification 

 |
| Password reset / recovery | Identity revocation and re-issuance 

 |
| Trust in application backend | Trust enforced by cryptographic verification 

 |

### Secure Access Method

Access is performed by connecting to a **secured server environment** provisioned by the technical operations team.

* Encrypted communication channels 


* Restricted network access 


* Pre-configured environment with credentials installed at the system level 


* Users authenticate implicitly by operating within this environment 



### Identity Lifecycle Management

Traditional "forgot password" mechanisms do not apply. Identities are issued by an authorized authority and can be **revoked instantly**. New access requires identity re-issuance.

---

## 4. Login URL / Access Location

The Newsroom Blockchain System **does not expose a public login URL** or web interface.

### Server-Based Access

Authorized users connect to a **dedicated server environment**. Each user receives:

* A **private server IP address** or hostname 


* An **approved access method** (e.g., SSH or a pre-configured terminal) 



> 
> **Example Access Command:** `ssh newsroom-user@<PRIVATE_SERVER_IP>` 
> 
> 

### Network Restrictions

The server IP is **not publicly accessible** and is protected by:

* Firewall rules 


* Network Access Control Lists (ACLs) 


* VPN requirements or IP allowlisting 



---

## 5. Credentials Required

### Credential Management Philosophy

End users are **not required to manually manage credentials**. All cryptographic material is provisioned and installed by the technical operations team.

### Internal Components

* 
**Digital Certificate (X.509):** Uniquely identifies the user and organization.


* 
**Private Key:** Used to sign transactions and prove ownership.


* 
**Organizational Identity:** Determines data visibility and boundaries.



### Access Revocation

If access is revoked, credentials are invalidated immediately. Interactions are blocked at the network level, and no manual logout is required.

---

## 6. Initial Setup (Already Done for Users)

All foundational setup activities are performed by the technical operations team prior to user access.

**Components pre-configured include:**

* 
**Blockchain Network Setup:** Peers, orderers, and channels.


* 
**Smart Contract (Chaincode) Deployment:** Business logic and validation rules.


* 
**Organization Identity Configuration:** MSPs and boundaries.


* 
**Secure Certificate Installation:** Cryptographic keys.



Users interact exclusively with approved operational interfaces once validation is complete.

---

## 7. Verifying Successful Login

Users should verify their identity before performing operations.

### Verification Command

Execute the following read-only command:


`query_Newsroom '{"function":"GetMyIdentity","Args":[]}'` 

### Expected Output

A successful response includes:

* 
**Organization Identifier** (e.g., Org1) 


* 
**Recognized Identity** (Confirmed certificate) 


* 
**Access Permissions** (Associated roles) 



If the command fails, access has not been established and operations should not be attempted.

---

## 8. How to Use the System (Daily Operations)

All actions are executed as **authenticated blockchain transactions**.

### 8.1 Create a New Newsroom Case

Establishes an authoritative on-chain record.
**Command:**

```json
invoke_Newsroom '{"function":"CreateCTI","Args":["CTI-001","Title","Desc","OPEN","HIGH","Category","user@org1","{}"]}'

```



### 8.2 View a Newsroom Case

Retrieves the **latest committed state** of a case.
**Command:**
`query_Newsroom '{"function":"ReadCTI","Args":["CTI-001"]}'` 

### 8.3 Update Case Status

Creates a **new versioned state** linked to the original case.
**Command:**

```json
invoke_Newsroom '{"function":"UpdateCTI","Args":["CTI-001","Updated Title","Updated Desc","IN_PROGRESS","CRITICAL","Category","user@org1","{}"]}'

```



### 8.4 Attach Documents (References)

References are recorded **on-chain**, while files are stored **off-chain**.
**Command:**
`invoke_Newsroom '{"function":"AddDocumentReference","Args":["CTI-001","report.pdf"]}'` 

### 8.5 View Full Audit History

Retrieves the chronological sequence of all state transitions.
**Command:**
`query_Newsroom '{"function":"GetCTIHistory","Args":["CTI-001"]}'` 

---

## 9. Reports & Test Validation

The system's correctness is systematically tested and documented.

### Available Report Types

* 
**Functional Test Reports:** Business logic verification.


* 
**Security Validation Reports:** Identity and access boundaries.


* 
**Audit Confirmation Reports:** Proof of immutability.


* 
**Performance Benchmarks:** System behavior under load.



All testing procedures are detailed in the **Complete Testing Guide for Newsroom Chaincode**.

---

## 10. Error Handling & Safety

Safety is **enforced by default** at the protocol level.

* 
**Access Control:** Unauthorized requests never reach application logic.


* 
**Data Validation:** Malformed data is rejected deterministically.


* 
**Duplicate Prevention:** Unique constraints are enforced on case identifiers.


* 
**Failure Logging:** All failed actions are logged and traceable.


* 
**Strict Immutability:** No user can modify or delete past records.



---

## 11. Key Takeaways (For Non-Technical Users)

* 
**No website login required:** No public portals.


* 
**No password management:** No resetting or remembering passwords.


* 
**Secure access only:** Verified identities only.


* 
**Easy daily usage:** Focus on case management workflows.


* 
**Full transparency:** All actions are time-stamped and traceable.


*
**Audit-ready:** Immutable trails are built-in.


---

## 12. Simplified User Guide

### For Non-Technical Users: Getting Started in 5 Minutes

**Welcome to the Newsroom Blockchain System!** This guide shows you how to use the system without any technical knowledge.

#### Step 1: Access the System
- Connect to your assigned server (your IT team will provide the details)
- No passwords needed - your identity is automatically verified

#### Step 2: Verify You're Connected
Run this simple check:
```bash
query_Newsroom'{"function":"GetMyIdentity","Args":[]}'
```
If you see your organization and permissions, you're ready to go!

#### Step 3: Create Your First Case
To create a new case, use:
```bash
invoke_Newsroom'{"function":"CreateCTI","Args":[
  "CTI-001",
  "Case Title",
  "Brief description of the case",
  "OPEN",
  "HIGH",
  "Category",
  "your-identity",
  "{}"
]}'
```

#### Step 4: Update Case Progress
When the case status changes:
```bash
invoke_Newsroom'{"function":"UpdateCTI","Args":[
  "CTI-001",
  "Updated Case Title",
  "Updated description with new findings",
  "IN_PROGRESS",
  "CRITICAL",
  "Category",
  "your-identity",
  "{}"
]}'
```

#### Step 5: View Case History
Check the complete audit trail:
```bash
query_Newsroom'{"function":"GetCTIHistory","Args":["CTI-001"]}'
```

### Quick Reference Commands

| Action | Command Example |
|--------|----------------|
| **Check Access** | `query_Newsroom'{"function":"GetMyIdentity","Args":[]}'` |
| **Create Case** | `invoke_Newsroom'{"function":"CreateCTI","Args":["ID","Title","Desc","OPEN","HIGH","Cat","user","{}"]}'` |
| **View Case** | `query_Newsroom'{"function":"ReadCTI","Args":["CTI-001"]}'` |
| **Update Case** | `invoke_Newsroom'{"function":"UpdateCTI","Args":["ID","Title","Desc","STATUS","PRIORITY","Cat","user","{}"]}'` |
| **Add Document** | `invoke_Newsroom'{"function":"AddDocumentReference","Args":["CTI-001","document.pdf"]}'` |
| **View History** | `query_Newsroom'{"function":"GetCTIHistory","Args":["CTI-001"]}'` |

### Status Options
- **OPEN**: New case
- **IN_PROGRESS**: Being worked on
- **CLOSED**: Case resolved
- **ESCALATED**: Needs higher attention

### Priority Levels
- **LOW**: Routine matter
- **MEDIUM**: Standard priority
- **HIGH**: Important case
- **CRITICAL**: Urgent attention required

---

## 13. Code Examples for Chaincode Functionality

### Prerequisites
Before running these examples, ensure you have:
- Access to the Newsroom Blockchain network
- Valid digital certificate installed
- Connection to the secured server environment

### 1. Verify Your Identity
```bash
# Check your current identity and permissions
peer chaincode query -C newsroomchannel -n newsroom -c '{"function":"GetMyIdentity","Args":[]}'
```

**Expected Response:**
```json
{
  "organization": "Org1",
  "identity": "user@org1",
  "permissions": ["CREATE", "UPDATE", "READ"],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 2. Create a New CTI Case
```bash
# Create a new case with basic information
peer chaincode invoke -C newsroomchannel -n newsroom -c '{
  "function":"CreateCTI",
  "Args":[
    "CTI-2024-001",
    "Suspicious Network Activity",
    "Detected unusual traffic patterns from IP 192.168.1.100",
    "OPEN",
    "HIGH",
    "Cybersecurity",
    "analyst@org1",
    "{}"
  ]
}'
```

**Parameters:**
- `CTI-2024-001`: Unique case identifier
- `Suspicious Network Activity`: Case title
- Case description
- `OPEN`: Initial status
- `HIGH`: Priority level
- `Cybersecurity`: Category
- `analyst@org1`: Assigned user
- `{}`: Additional metadata (JSON)

### 3. Query a Specific Case
```bash
# Retrieve current state of a case
peer chaincode query -C newsroomchannel -n newsroom -c '{
  "function":"ReadCTI",
  "Args":["CTI-2024-001"]
}'
```

**Sample Response:**
```json
{
  "id": "CTI-2024-001",
  "title": "Suspicious Network Activity",
  "description": "Detected unusual traffic patterns from IP 192.168.1.100",
  "status": "OPEN",
  "priority": "HIGH",
  "category": "Cybersecurity",
  "assignedTo": "analyst@org1",
  "organization": "Org1",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### 4. Update Case Status
```bash
# Update case with new findings
peer chaincode invoke -C newsroomchannel -n newsroom -c '{
  "function":"UpdateCTI",
  "Args":[
    "CTI-2024-001",
    "Suspicious Network Activity - Investigation Started",
    "Initial analysis shows potential malware infection. Escalating to security team.",
    "IN_PROGRESS",
    "CRITICAL",
    "Cybersecurity",
    "security-team@org1",
    "{\"escalation_reason\": \"Potential malware detected\", \"affected_systems\": [\"server-01\", \"server-02\"]}"
  ]
}'
```

### 5. Add Document References
```bash
# Link supporting documents to the case
peer chaincode invoke -C newsroomchannel -n newsroom -c '{
  "function":"AddDocumentReference",
  "Args":[
    "CTI-2024-001",
    "malware-analysis-report.pdf"
  ]
}'

# Add multiple documents
peer chaincode invoke -C newsroomchannel -n newsroom -c '{
  "function":"AddDocumentReference",
  "Args":[
    "CTI-2024-001",
    "network-logs-2024-01-15.txt"
  ]
}'
```

### 6. View Complete Audit History
```bash
# Get full chronological history of the case
peer chaincode query -C newsroomchannel -n newsroom -c '{
  "function":"GetCTIHistory",
  "Args":["CTI-2024-001"]
}'
```

**Sample History Response:**
```json
[
  {
    "timestamp": "2024-01-15T10:30:00Z",
    "action": "CREATE",
    "user": "analyst@org1",
    "organization": "Org1",
    "changes": {
      "status": "OPEN",
      "priority": "HIGH"
    }
  },
  {
    "timestamp": "2024-01-15T11:45:00Z",
    "action": "UPDATE",
    "user": "security-team@org1",
    "organization": "Org1",
    "changes": {
      "status": "IN_PROGRESS",
      "priority": "CRITICAL",
      "assignedTo": "security-team@org1"
    }
  }
]
```

### 7. Batch Operations Example
```bash
# Create multiple cases in sequence
CASES=(
  '["CTI-2024-002","Data Breach Investigation","Customer data potentially compromised","OPEN","CRITICAL","Data Security","investigator@org1","{}"]'
  '["CTI-2024-003","Phishing Campaign","Mass phishing emails detected","OPEN","MEDIUM","Social Engineering","analyst@org1","{}"]'
)

for case_data in "${CASES[@]}"; do
  peer chaincode invoke -C newsroomchannel -n newsroom -c "{\"function\":\"CreateCTI\",\"Args\":$case_data}"
  sleep 2  # Allow for consensus
done
```

### 8. Error Handling Examples
```bash
# Attempt to access unauthorized case (will fail)
peer chaincode query -C newsroomchannel -n newsroom -c '{
  "function":"ReadCTI",
  "Args":["CTI-ORG2-001"]
}'

# Attempt to create case with duplicate ID (will fail)
peer chaincode invoke -C newsroomchannel -n newsroom -c '{
  "function":"CreateCTI",
  "Args":[
    "CTI-2024-001",  # This ID already exists
    "Duplicate Case",
    "This should fail",
    "OPEN",
    "LOW",
    "Test",
    "user@org1",
    "{}"
  ]
}'
```

### 9. Node.js Client Example
```javascript
const { Gateway, Wallets } = require('fabric-network');
const path = require('path');

async function createCTI() {
    try {
        // Load connection profile
        const ccpPath = path.resolve(__dirname, '..', 'connection-org1.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        // Create wallet
        const wallet = await Wallets.newFileSystemWallet('./wallet');

        // Create gateway
        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: 'user@org1',
            discovery: { enabled: true, asLocalhost: false }
        });

        // Get network and contract
        const network = await gateway.getNetwork('newsroomchannel');
        const contract = network.getContract('newsroom');

        // Create CTI
        const result = await contract.submitTransaction('CreateCTI',
            'CTI-2024-004',
            'System Vulnerability',
            'Critical security vulnerability discovered',
            'OPEN',
            'CRITICAL',
            'Security',
            'admin@org1',
            '{}'
        );

        console.log('CTI created successfully:', result.toString());

    } catch (error) {
        console.error('Failed to create CTI:', error);
    }
}
```

### 10. Python Client Example
```python
import json
from hfc.fabric import Client
from hfc.fabric_network import Wallet

def create_cti_case():
    try:
        # Initialize client
        client = Client(net_profile="connection-org1.json")

        # Get wallet
        wallet = Wallet('./wallet')
        user_identity = wallet.get('user@org1')

        # Create channel instance
        channel = client.new_channel('newsroomchannel')

        # Create CTI case
        args = [
            'CTI-2024-005',
            'Compliance Violation',
            'Regulatory compliance issue identified',
            'OPEN',
            'HIGH',
            'Compliance',
            'auditor@org1',
            '{}'
        ]

        response = channel.send_transaction(
            chaincode_id='newsroom',
            tx_args=args,
            fcn='CreateCTI'
        )

        print('CTI created successfully')

    except Exception as e:
        print(f'Error creating CTI: {e}')

# Usage
create_cti_case()
```

---

## 14. Deployment Instructions and Configuration

### System Prerequisites

#### Hardware Requirements
- **Orderer Nodes**: 3+ nodes (for consensus), 4GB RAM each, 100GB storage
- **Peer Nodes**: 2+ per organization, 8GB RAM each, 500GB storage
- **Certificate Authority (CA)**: 1 per organization, 4GB RAM, 50GB storage
- **Database**: CouchDB or LevelDB for world state

#### Software Requirements
- **Hyperledger Fabric**: Version 2.2+ or 2.4+
- **Docker**: Version 20.10+
- **Docker Compose**: Version 1.29+
- **Go**: Version 1.18+ (for chaincode development)
- **Node.js**: Version 14+ (optional, for client applications)

#### Network Requirements
- **Firewall**: Open ports 7050-7054 for peer communication
- **TLS**: Required for all network traffic
- **DNS**: Internal DNS resolution for all nodes

### Step-by-Step Deployment Guide

#### Phase 1: Network Setup

1. **Generate Cryptographic Materials**
```bash
# Create crypto-config directory
mkdir crypto-config

# Generate certificates using cryptogen
cryptogen generate --config=./crypto-config.yaml --output=./crypto-config

# Or use Fabric CA for production
fabric-ca-server start -b admin:adminpw
```

2. **Create Genesis Block**
```bash
# Generate genesis block for orderer
configtxgen -profile TwoOrgsOrdererGenesis \
  -channelID system-channel \
  -outputBlock ./channel-artifacts/genesis.block
```

3. **Start the Network**
```bash
# Start all services
docker-compose -f docker-compose.yaml up -d

# Verify network
docker ps
docker logs orderer.example.com
```

#### Phase 2: Channel Creation

1. **Create Application Channel**
```bash
# Generate channel configuration
configtxgen -profile TwoOrgsChannel \
  -outputCreateChannelTx ./channel-artifacts/channel.tx \
  -channelID newsroomchannel

# Create channel
peer channel create -o orderer.example.com:7050 \
  -c newsroomchannel \
  -f ./channel-artifacts/channel.tx \
  --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem
```

2. **Join Peers to Channel**
```bash
# Join Org1 peer
peer channel join -b newsroomchannel.block

# Join Org2 peer (from different terminal)
export CORE_PEER_LOCALMSPID="Org2MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp
export CORE_PEER_ADDRESS=peer0.org2.example.com:9051

peer channel join -b newsroomchannel.block
```

#### Phase 3: Chaincode Deployment

1. **Package Chaincode**
```bash
# Package the chaincode
peer lifecycle chaincode package newsroom.tar.gz \
  --path ./chaincode/cti \
  --lang golang \
  --label newsroom_1.0
```

2. **Install Chaincode**
```bash
# Install on Org1 peer
peer lifecycle chaincode install newsroom.tar.gz

# Install on Org2 peer
# (Run from Org2 environment)
peer lifecycle chaincode install newsroom.tar.gz
```

3. **Approve Chaincode**
```bash
# Get package ID
peer lifecycle chaincode queryinstalled

# Approve for Org1
peer lifecycle chaincode approveformyorg \
  -o orderer.example.com:7050 \
  --channelID newsroomchannel \
  --name newsroom \
  --version 1.0 \
  --package-id newsroom_1.0:PACKAGE_ID \
  --sequence 1 \
  --tls \
  --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem

# Approve for Org2 (similar command)
```

4. **Commit Chaincode**
```bash
# Check commit readiness
peer lifecycle chaincode checkcommitreadiness \
  --channelID newsroomchannel \
  --name newsroom \
  --version 1.0 \
  --sequence 1

# Commit chaincode
peer lifecycle chaincode commit \
  -o orderer.example.com:7050 \
  --channelID newsroomchannel \
  --name newsroom \
  --version 1.0 \
  --sequence 1 \
  --peerAddresses peer0.org1.example.com:7051 \
  --peerAddresses peer0.org2.example.com:9051 \
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt \
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt
```

#### Phase 4: User Setup and Testing

1. **Register Users**
```bash
# Register users with CA
fabric-ca-client register \
  --caname ca.org1.example.com \
  --id.name analyst@org1 \
  --id.secret password \
  --id.type client \
  --id.affiliation org1

# Enroll users
fabric-ca-client enroll \
  -u https://analyst@org1:password@localhost:7054 \
  --caname ca.org1.example.com \
  -M ./wallet/analyst@org1
```

2. **Configure Client Applications**
```bash
# Create connection profile
cat > connection-org1.json << EOF
{
  "name": "newsroom-network",
  "version": "1.0.0",
  "client": {
    "organization": "Org1",
    "connection": {
      "timeout": {
        "peer": {
          "endorser": "300"
        },
        "orderer": "300"
      }
    }
  },
  "organizations": {
    "Org1": {
      "mspid": "Org1MSP",
      "peers": ["peer0.org1.example.com"],
      "certificateAuthorities": ["ca.org1.example.com"]
    }
  },
  "peers": {
    "peer0.org1.example.com": {
      "url": "grpcs://localhost:7051",
      "tlsCACerts": {
        "path": "crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt"
      },
      "grpcOptions": {
        "ssl-target-name-override": "peer0.org1.example.com"
      }
    }
  }
}
EOF
```

3. **Run Initial Tests**
```bash
# Test identity verification
peer chaincode query -C newsroomchannel -n newsroom -c '{"function":"GetMyIdentity","Args":[]}'

# Create test case
peer chaincode invoke -C newsroomchannel -n newsroom -c '{
  "function":"CreateCTI",
  "Args":[
    "TEST-001",
    "Test Case",
    "Initial deployment test",
    "OPEN",
    "LOW",
    "Testing",
    "admin@org1",
    "{}"
  ]
}'
```

### Configuration Files

#### docker-compose.yaml (Sample)
```yaml
version: '2.4'

networks:
  newsroom:

services:
  orderer.example.com:
    container_name: orderer.example.com
    image: hyperledger/fabric-orderer:2.4
    environment:
      - ORDERER_GENERAL_LOGLEVEL=INFO
      - ORDERER_GENERAL_LISTENADDRESS=0.0.0.0
      - ORDERER_GENERAL_GENESISMETHOD=file
      - ORDERER_GENERAL_GENESISFILE=/var/hyperledger/orderer/orderer.genesis.block
    volumes:
      - ./channel-artifacts/genesis.block:/var/hyperledger/orderer/orderer.genesis.block
      - ./crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com:/var/hyperledger/orderer
    ports:
      - "7050:7050"
    networks:
      - newsroom

  peer0.org1.example.com:
    container_name: peer0.org1.example.com
    image: hyperledger/fabric-peer:2.4
    environment:
      - CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
      - CORE_PEER_ID=peer0.org1.example.com
      - CORE_PEER_ADDRESS=peer0.org1.example.com:7051
      - CORE_PEER_LISTENADDRESS=0.0.0.0:7051
      - CORE_PEER_CHAINCODEADDRESS=peer0.org1.example.com:7052
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:7052
      - CORE_PEER_GOSSIP_BOOTSTRAP=peer0.org1.example.com:7051
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.org1.example.com:7051
      - CORE_PEER_LOCALMSPID=Org1MSP
    volumes:
      - ./crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com:/etc/hyperledger/fabric
      - /var/run/docker.sock:/host/var/run/docker.sock
    ports:
      - "7051:7051"
    networks:
      - newsroom
```

#### crypto-config.yaml (Sample)
```yaml
PeerOrgs:
  - Name: Org1
    Domain: org1.example.com
    EnableNodeOUs: true
    Template:
      Count: 2
    Users:
      Count: 5

  - Name: Org2
    Domain: org2.example.com
    EnableNodeOUs: true
    Template:
      Count: 2
    Users:
      Count: 5

OrdererOrgs:
  - Name: Orderer
    Domain: example.com
    Specs:
      - Hostname: orderer
```

#### configtx.yaml (Sample)
```yaml
Organizations:
  - &OrdererOrg
    Name: OrdererOrg
    ID: OrdererMSP
    MSPDir: crypto-config/ordererOrganizations/example.com/msp

  - &Org1
    Name: Org1MSP
    ID: Org1MSP
    MSPDir: crypto-config/peerOrganizations/org1.example.com/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('Org1MSP.admin', 'Org1MSP.peer', 'Org1MSP.client')"
      Writers:
        Type: Signature
        Rule: "OR('Org1MSP.admin', 'Org1MSP.client')"
      Admins:
        Type: Signature
        Rule: "OR('Org1MSP.admin')"
      Endorsement:
        Type: Signature
        Rule: "OR('Org1MSP.peer')"

Capabilities:
  Channel: &ChannelCapabilities
    V2_0: true
  Orderer: &OrdererCapabilities
    V2_0: true
  Application: &ApplicationCapabilities
    V2_0: true

Application: &ApplicationDefaults
  Organizations:
  Policies:
    Readers:
      Type: ImplicitMeta
      Rule: "ANY Readers"
    Writers:
      Type: ImplicitMeta
      Rule: "ANY Writers"
    Admins:
      Type: ImplicitMeta
      Rule: "MAJORITY Admins"
    LifecycleEndorsement:
      Type: ImplicitMeta
      Rule: "MAJORITY Endorsement"
    Endorsement:
      Type: ImplicitMeta
      Rule: "MAJORITY Endorsement"

  Capabilities:
    <<: *ApplicationCapabilities

Channel: &ChannelDefaults
  Policies:
    Readers:
      Type: ImplicitMeta
      Rule: "ANY Readers"
    Writers:
      Type: ImplicitMeta
      Rule: "ANY Writers"
    Admins:
      Type: ImplicitMeta
      Rule: "MAJORITY Admins"

  Capabilities:
    <<: *ChannelCapabilities

Profiles:
  TwoOrgsOrdererGenesis:
    <<: *ChannelDefaults
    Orderer:
      <<: *OrdererDefaults
      Organizations:
        - *OrdererOrg
      Capabilities:
        <<: *OrdererCapabilities
    Consortiums:
      SampleConsortium:
        Organizations:
          - *Org1
          - *Org2

  TwoOrgsChannel:
    Consortium: SampleConsortium
    <<: *ChannelDefaults
    Application:
      <<: *ApplicationDefaults
      Organizations:
        - *Org1
        - *Org2
      Capabilities:
        <<: *ApplicationCapabilities
```

### Troubleshooting Common Issues

#### Chaincode Installation Issues
```bash
# Check chaincode logs
docker logs dev-peer0.org1.example.com-newsroom-1.0

# Verify chaincode package
peer lifecycle chaincode queryinstalled

# Check endorsement policy
peer lifecycle chaincode checkcommitreadiness \
  --channelID newsroomchannel \
  --name newsroom \
  --version 1.0 \
  --sequence 1
```

#### Network Connectivity Issues
```bash
# Test peer connectivity
peer channel list

# Check Docker network
docker network inspect newsroom

# Verify TLS certificates
openssl x509 -in crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/server.crt -text
```

### Security Considerations

1. **Certificate Management**: Rotate certificates regularly
2. **Network Security**: Use private networks and VPNs
3. **Access Control**: Implement least-privilege principles
4. **Audit Logging**: Enable comprehensive logging
5. **Backup Strategy**: Regular backups of ledger and certificates

### Maintenance Procedures

#### Regular Maintenance
- Monitor disk space usage
- Update certificates before expiration
- Review and update access policies
- Backup critical data regularly

#### Upgrade Procedures
1. Test upgrades in development environment
2. Backup all data and configurations
3. Update chaincode with new version
4. Migrate data if schema changes
5. Validate system functionality

This deployment guide provides a comprehensive foundation for setting up and maintaining the Newsroom Blockchain System in production environments.


**Final Note:** Users can focus on their tasks while the system automatically handles security and accountability in the background.
