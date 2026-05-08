# Production Deployment Guide for CTI Chaincode

This guide provides instructions for deploying the CTI chaincode in a production Hyperledger Fabric network.

---

## 📋 Table of Contents

1. [Production Environment Requirements](#production-environment-requirements)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Network Architecture](#network-architecture)
4. [Certificate Setup](#certificate-setup)
5. [Production Deployment Steps](#production-deployment-steps)
6. [Endorsement Policy Configuration](#endorsement-policy-configuration)
7. [Security Hardening](#security-hardening)
8. [High Availability Setup](#high-availability-setup)
9. [Monitoring & Logging](#monitoring--logging)
10. [Backup & Recovery](#backup--recovery)
11. [Performance Tuning](#performance-tuning)
12. [Disaster Recovery](#disaster-recovery)

---

## Production Environment Requirements

### Hardware Requirements (Per Peer)

| Component | Minimum | Recommended | Enterprise |
|-----------|---------|-------------|------------|
| CPU | 2 cores | 4 cores | 8+ cores |
| RAM | 4 GB | 8 GB | 16+ GB |
| Disk | 50 GB SSD | 200 GB SSD | 500+ GB NVMe SSD |
| Network | 100 Mbps | 1 Gbps | 10 Gbps |

### Software Requirements

| Software | Version | Purpose |
|----------|---------|---------|
| **Operating System** | Ubuntu 22.04 LTS | Server OS |
| **Docker** | 24.0.x | Container runtime |
| **Docker Compose** | 2.x | Multi-container orchestration |
| **Go** | 1.18+ | Chaincode compilation |
| **Hyperledger Fabric** | 2.5.x | Blockchain platform |

### Network Requirements

- **Firewall Rules**: Allow inbound on ports 7050, 7051, 7053, 9051
- **DNS**: Resolvable hostnames for all peers and orderers
- **TLS Certificates**: Valid certificates for all components
- **Time Sync**: NTP configured for accurate timestamps

---

## Pre-Deployment Checklist

### Infrastructure

- [ ] Servers provisioned (minimum: 1 orderer, 2 peers per org)
- [ ] Network connectivity verified between all nodes
- [ ] Firewall rules configured
- [ ] DNS records created
- [ ] NTP synchronized across all nodes
- [ ] Monitoring system set up
- [ ] Backup system configured

### Software

- [ ] Docker 24.0.x installed and tested
- [ ] Go 1.18+ installed
- [ ] Fabric binaries downloaded
- [ ] Fabric CA set up (for certificate management)
- [ ] Database (CouchDB) installed if using rich queries

### Security

- [ ] TLS certificates generated for all components
- [ ] Certificate expiry monitoring configured
- [ ] Private keys secured (HSM if available)
- [ ] Admin credentials secured
- [ ] Audit logging enabled
- [ ] Access control policies defined

### Chaincode

- [ ] CTI chaincode tested in dev/staging
- [ ] Go version compatibility verified
- [ ] Dependencies reviewed and approved
- [ ] Security audit completed
- [ ] Performance testing completed
- [ ] Rollback plan prepared

---

## Network Architecture

### Recommended Production Topology

```
┌─────────────────────────────────────────────────────────────┐
│                     Production Network                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Organization 1                   Organization 2             │
│  ├─ peer0.org1.example.com       ├─ peer0.org2.example.com │
│  ├─ peer1.org1.example.com       ├─ peer1.org2.example.com │
│  └─ CouchDB × 2                  └─ CouchDB × 2            │
│                                                              │
│  Ordering Service (Raft)                                    │
│  ├─ orderer1.example.com                                    │
│  ├─ orderer2.example.com                                    │
│  └─ orderer3.example.com                                    │
│                                                              │
│  Certificate Authority                                       │
│  ├─ ca.org1.example.com                                     │
│  └─ ca.org2.example.com                                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Port Assignments

| Component | Port | TLS Port | Operations Port |
|-----------|------|----------|-----------------|
| Orderer 1 | 7050 | 7050 | 9443 |
| Orderer 2 | 8050 | 8050 | 9444 |
| Orderer 3 | 9050 | 9050 | 9445 |
| Peer0 Org1 | 7051 | 7051 | 9446 |
| Peer1 Org1 | 8051 | 8051 | 9447 |
| Peer0 Org2 | 9051 | 9051 | 9448 |
| Peer1 Org2 | 10051 | 10051 | 9449 |
| CouchDB | 5984 | - | - |

---

## Certificate Setup

### 1. Set Up Fabric CA (Production)

**Do NOT use cryptogen in production**. Use Fabric CA instead.

#### Install Fabric CA

```bash
cd ~/fabric
./fabric-samples/bin/fabric-ca-server init -b admin:adminpw
```

#### Configure CA for Org1

```bash
# Edit fabric-ca-server-config.yaml
nano ~/fabric-ca-org1/fabric-ca-server-config.yaml
```

Key configurations:
```yaml
tls:
  enabled: true
  certfile: /path/to/ca-cert.pem
  keyfile: /path/to/ca-key.pem

csr:
  cn: ca.org1.example.com
  names:
    - C: US
      ST: "California"
      L: "San Francisco"
      O: "Org1"
      OU: "Org1 CA"

# Enable user attributes for roles
identities:
  - name: admin
    pass: adminpw
    type: client
    affiliation: ""
    attrs:
      hf.Registrar.Roles: "*"
      hf.Registrar.DelegateRoles: "*"
      hf.Revoker: true
      hf.IntermediateCA: true
      hf.GenCRL: true
      hf.Registrar.Attributes: "*"
      hf.AffiliationMgr: true
```

#### Start CA

```bash
fabric-ca-server start \
  -b admin:adminpw \
  --port 7054 \
  --ca.certfile ~/fabric-ca-org1/ca-cert.pem \
  --ca.keyfile ~/fabric-ca-org1/ca-key.pem
```

### 2. Enroll Admin and Register Users

```bash
# Set CA client home
export FABRIC_CA_CLIENT_HOME=$HOME/fabric-ca-org1/admin

# Enroll admin
fabric-ca-client enroll -u https://admin:adminpw@ca.org1.example.com:7054

# Register peer identity
fabric-ca-client register \
  --id.name peer0 \
  --id.secret peer0pw \
  --id.type peer

# Register admin user with role attribute
fabric-ca-client register \
  --id.name org1admin \
  --id.secret adminpw \
  --id.type client \
  --id.attrs 'role=admin:ecert'

# Register engineer user with role attribute
fabric-ca-client register \
  --id.name engineer1 \
  --id.secret engineerpw \
  --id.type client \
  --id.attrs 'role=engineer:ecert,department=engineering:ecert'

# Register manager user with role attribute
fabric-ca-client register \
  --id.name manager1 \
  --id.secret managerpw \
  --id.type client \
  --id.attrs 'role=manager:ecert,department=management:ecert'
```

### 3. Enroll Users with Role Attributes

```bash
# Enroll engineer
fabric-ca-client enroll \
  -u https://engineer1:engineerpw@ca.org1.example.com:7054 \
  --enrollment.attrs "role,department"

# Enroll manager
fabric-ca-client enroll \
  -u https://manager1:managerpw@ca.org1.example.com:7054 \
  --enrollment.attrs "role,department"
```

**These certificates will have role attributes embedded**, which the CTI chaincode validates.

---

## Production Deployment Steps

### Step 1: Prepare Chaincode

```bash
# On your deployment server
mkdir -p ~/production-chaincode
cd ~/production-chaincode

# Copy CTI chaincode
scp -r user@dev-server:~/fabric/fabric-samples/chaincode/cti ./

# Verify and prepare
cd cti
sed -i 's/^go 1.21/go 1.18/' go.mod  # Adjust Go version if needed
rm -f cti_contract_test.go  # Remove tests for production
go mod tidy
go build ./...  # Verify build
```

### Step 2: Package Chaincode

```bash
cd ~/production-network

peer lifecycle chaincode package cti.tar.gz \
  --path ~/production-chaincode/cti \
  --lang golang \
  --label cti_1.0
```

**Verify package**:
```bash
tar -tzf cti.tar.gz
```

### Step 3: Install on All Peers

**For each peer in each organization**:

```bash
# Set environment for peer0.org1
export CORE_PEER_ADDRESS=peer0.org1.example.com:7051
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=/path/to/org1/peer0/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/path/to/org1/admin/msp

# Install chaincode
peer lifecycle chaincode install cti.tar.gz

# Get package ID
peer lifecycle chaincode queryinstalled

# Save the package ID
export PACKAGE_ID=cti_1.0:XXXXX...
```

Repeat for:
- peer1.org1.example.com
- peer0.org2.example.com
- peer1.org2.example.com

### Step 4: Approve Chaincode for Each Organization

**For Org1**:

```bash
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_MSPCONFIGPATH=/path/to/org1/admin/msp

peer lifecycle chaincode approveformyorg \
  -o orderer.example.com:7050 \
  --ordererTLSHostnameOverride orderer.example.com \
  --tls \
  --cafile /path/to/orderer/tls/ca.crt \
  --channelID productionchannel \
  --name cti \
  --version 1.0 \
  --package-id $PACKAGE_ID \
  --sequence 1 \
  --signature-policy "AND('Org1MSP.member','Org2MSP.member')"
```

**For Org2**:

```bash
export CORE_PEER_LOCALMSPID="Org2MSP"
export CORE_PEER_MSPCONFIGPATH=/path/to/org2/admin/msp

peer lifecycle chaincode approveformyorg \
  -o orderer.example.com:7050 \
  --ordererTLSHostnameOverride orderer.example.com \
  --tls \
  --cafile /path/to/orderer/tls/ca.crt \
  --channelID productionchannel \
  --name cti \
  --version 1.0 \
  --package-id $PACKAGE_ID \
  --sequence 1 \
  --signature-policy "AND('Org1MSP.member','Org2MSP.member')"
```

### Step 5: Check Commit Readiness

```bash
peer lifecycle chaincode checkcommitreadiness \
  --channelID productionchannel \
  --name cti \
  --version 1.0 \
  --sequence 1 \
  --output json
```

**Expected Output**:
```json
{
  "approvals": {
    "Org1MSP": true,
    "Org2MSP": true
  }
}
```

### Step 6: Commit Chaincode Definition

```bash
peer lifecycle chaincode commit \
  -o orderer.example.com:7050 \
  --ordererTLSHostnameOverride orderer.example.com \
  --tls \
  --cafile /path/to/orderer/tls/ca.crt \
  --channelID productionchannel \
  --name cti \
  --peerAddresses peer0.org1.example.com:7051 \
  --tlsRootCertFiles /path/to/org1/peer0/tls/ca.crt \
  --peerAddresses peer0.org2.example.com:9051 \
  --tlsRootCertFiles /path/to/org2/peer0/tls/ca.crt \
  --version 1.0 \
  --sequence 1 \
  --signature-policy "AND('Org1MSP.member','Org2MSP.member')"
```

### Step 7: Verify Deployment

```bash
# Query committed chaincode
peer lifecycle chaincode querycommitted \
  --channelID productionchannel \
  --name cti

# Test basic query
peer chaincode query \
  -C productionchannel \
  -n cti \
  -c '{"function":"GetAllCTIs","Args":[]}'
```

---

## Endorsement Policy Configuration

### Production Endorsement Policy

**High Security (Recommended)**:

```bash
--signature-policy "AND('Org1MSP.member','Org2MSP.member')"
```

**Effect**: Both organizations must endorse every transaction.

**Benefits**:
- ✅ Maximum security
- ✅ Consensus required
- ✅ No single point of failure

**Drawbacks**:
- ⚠️ Both orgs must be online
- ⚠️ Slower transaction processing

### Alternative Policies

**High Availability**:

```bash
--signature-policy "OR('Org1MSP.member','Org2MSP.member')"
```

**Majority Approval** (3+ orgs):

```bash
--signature-policy "OutOf(2, 'Org1MSP.member', 'Org2MSP.member', 'Org3MSP.member')"
```

**Admin-Only** (for critical operations):

```bash
--signature-policy "AND('Org1MSP.admin','Org2MSP.admin')"
```

See `ENDORSEMENT_POLICIES.md` for complete details.

---

## Security Hardening

### 1. Enable TLS for All Communication

**Peer Configuration** (`core.yaml`):

```yaml
peer:
  tls:
    enabled: true
    cert:
      file: /path/to/peer-cert.pem
    key:
      file: /path/to/peer-key.pem
    rootcert:
      file: /path/to/ca-cert.pem
    clientAuthRequired: true
    clientRootCAs:
      files:
        - /path/to/client-ca-cert.pem
```

### 2. Configure Certificate Expiry Monitoring

```bash
# Create monitoring script
cat > check-cert-expiry.sh << 'EOF'
#!/bin/bash

CERT_PATH="/path/to/certificates"
WARNING_DAYS=30

find "$CERT_PATH" -name "*.pem" -type f | while read cert; do
  expiry=$(openssl x509 -in "$cert" -noout -enddate 2>/dev/null | cut -d= -f2)
  if [ ! -z "$expiry" ]; then
    expiry_epoch=$(date -d "$expiry" +%s)
    current_epoch=$(date +%s)
    days_remaining=$(( ($expiry_epoch - $current_epoch) / 86400 ))
    
    if [ $days_remaining -lt $WARNING_DAYS ]; then
      echo "WARNING: $cert expires in $days_remaining days"
    fi
  fi
done
EOF

chmod +x check-cert-expiry.sh

# Add to cron (run daily)
echo "0 2 * * * /path/to/check-cert-expiry.sh" | crontab -
```

### 3. Secure Private Keys

**Use Hardware Security Module (HSM)** if available:

```yaml
# peer core.yaml
peer:
  BCCSP:
    Default: PKCS11
    PKCS11:
      Library: /usr/lib/x86_64-linux-gnu/softhsm/libsofthsm2.so
      Pin: "98765432"
      Label: "fabric"
      hash: SHA2
      security: 256
```

**Or use file system with restricted permissions**:

```bash
# Secure private key directory
chmod 700 /path/to/keys
chmod 600 /path/to/keys/*.pem
chown fabric-user:fabric-group /path/to/keys
```

### 4. Enable Audit Logging

**Peer Configuration**:

```yaml
peer:
  logging:
    level: info
  events:
    address: 0.0.0.0:7053
    buffersize: 100
```

**Set up log forwarding**:

```bash
# Fluentd, Logstash, or similar
# Forward to SIEM system for audit compliance
```

### 5. Network Security

```bash
# Firewall rules (UFW example)
sudo ufw allow from <trusted-ip> to any port 7051
sudo ufw allow from <trusted-ip> to any port 7050
sudo ufw deny 7051
sudo ufw deny 7050
sudo ufw enable
```

### 6. Rate Limiting

Implement rate limiting at nginx/load balancer:

```nginx
limit_req_zone $binary_remote_addr zone=fabric:10m rate=10r/s;

server {
    location /api/ {
        limit_req zone=fabric burst=20;
        proxy_pass http://backend;
    }
}
```

---

## High Availability Setup

### 1. Multi-Peer Redundancy

Deploy at least 2 peers per organization:

```yaml
# docker-compose-peer.yaml
version: '3'

services:
  peer0.org1.example.com:
    image: hyperledger/fabric-peer:2.5
    # ... configuration ...
  
  peer1.org1.example.com:
    image: hyperledger/fabric-peer:2.5
    # ... configuration ...
```

### 2. Orderer Raft Consensus

Configure Raft for fault tolerance:

```yaml
# configtx.yaml
Orderer: &OrdererDefaults
  OrdererType: etcdraft
  EtcdRaft:
    Consenters:
      - Host: orderer1.example.com
        Port: 7050
        ClientTLSCert: /path/to/orderer1-cert.pem
        ServerTLSCert: /path/to/orderer1-cert.pem
      - Host: orderer2.example.com
        Port: 7050
        ClientTLSCert: /path/to/orderer2-cert.pem
        ServerTLSCert: /path/to/orderer2-cert.pem
      - Host: orderer3.example.com
        Port: 7050
        ClientTLSCert: /path/to/orderer3-cert.pem
        ServerTLSCert: /path/to/orderer3-cert.pem
```

**Benefits**:
- Tolerates (n-1)/2 failures (3 orderers can tolerate 1 failure)
- Leader election automatic
- No single point of failure

### 3. CouchDB Replication

For state database redundancy:

```yaml
# Each peer has its own CouchDB
services:
  couchdb0.org1:
    image: couchdb:3.3
    environment:
      - COUCHDB_USER=admin
      - COUCHDB_PASSWORD=adminpw
    volumes:
      - /data/couchdb0:/opt/couchdb/data
```

### 4. Load Balancing

Use nginx or HAProxy for load balancing:

```nginx
upstream fabric_peers {
    least_conn;
    server peer0.org1.example.com:7051;
    server peer1.org1.example.com:8051;
}

server {
    listen 7051 ssl;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass https://fabric_peers;
    }
}
```

---

## Monitoring & Logging

### 1. Prometheus Metrics

**Enable metrics in peer** (`core.yaml`):

```yaml
metrics:
  provider: prometheus
  statsd:
    network: udp
    address: localhost:8125
```

**Prometheus configuration**:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'fabric-peers'
    static_configs:
      - targets:
        - peer0.org1.example.com:9443
        - peer0.org2.example.com:9443
  
  - job_name: 'fabric-orderers'
    static_configs:
      - targets:
        - orderer1.example.com:8443
```

### 2. Grafana Dashboards

Import Fabric dashboard:

```bash
# Install Grafana
sudo apt-get install -y grafana

# Import Fabric dashboard
# Dashboard ID: 10892 (Hyperledger Fabric Overview)
```

### 3. Log Aggregation

**Using ELK Stack**:

```yaml
# filebeat.yml
filebeat.inputs:
  - type: container
    paths:
      - '/var/lib/docker/containers/*/*.log'
    processors:
      - add_docker_metadata:
          host: "unix:///var/run/docker.sock"

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
```

### 4. Alerting

**Prometheus Alerts**:

```yaml
# alerts.yml
groups:
  - name: fabric
    rules:
      - alert: PeerDown
        expr: up{job="fabric-peers"} == 0
        for: 1m
        annotations:
          summary: "Fabric peer {{ $labels.instance }} is down"
      
      - alert: HighTransactionLatency
        expr: fabric_proposal_duration_seconds > 5
        for: 5m
        annotations:
          summary: "High transaction latency detected"
      
      - alert: CertificateExpiringSoon
        expr: (fabric_certificate_expiry_timestamp - time()) < 604800
        annotations:
          summary: "Certificate expires in less than 7 days"
```

---

## Backup & Recovery

### 1. Ledger Backup

**Backup peer data**:

```bash
#!/bin/bash
# backup-ledger.sh

BACKUP_DIR="/backup/fabric/$(date +%Y%m%d)"
PEER_DATA="/var/hyperledger/production/peer"

mkdir -p "$BACKUP_DIR"

# Stop peer (or use snapshot if available)
docker stop peer0.org1.example.com

# Backup ledger data
tar -czf "$BACKUP_DIR/peer0-ledger.tar.gz" "$PEER_DATA"

# Backup certificates
tar -czf "$BACKUP_DIR/peer0-certs.tar.gz" /path/to/crypto-config/

# Start peer
docker start peer0.org1.example.com

# Upload to remote storage
aws s3 cp "$BACKUP_DIR" s3://fabric-backups/ --recursive
```

**Schedule daily backups**:

```bash
# Add to crontab
0 3 * * * /path/to/backup-ledger.sh
```

### 2. Configuration Backup

```bash
# Backup all configuration files
tar -czf config-backup-$(date +%Y%m%d).tar.gz \
  /etc/hyperledger/fabric/ \
  ~/production-network/*.yaml \
  ~/production-chaincode/
```

### 3. Recovery Procedure

**Restore peer from backup**:

```bash
# Stop peer
docker stop peer0.org1.example.com

# Restore ledger
cd /var/hyperledger/production/
rm -rf peer/*
tar -xzf /backup/peer0-ledger.tar.gz -C .

# Restore certificates
tar -xzf /backup/peer0-certs.tar.gz -C /

# Start peer
docker start peer0.org1.example.com

# Verify
docker logs peer0.org1.example.com
```

---

## Performance Tuning

### 1. Peer Configuration

**Optimize `core.yaml`**:

```yaml
peer:
  # Increase concurrent endorsements
  limits:
    concurrency:
      endorserService: 2500
      deliverService: 2500
  
  # Increase message size limits
  maxRecvMsgSize: 104857600  # 100MB
  maxSendMsgSize: 104857600  # 100MB
  
  # Optimize gossip
  gossip:
    aliveTimeInterval: 5s
    aliveExpirationTimeout: 25s
    reconnectInterval: 25s
    maxBlockCountToStore: 100
    publishStateInfoInterval: 4s
```

### 2. CouchDB Optimization

**Configure CouchDB**:

```ini
# local.ini
[couchdb]
max_dbs_open = 500

[chttpd]
max_http_request_size = 4294967296

[httpd]
max_connections = 2048

[query_server_config]
reduce_limit = false
```

### 3. Docker Resource Limits

```yaml
# docker-compose.yaml
services:
  peer0.org1.example.com:
    image: hyperledger/fabric-peer:2.5
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 8G
        reservations:
          cpus: '2'
          memory: 4G
```

### 4. Block Size Optimization

**Optimize for transaction throughput**:

```yaml
# configtx.yaml
Orderer: &OrdererDefaults
  BatchTimeout: 2s
  BatchSize:
    MaxMessageCount: 500
    AbsoluteMaxBytes: 10 MB
    PreferredMaxBytes: 2 MB
```

---

## Disaster Recovery

### Disaster Recovery Plan

1. **Identify Failure Type**
   - Single peer failure
   - Organization failure
   - Orderer failure
   - Network partition

2. **Recovery Procedures**

#### Single Peer Failure

```bash
# Peer can rejoin from other peers
docker start peer0.org1.example.com

# If data corrupted, restore from backup
# (see Backup & Recovery section)
```

#### Orderer Failure

```bash
# Raft will elect new leader automatically
# If orderer data lost, add new orderer:

# 1. Generate new orderer certificates
# 2. Update channel config to add orderer
# 3. Start new orderer with existing genesis block
```

#### Complete Organization Failure

```bash
# 1. Restore from backups
# 2. Rejoin channel
# 3. Re-approve and commit chaincode
# 4. Sync ledger from other peers
```

### 3. Disaster Recovery Testing

**Test recovery procedure quarterly**:

```bash
# Simulate peer failure
docker stop peer0.org1.example.com

# Verify other peer continues operating
peer chaincode query -C productionchannel -n cti -c '{"function":"GetAllCTIs","Args":[]}'

# Restore peer
docker start peer0.org1.example.com

# Verify peer catches up
docker logs -f peer0.org1.example.com
```

---

## Upgrade Procedure

### Upgrade Chaincode to New Version

```bash
# 1. Package new version
peer lifecycle chaincode package cti_v2.tar.gz \
  --path ~/production-chaincode/cti \
  --lang golang \
  --label cti_2.0

# 2. Install on all peers
peer lifecycle chaincode install cti_v2.tar.gz

# 3. Get new package ID
PACKAGE_ID_V2=$(peer lifecycle chaincode queryinstalled --output json | jq -r '.installed_chaincodes[] | select(.label=="cti_2.0") | .package_id')

# 4. Approve for all orgs (with sequence increment)
peer lifecycle chaincode approveformyorg \
  --channelID productionchannel \
  --name cti \
  --version 2.0 \
  --package-id $PACKAGE_ID_V2 \
  --sequence 2

# 5. Commit new definition
peer lifecycle chaincode commit \
  --channelID productionchannel \
  --name cti \
  --version 2.0 \
  --sequence 2 \
  --peerAddresses peer0.org1.example.com:7051 \
  --peerAddresses peer0.org2.example.com:9051
```

**Note**: Old chaincode continues running until all orgs approve the new version.

---

## Production Monitoring Checklist

### Daily Checks

- [ ] All peers running (`docker ps`)
- [ ] All orderers running
- [ ] Certificate expiry status
- [ ] Disk space usage (`df -h`)
- [ ] Network connectivity
- [ ] Transaction success rate
- [ ] Average transaction latency

### Weekly Checks

- [ ] Backup verification
- [ ] Log rotation
- [ ] Security updates
- [ ] Performance metrics review
- [ ] Capacity planning
- [ ] Audit log review

### Monthly Checks

- [ ] Disaster recovery drill
- [ ] Certificate renewal planning
- [ ] Security audit
- [ ] Performance optimization review
- [ ] Chaincode version review
- [ ] Documentation updates

---

## Production Deployment Validation

### Post-Deployment Tests

```bash
# 1. Verify chaincode is committed
peer lifecycle chaincode querycommitted --channelID productionchannel --name cti

# 2. Test create operation
peer chaincode invoke ... -c '{"function":"CreateCTI","Args":[...]}'

# 3. Test query operation
peer chaincode query -C productionchannel -n cti -c '{"function":"GetAllCTIs","Args":[]}'

# 4. Test from each organization
# Switch to Org2 and repeat tests

# 5. Verify audit logging
# Check that events are being emitted

# 6. Load test (optional)
# Create 100+ CTIs and verify performance

# 7. Security test
# Verify certificate validation, access control, etc.
```

---

## Rollback Procedure

### If Deployment Fails

```bash
# 1. Stop network
docker stop $(docker ps -q)

# 2. Restore from backup
tar -xzf /backup/ledger-backup.tar.gz -C /var/hyperledger/production/

# 3. Start network
docker start orderer1.example.com
docker start peer0.org1.example.com
docker start peer0.org2.example.com

# 4. Verify old version is running
peer lifecycle chaincode querycommitted --channelID productionchannel
```

---

## Compliance & Audit

### Regulatory Compliance

1. **Data Retention**: Configure based on regulatory requirements

```yaml
# Retention policy (example)
ledger:
  state:
    totalQueryLimit: 100000
  history:
    enableHistoryDatabase: true  # Required for audit
```

2. **Audit Trail**: Enable and preserve

```bash
# All CTI operations are logged
# Verify audit events are captured:
peer chaincode query -C productionchannel -n cti \
  -c '{"function":"GetCTIHistory","Args":["CTI-ID"]}'
```

3. **Access Logs**: Retain for compliance period

```bash
# Configure log retention (90 days example)
# /etc/logrotate.d/fabric-peer
/var/log/fabric/*.log {
    daily
    rotate 90
    compress
    delaycompress
    notifempty
    create 0600 fabric fabric
}
```

---

## Production Support

### Health Check Endpoints

```bash
# Check peer health
curl -k https://peer0.org1.example.com:9443/healthz

# Check orderer health
curl -k https://orderer1.example.com:8443/healthz
```

### Troubleshooting Tools

```bash
# View recent errors in peer logs
docker logs peer0.org1.example.com 2>&1 | grep -i error | tail -20

# Check chaincode container
docker ps | grep dev-peer0
docker logs $(docker ps -q -f name=dev-peer0.org1.example.com-cti)

# Verify network connectivity
peer channel list
peer lifecycle chaincode queryinstalled
```

---

## Production Deployment Timeline

### Week 1: Preparation
- Day 1-2: Infrastructure setup
- Day 3-4: Install software and dependencies
- Day 5-7: Set up certificates and CA

### Week 2: Testing
- Day 8-10: Deploy to staging environment
- Day 11-12: Run comprehensive tests
- Day 13-14: Performance testing and tuning

### Week 3: Production Deployment
- Day 15: Deploy to production (off-peak hours)
- Day 16-17: Monitor and verify
- Day 18-21: Gradual rollout, monitoring

---

## Success Criteria

Deployment is successful when:

- ✅ All peers and orderers running
- ✅ Chaincode committed on all orgs
- ✅ Test transactions successful
- ✅ Query performance acceptable (< 2s)
- ✅ Write performance acceptable (< 5s)
- ✅ Certificate validation working
- ✅ Access control enforced
- ✅ Audit logging active
- ✅ Monitoring dashboards showing data
- ✅ Backups configured and tested
- ✅ No errors in logs for 24 hours

---

## Support Contacts

- **Hyperledger Fabric**: https://hyperledger-fabric.readthedocs.io/
- **Community**: https://discord.gg/hyperledger
- **GitHub**: https://github.com/hyperledger/fabric

---

## Appendix: Production Configuration Templates

### A. Peer Configuration Template

See `fabric-samples/config/core.yaml` and customize:
- TLS settings
- Gossip configuration
- Chaincode execution timeout
- Logging levels
- Metrics endpoints

### B. Orderer Configuration Template

See `fabric-samples/config/orderer.yaml` and customize:
- Raft consensus parameters
- Batch size and timeout
- TLS settings
- Logging configuration

### C. Channel Configuration Template

See `fabric-samples/test-network/configtx/configtx.yaml` and customize:
- Channel policies
- Organization definitions
- Application capabilities
- Orderer configuration

---

**Document Version**: 1.0  
**Last Updated**: November 30, 2025  
**Status**: Production Ready ✅

---

## 📞 Getting Help

1. **Check logs**: `docker logs peer0.org1.example.com`
2. **Review documentation**: `README.md`, `SECURITY.md`, etc.
3. **Search issues**: Hyperledger Fabric GitHub
4. **Ask community**: Hyperledger Discord
5. **Engage support**: Commercial Fabric support providers



