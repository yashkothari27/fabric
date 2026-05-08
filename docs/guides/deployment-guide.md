# Complete Deployment & Testing Guide for CTI Chaincode

This guide provides step-by-step instructions to deploy and test the CTI (Case Tracking Information) chaincode on Hyperledger Fabric from scratch.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Install Hyperledger Fabric](#install-hyperledger-fabric)
4. [Deploy CTI Chaincode](#deploy-cti-chaincode)
5. [Test the Chaincode](#test-the-chaincode)
6. [Verify Security Features](#verify-security-features)
7. [Troubleshooting](#troubleshooting)
8. [Next Steps](#next-steps)

---

## Prerequisites

### System Requirements

- **Operating System**: Ubuntu 22.04 LTS (or compatible Linux)
- **RAM**: 4GB minimum, 8GB+ recommended
- **Disk Space**: 20GB free space minimum
- **CPU**: 2+ cores recommended

### Required Software

The following will be installed during setup:
- Docker 24.x
- Docker Compose
- Go 1.18+
- Git
- curl
- jq

---

## Environment Setup

### Step 1: Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### Step 2: Install Prerequisites

```bash
sudo apt install -y git curl jq tar
```

### Step 3: Install Docker (Fabric-Compatible Version)

**Important**: Use Docker 24.x for best compatibility with Fabric.

```bash
# Add Docker's official GPG key and repository
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update

# Install specific Docker version (24.0.9 is tested with Fabric)
sudo apt-get install -y \
  docker-ce=5:24.0.9-1~ubuntu.22.04~jammy \
  docker-ce-cli=5:24.0.9-1~ubuntu.22.04~jammy \
  containerd.io=1.6.33-1

# Enable and start Docker
sudo systemctl enable --now docker

# Add your user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify Docker installation
docker --version
docker ps
```

**Expected Output**: `Docker version 24.0.9` and empty container list.

### Step 4: Install Go

```bash
sudo apt install -y golang-go

# Verify Go installation
go version
```

**Expected Output**: `go version go1.18.1 linux/amd64` (or similar)

---

## Install Hyperledger Fabric

### Step 1: Create Fabric Directory

```bash
mkdir -p ~/fabric && cd ~/fabric
```

### Step 2: Download Fabric Binaries and Docker Images

```bash
curl -sSL https://bit.ly/2ysbOFE | bash
```

This script will:
- Clone `fabric-samples` repository
- Download Fabric binaries (peer, orderer, configtxgen, etc.)
- Pull Fabric Docker images

**Wait for completion** (may take 5-10 minutes depending on network speed).

### Step 3: Add Fabric Binaries to PATH

```bash
echo 'export PATH=$HOME/fabric/fabric-samples/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Verify peer CLI is available
peer version
```

**Expected Output**: Version information for Fabric peer.

### Step 4: Verify Fabric Installation

```bash
cd ~/fabric/fabric-samples/test-network
./network.sh up createChannel

# Check running containers
docker ps
```

**Expected Output**: 3 running containers:
- `orderer.example.com`
- `peer0.org1.example.com`
- `peer0.org2.example.com`

### Step 5: Shut Down Test Network (We'll Redeploy with CTI)

```bash
./network.sh down
```

---

## Deploy CTI Chaincode

### Step 1: Transfer CTI Chaincode to Server

**Option A: Using SCP (from your local machine)**

```bash
# From your local machine (Mac/Windows/Linux)
scp -r /path/to/chaincode/cti username@server-ip:~/fabric/fabric-samples/chaincode/
```

**Option B: Using Git (if in repository)**

```bash
# On the server
cd ~/fabric/fabric-samples/chaincode
git clone <your-cti-repository-url>
```

**Option C: Manual Upload**

Create the directory and upload files manually:

```bash
mkdir -p ~/fabric/fabric-samples/chaincode/cti
# Upload files via SFTP or file manager
```

### Step 2: Verify CTI Chaincode Files

```bash
cd ~/fabric/fabric-samples/chaincode/cti
ls -la
```

**Expected Files**:
```
cti_contract.go
main.go
go.mod
go.sum
README.md
SECURITY.md
ENDORSEMENT_POLICIES.md
INTEGRATION.md
scripts/
```

### Step 3: Fix Package Declaration (Important!)

The chaincode must use `package main` consistently:

```bash
cd ~/fabric/fabric-samples/chaincode/cti

# Verify cti_contract.go has "package main" at the top
head -n 1 cti_contract.go

# If it shows "package cti", change it:
sed -i 's/^package cti/package main/' cti_contract.go

# Remove test file to avoid package conflicts
rm -f cti_contract_test.go
```

### Step 4: Update Go Version for Compatibility

```bash
cd ~/fabric/fabric-samples/chaincode/cti

# Update go.mod to match installed Go version
sed -i 's/^go 1.21/go 1.18/' go.mod

# Download dependencies
go mod tidy

# Verify build works
go build ./...
```

**Expected Output**: No errors, successful build.

### Step 5: Start Fabric Network with Channel

```bash
cd ~/fabric/fabric-samples/test-network

# Bring up network and create mychannel
./network.sh up createChannel
```

**Expected Output**:
```
✔ Network fabric_test Created
✔ Container orderer.example.com Started
✔ Container peer0.org1.example.com Started
✔ Container peer0.org2.example.com Started
Channel 'mychannel' created
Channel 'mychannel' joined
```

### Step 6: Deploy CTI Chaincode

```bash
cd ~/fabric/fabric-samples/test-network

# Deploy the CTI chaincode
./network.sh deployCC -ccn cti -ccp ../chaincode/cti -ccl go
```

**Expected Output**:
```
Chaincode is packaged
Chaincode is installed on peer0.org1
Chaincode is installed on peer0.org2
Chaincode definition approved on peer0.org1 on channel 'mychannel'
Chaincode definition approved on peer0.org2 on channel 'mychannel'
Chaincode definition committed on channel 'mychannel'
Query chaincode definition successful on peer0.org1 on channel 'mychannel'
```

**Deployment Complete!** ✅

---

## Test the Chaincode

### Setup Test Environment

```bash
cd ~/fabric/fabric-samples/test-network

# Set up environment variables for Org1
export PATH=${PWD}/../bin:$PATH
export FABRIC_CFG_PATH=$PWD/../config/
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051
```

### Test 1: Initialize Ledger with Sample Data

```bash
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" \
  -C mychannel -n cti \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" \
  -c '{"function":"InitLedger","Args":[]}'
```

**Expected Output**:
```
2025-XX-XX XX:XX:XX.XXX UTC 0001 INFO [chaincodeCmd] chaincodeInvokeOrQuery -> Chaincode invoke successful. result: status:200
```

### Test 2: Query All CTIs

```bash
peer chaincode query -C mychannel -n cti \
  -c '{"function":"GetAllCTIs","Args":[]}'
```

**Expected Output**: JSON array with sample CTI (CTI001):
```json
[{"id":"CTI001","title":"System Integration Issue","description":"Integration between modules A and B failing","status":"OPEN","priority":"HIGH","category":"Technical","createdBy":"admin@org1","assignedTo":"engineer@org1","organization":"Org1MSP","createdAt":"...","updatedAt":"...","metadata":{"module":"integration","severity":"high"},"documents":[]}]
```

### Test 3: Create a New CTI

```bash
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" \
  -C mychannel -n cti \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" \
  -c '{"function":"CreateCTI","Args":["CTI002","Database Performance Issue","Database queries running slow","OPEN","CRITICAL","Technical","dba@org1","{\"database\":\"production\",\"impact\":\"high\"}"]}'
```

**Expected Output**: Transaction committed successfully.

### Test 4: Read Specific CTI

```bash
peer chaincode query -C mychannel -n cti \
  -c '{"function":"ReadCTI","Args":["CTI002"]}'
```

**Expected Output**: JSON object for CTI002.

### Test 5: Update CTI Status

```bash
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" \
  -C mychannel -n cti \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" \
  -c '{"function":"UpdateCTI","Args":["CTI002","Database Performance Issue","Query optimization applied","IN_PROGRESS","CRITICAL","Technical","dba@org1","{\"database\":\"production\",\"impact\":\"medium\"}"]}'
```

### Test 6: Query by Status

```bash
peer chaincode query -C mychannel -n cti \
  -c '{"function":"QueryCTIsByStatus","Args":["OPEN"]}'
```

**Expected Output**: Array of CTIs with status "OPEN".

### Test 7: Query by Priority

```bash
peer chaincode query -C mychannel -n cti \
  -c '{"function":"QueryCTIsByPriority","Args":["CRITICAL"]}'
```

**Expected Output**: Array of CTIs with priority "CRITICAL".

### Test 8: Get CTI History (Audit Trail)

```bash
peer chaincode query -C mychannel -n cti \
  -c '{"function":"GetCTIHistory","Args":["CTI002"]}'
```

**Expected Output**: Array showing all changes to CTI002 with transaction IDs and timestamps.

### Test 9: Add Document Reference

```bash
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" \
  -C mychannel -n cti \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" \
  -c '{"function":"AddDocumentReference","Args":["CTI002","doc-ref-001-troubleshooting-steps.pdf"]}'
```

### Test 10: Query by Organization

```bash
peer chaincode query -C mychannel -n cti \
  -c '{"function":"QueryCTIsByOrganization","Args":["Org1MSP"]}'
```

**Expected Output**: All CTIs belonging to Org1MSP.

---

## Verify Security Features

### Test Certificate Validation

The chaincode automatically validates:
- ✅ Certificate expiry
- ✅ Certificate validity period
- ✅ Digital signature capability
- ✅ Organization (MSP ID)
- ✅ Role from certificate attributes

All transactions use the identity from `Admin@org1.example.com` in test mode.

### Test Role-Based Access Control

**View Your Identity**:

```bash
# Note: This function may require role attribute in certificate
# In test-network, the Admin user may not have role attribute set
peer chaincode query -C mychannel -n cti \
  -c '{"function":"GetMyIdentity","Args":[]}'
```

**View Your Permissions**:

```bash
peer chaincode query -C mychannel -n cti \
  -c '{"function":"GetMyPermissions","Args":[]}'
```

### Test Organization Isolation

**Switch to Org2** and verify you can only see Org2's CTIs:

```bash
# Set environment for Org2
export CORE_PEER_LOCALMSPID="Org2MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp
export CORE_PEER_ADDRESS=localhost:9051

# Query all CTIs (should only show Org2's CTIs if any exist)
peer chaincode query -C mychannel -n cti \
  -c '{"function":"GetAllCTIs","Args":[]}'
```

**Switch back to Org1**:

```bash
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051
```

### Test Endorsement (Multi-Org Transaction)

The deployment already uses both organizations for endorsement. Verify:

```bash
peer lifecycle chaincode querycommitted --channelID mychannel --name cti
```

**Expected Output**:
```
Version: 1.0, Sequence: 1, Endorsement Plugin: escc, Validation Plugin: vscc, Approvals: [Org1MSP: true, Org2MSP: true]
```

---

## Advanced Testing

### Test Input Validation

**Invalid Status** (should fail):

```bash
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" \
  -C mychannel -n cti \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" \
  -c '{"function":"CreateCTI","Args":["CTI003","Test","Test","INVALID_STATUS","HIGH","Technical","user@org1","{}"]}'
```

**Expected**: Error message about invalid status.

**Empty Title** (should fail):

```bash
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" \
  -C mychannel -n cti \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" \
  -c '{"function":"CreateCTI","Args":["CTI003","","Test","OPEN","HIGH","Technical","user@org1","{}"]}'
```

**Expected**: Error message about empty title.

### Test Complex Queries

**Query by Category**:

```bash
peer chaincode query -C mychannel -n cti \
  -c '{"function":"QueryCTIsByCategory","Args":["Technical"]}'
```

**Query by Assignee**:

```bash
peer chaincode query -C mychannel -n cti \
  -c '{"function":"QueryCTIsByAssignee","Args":["engineer@org1"]}'
```

### Test Delete Operation

**Note**: Delete requires appropriate permissions.

```bash
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" \
  -C mychannel -n cti \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" \
  -c '{"function":"DeleteCTI","Args":["CTI002"]}'
```

**Verify deletion**:

```bash
peer chaincode query -C mychannel -n cti \
  -c '{"function":"CTIExists","Args":["CTI002"]}'
```

**Expected Output**: `false`

---

## Verify Security Features

### 1. Certificate Validation

All transactions automatically validate:
- Certificate expiry
- Certificate validity period
- Digital signature capability
- MSP ID (organization)

**No additional testing needed** - Fabric peer validates certificates before chaincode execution.

### 2. Identity Verification

Test identity extraction:

```bash
peer chaincode query -C mychannel -n cti \
  -c '{"function":"GetMyIdentity","Args":[]}'
```

**Expected Output**: UserIdentity object with clientId, mspId, role, etc.

### 3. Role-Based Permissions

The chaincode enforces this permission matrix:

| Role | Create | Read | Update | Delete | Audit |
|------|--------|------|--------|--------|-------|
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manager | ✅ | ✅ | ✅ | ❌ | ✅ |
| Engineer | ✅ | ✅ | ✅ (own) | ❌ | ❌ |
| Viewer | ❌ | ✅ | ❌ | ❌ | ❌ |
| Auditor | ❌ | ✅ | ❌ | ❌ | ✅ |

**Note**: In test-network, the default Admin user acts as admin role.

### 4. Organization Isolation

- Regular users: Can only access their organization's CTIs
- Admins/Auditors: Can access all organizations' CTIs

**Test**: Switch between Org1 and Org2 (see "Test Organization Isolation" above).

### 5. Audit Trail

Every operation is logged. View complete history:

```bash
peer chaincode query -C mychannel -n cti \
  -c '{"function":"GetCTIHistory","Args":["CTI001"]}'
```

**Expected Output**: Array of all changes with transaction IDs, timestamps, and values.

---

## Troubleshooting

### Issue 1: "peer: command not found"

**Solution**:
```bash
export PATH=$HOME/fabric/fabric-samples/bin:$PATH
export FABRIC_CFG_PATH=$PWD/../config/
```

### Issue 2: "Config File 'core' Not Found"

**Solution**:
```bash
cd ~/fabric/fabric-samples/test-network
export FABRIC_CFG_PATH=$PWD/../config/
```

### Issue 3: "connection refused" to localhost:7051

**Solution**: Network is not running.
```bash
cd ~/fabric/fabric-samples/test-network
./network.sh up createChannel
docker ps  # Verify containers are running
```

### Issue 4: "channel 'mychannel' not found"

**Solution**: Channel was not created.
```bash
./network.sh down
./network.sh up createChannel  # Note: 'createChannel' is required
```

### Issue 5: "namespace cti is not defined"

**Solution**: Chaincode not deployed.
```bash
./network.sh deployCC -ccn cti -ccp ../chaincode/cti -ccl go
```

### Issue 6: "docker build failed: broken pipe"

**Solution**: Downgrade to Docker 24.x (see Environment Setup).

### Issue 7: "found packages cti and main"

**Solution**: Ensure all Go files use `package main`:
```bash
cd ~/fabric/fabric-samples/chaincode/cti
sed -i 's/^package cti/package main/' cti_contract.go
rm -f cti_contract_test.go  # Remove test file
go build ./...
```

### Issue 8: "invalid go version"

**Solution**: Update go.mod:
```bash
cd ~/fabric/fabric-samples/chaincode/cti
sed -i 's/^go 1.21/go 1.18/' go.mod
go mod tidy
```

### Issue 9: Docker containers won't start

**Solution**:
```bash
sudo systemctl restart docker
docker ps
./network.sh down
./network.sh up createChannel
```

### Issue 10: Access Denied Errors

**Cause**: Organization mismatch or insufficient permissions.

**Solution**: 
- Verify you're using the correct organization's credentials
- Admins have access to all CTIs
- Regular users only access their org's CTIs

---

## Network Management

### Start Network

```bash
cd ~/fabric/fabric-samples/test-network
./network.sh up createChannel
```

### Stop Network

```bash
cd ~/fabric/fabric-samples/test-network
./network.sh down
```

### Restart Network (Preserves Data)

```bash
docker restart orderer.example.com peer0.org1.example.com peer0.org2.example.com
```

### View Logs

**Peer logs**:
```bash
docker logs peer0.org1.example.com
docker logs peer0.org2.example.com
```

**Orderer logs**:
```bash
docker logs orderer.example.com
```

**Chaincode logs**:
```bash
docker logs -f $(docker ps -q -f name=dev-peer0.org1.example.com-cti)
```

### Check Network Status

```bash
docker ps
peer channel list
peer lifecycle chaincode querycommitted -C mychannel
```

---

## Production Deployment Checklist

### Pre-Deployment

- [ ] Go version compatible (1.18+)
- [ ] Docker version 24.x or compatible
- [ ] All chaincode files present
- [ ] `package main` in all Go files
- [ ] `go mod tidy` completed without errors
- [ ] `go build ./...` succeeds

### Deployment Steps

- [ ] Network started: `./network.sh up createChannel`
- [ ] Containers running: `docker ps` shows 3 containers
- [ ] Chaincode deployed: `./network.sh deployCC ...`
- [ ] Chaincode committed on both orgs
- [ ] Query test successful

### Post-Deployment

- [ ] Initialize ledger (optional): `InitLedger()`
- [ ] Test all CRUD operations
- [ ] Verify access control works
- [ ] Check audit logging
- [ ] Document deployment details
- [ ] Set up monitoring/alerts

---

## Quick Reference Commands

### Environment Setup (Run First)

```bash
cd ~/fabric/fabric-samples/test-network
export PATH=${PWD}/../bin:$PATH
export FABRIC_CFG_PATH=$PWD/../config/
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051
```

### Common Invoke Template

```bash
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" \
  -C mychannel -n cti \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" \
  -c '{"function":"FUNCTION_NAME","Args":["ARG1","ARG2","..."]}'
```

### Common Query Template

```bash
peer chaincode query -C mychannel -n cti \
  -c '{"function":"FUNCTION_NAME","Args":["ARG1","ARG2"]}'
```

---

## Data Schema Reference

### Valid Status Values
- `OPEN`
- `IN_PROGRESS`
- `RESOLVED`
- `CLOSED`

### Valid Priority Values
- `LOW`
- `MEDIUM`
- `HIGH`
- `CRITICAL`

### CTI Fields

```json
{
  "id": "string (required, unique)",
  "title": "string (required, not empty)",
  "description": "string (required)",
  "status": "OPEN|IN_PROGRESS|RESOLVED|CLOSED (required)",
  "priority": "LOW|MEDIUM|HIGH|CRITICAL (required)",
  "category": "string (required)",
  "createdBy": "string (auto-populated from identity)",
  "assignedTo": "string (required)",
  "organization": "string (auto-populated from MSP ID)",
  "createdAt": "timestamp (auto-populated)",
  "updatedAt": "timestamp (auto-populated)",
  "metadata": "JSON object (optional, key-value pairs)",
  "documents": "array of strings (optional, document references)"
}
```

---

## Performance Tips

### 1. Use Query (evaluateTransaction) for Reads

Queries are faster because they don't go through consensus:
```bash
# Fast - read-only
peer chaincode query -C mychannel -n cti -c '...'

# Slow - uses consensus (only for writes)
peer chaincode invoke ... -c '...'
```

### 2. Batch Operations

Create multiple CTIs in one session to reuse connection setup.

### 3. Monitor Docker Resources

```bash
docker stats
```

Keep an eye on memory/CPU usage of peer containers.

### 4. Enable CouchDB for Rich Queries (Optional)

For better query performance on large datasets:

```bash
./network.sh up createChannel -s couchdb
```

Then redeploy chaincode.

---

## Monitoring & Logging

### View Chaincode Logs

```bash
# Find chaincode container
docker ps | grep cti

# View logs
docker logs -f dev-peer0.org1.example.com-cti_1.0-<hash>
```

### Monitor Transactions

```bash
# Watch peer logs in real-time
docker logs -f peer0.org1.example.com
```

### Check Blockchain Data

```bash
# Get channel info
peer channel getinfo -c mychannel

# Get latest block
peer channel fetch newest mychannel_newest.block -c mychannel
```

---

## Cleanup & Reset

### Remove All Data and Start Fresh

```bash
cd ~/fabric/fabric-samples/test-network

# Completely remove network and all data
./network.sh down

# Remove chaincode images
docker rmi $(docker images -q dev-peer*)

# Start fresh
./network.sh up createChannel
./network.sh deployCC -ccn cti -ccp ../chaincode/cti -ccl go
```

---

## Next Steps

### 1. Backend Integration (Phase 4 & 5)

Follow the integration guide in `/chaincode/cti/INTEGRATION.md` to:
- Set up Fabric Gateway SDK in Node.js
- Load user certificates from session
- Create REST API endpoints
- Connect frontend to backend

### 2. Production Configuration

- [ ] Configure endorsement policies (see `ENDORSEMENT_POLICIES.md`)
- [ ] Set up TLS certificates for production
- [ ] Configure appropriate channel policies
- [ ] Set up monitoring and alerting
- [ ] Implement backup strategy
- [ ] Configure user certificate attributes (roles)

### 3. Security Hardening

- [ ] Configure certificate expiry policies
- [ ] Set up Certificate Authority properly
- [ ] Define organization-specific access rules
- [ ] Implement attribute-based access control
- [ ] Set up audit log monitoring

### 4. Scale the Network

- [ ] Add more organizations
- [ ] Add more peers per organization
- [ ] Configure Raft consensus ordering service
- [ ] Set up load balancing
- [ ] Configure high availability

---

## Testing Checklist

Before considering deployment complete, verify:

- [ ] Network starts successfully
- [ ] Channel created and peers joined
- [ ] Chaincode deploys without errors
- [ ] Can initialize ledger
- [ ] Can create CTI
- [ ] Can read CTI
- [ ] Can update CTI
- [ ] Can delete CTI
- [ ] Can query by status
- [ ] Can query by priority
- [ ] Can query by category
- [ ] Can get CTI history
- [ ] Can add document references
- [ ] Organization isolation works
- [ ] Both orgs can endorse transactions
- [ ] Invalid inputs are rejected
- [ ] Empty fields are rejected

---

## Support & Resources

### Documentation
- **Chaincode README**: `chaincode/cti/README.md`
- **Security Guide**: `chaincode/cti/SECURITY.md`
- **Endorsement Policies**: `chaincode/cti/ENDORSEMENT_POLICIES.md`
- **Backend Integration**: `chaincode/cti/INTEGRATION.md`
- **Quick Reference**: `chaincode/cti/QUICK_REFERENCE.md`

### Official Resources
- [Hyperledger Fabric Documentation](https://hyperledger-fabric.readthedocs.io/)
- [Fabric Contract API Go](https://github.com/hyperledger/fabric-contract-api-go)
- [Fabric Gateway SDK](https://github.com/hyperledger/fabric-gateway)

### Common Commands Reference

```bash
# Network management
./network.sh up createChannel          # Start network with channel
./network.sh down                      # Stop network
./network.sh deployCC -ccn cti -ccp ../chaincode/cti -ccl go  # Deploy chaincode

# Check status
docker ps                              # View running containers
peer channel list                      # List channels
peer lifecycle chaincode querycommitted -C mychannel  # List deployed chaincodes

# Query operations (read-only, fast)
peer chaincode query -C mychannel -n cti -c '{"function":"GetAllCTIs","Args":[]}'

# Invoke operations (writes, require consensus)
peer chaincode invoke [options] -c '{"function":"CreateCTI","Args":[...]}'
```

---

## Appendix: Full Deployment Script

Save this as `deploy-cti.sh` for automated deployment:

```bash
#!/bin/bash

set -e

echo "=========================================="
echo "CTI Chaincode Deployment Script"
echo "=========================================="

# Navigate to test-network
cd ~/fabric/fabric-samples/test-network

# Bring down any existing network
echo "Cleaning up existing network..."
./network.sh down

# Start network and create channel
echo "Starting Fabric network and creating channel..."
./network.sh up createChannel

# Verify network is running
echo "Verifying network status..."
docker ps

# Deploy CTI chaincode
echo "Deploying CTI chaincode..."
./network.sh deployCC -ccn cti -ccp ../chaincode/cti -ccl go

# Set up environment
export PATH=${PWD}/../bin:$PATH
export FABRIC_CFG_PATH=$PWD/../config/
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051

# Initialize ledger
echo "Initializing ledger with sample data..."
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" \
  -C mychannel -n cti \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" \
  -c '{"function":"InitLedger","Args":[]}'

# Query to verify
echo "Verifying deployment..."
peer chaincode query -C mychannel -n cti \
  -c '{"function":"GetAllCTIs","Args":[]}'

echo "=========================================="
echo "CTI Chaincode Deployment Complete!"
echo "=========================================="
echo ""
echo "Network Status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "Chaincode Status:"
peer lifecycle chaincode querycommitted -C mychannel --name cti
echo ""
echo "Ready for testing and backend integration!"
```

Make it executable and run:

```bash
chmod +x deploy-cti.sh
./deploy-cti.sh
```

---

## Summary
    
You now have:

✅ **Complete deployment guide** for CTI chaincode  
✅ **Testing procedures** for all functions  
✅ **Security verification** steps  
✅ **Troubleshooting solutions** for common issues  
✅ **Production checklist** for go-live  
✅ **Monitoring and logging** setup  
✅ **Cleanup and reset** procedures  


