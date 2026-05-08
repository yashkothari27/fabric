# Quick Start Guide - CTI Chaincode

Get your CTI chaincode running in **under 15 minutes**!

---

## ⚡ Prerequisites

- Ubuntu 22.04 LTS (or compatible Linux)
- 4GB+ RAM
- 20GB+ disk space
- Internet connection

---

## 🚀 Installation (5 commands)

### 1️⃣ Install Docker

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh --version 24.0.9
sudo usermod -aG docker $USER
newgrp docker
```

### 2️⃣ Install Go and Tools

```bash
sudo apt update
sudo apt install -y golang-go git curl jq
```

### 3️⃣ Install Hyperledger Fabric

```bash
mkdir -p ~/fabric && cd ~/fabric
curl -sSL https://bit.ly/2ysbOFE | bash
echo 'export PATH=$HOME/fabric/fabric-samples/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### 4️⃣ Upload CTI Chaincode

**From your local machine**:
```bash
scp -r /path/to/chaincode/cti user@server:~/fabric/fabric-samples/chaincode/
```

**On the server**:
```bash
cd ~/fabric/fabric-samples/chaincode/cti
sed -i 's/^package cti/package main/' cti_contract.go
sed -i 's/^go 1.21/go 1.18/' go.mod
rm -f cti_contract_test.go
go mod tidy
```

### 5️⃣ Deploy Everything

```bash
cd ~/fabric/fabric-samples/test-network
./network.sh up createChannel
./network.sh deployCC -ccn cti -ccp ../chaincode/cti -ccl go
```

**Done!** ✅ Your CTI chaincode is now deployed and running.

---

## 🧪 Quick Test (30 seconds)

```bash
cd ~/fabric/fabric-samples/test-network

# Set up environment
export PATH=${PWD}/../bin:$PATH
export FABRIC_CFG_PATH=$PWD/../config/
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051

# Shortcuts
export ORDERER_CA=${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem
export ORG1_TLS=${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export ORG2_TLS=${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt

# Initialize with sample data
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile "$ORDERER_CA" \
  -C mychannel -n cti \
  --peerAddresses localhost:7051 --tlsRootCertFiles "$ORG1_TLS" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "$ORG2_TLS" \
  -c '{"function":"InitLedger","Args":[]}'

# Query all CTIs
peer chaincode query -C mychannel -n cti \
  -c '{"function":"GetAllCTIs","Args":[]}'
```

**Expected**: See CTI001 sample data in JSON format.

---

## 📝 Common Operations

### Create a CTI

```bash
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile "$ORDERER_CA" \
  -C mychannel -n cti \
  --peerAddresses localhost:7051 --tlsRootCertFiles "$ORG1_TLS" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "$ORG2_TLS" \
  -c '{"function":"CreateCTI","Args":["CTI-NEW","My Case","Case description","OPEN","HIGH","Category","assignee@org1","{}"]}'
```

### Read a CTI

```bash
peer chaincode query -C mychannel -n cti \
  -c '{"function":"ReadCTI","Args":["CTI-NEW"]}'
```

### Update a CTI

```bash
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile "$ORDERER_CA" \
  -C mychannel -n cti \
  --peerAddresses localhost:7051 --tlsRootCertFiles "$ORG1_TLS" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "$ORG2_TLS" \
  -c '{"function":"UpdateCTI","Args":["CTI-NEW","My Case","Updated description","IN_PROGRESS","HIGH","Category","assignee@org1","{}"]}'
```

### Query Open Cases

```bash
peer chaincode query -C mychannel -n cti \
  -c '{"function":"QueryCTIsByStatus","Args":["OPEN"]}'
```

### Get Case History

```bash
peer chaincode query -C mychannel -n cti \
  -c '{"function":"GetCTIHistory","Args":["CTI-NEW"]}'
```

---

## 🛠️ Useful Aliases

Add these to `~/.bashrc` for convenience:

```bash
# Add to ~/.bashrc
alias fabric-env='cd ~/fabric/fabric-samples/test-network && export PATH=${PWD}/../bin:$PATH && export FABRIC_CFG_PATH=$PWD/../config/ && export CORE_PEER_TLS_ENABLED=true && export CORE_PEER_LOCALMSPID="Org1MSP" && export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt && export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp && export CORE_PEER_ADDRESS=localhost:7051 && export ORDERER_CA=${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem && export ORG1_TLS=${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt && export ORG2_TLS=${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt'

alias fabric-start='cd ~/fabric/fabric-samples/test-network && ./network.sh up createChannel'
alias fabric-stop='cd ~/fabric/fabric-samples/test-network && ./network.sh down'
alias fabric-status='docker ps --format "table {{.Names}}\t{{.Status}}"'
alias fabric-logs-peer1='docker logs -f peer0.org1.example.com'
alias fabric-logs-orderer='docker logs -f orderer.example.com'
```

Then reload:
```bash
source ~/.bashrc
```

**Usage**:
```bash
fabric-env       # Set up all environment variables
fabric-start     # Start network with channel
fabric-stop      # Stop network
fabric-status    # Check status
```

---

## 🎯 Quick Commands Reference

| Task | Command |
|------|---------|
| Start network | `./network.sh up createChannel` |
| Stop network | `./network.sh down` |
| Deploy chaincode | `./network.sh deployCC -ccn cti -ccp ../chaincode/cti -ccl go` |
| Check status | `docker ps` |
| View peer logs | `docker logs peer0.org1.example.com` |
| Query all CTIs | `peer chaincode query -C mychannel -n cti -c '{"function":"GetAllCTIs","Args":[]}'` |

---

## 🆘 Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| `peer: command not found` | Run: `export PATH=$HOME/fabric/fabric-samples/bin:$PATH` |
| `connection refused` | Run: `./network.sh up createChannel` |
| `channel not found` | Run: `./network.sh up createChannel` (note: createChannel is required) |
| `Config file not found` | Run: `export FABRIC_CFG_PATH=$PWD/../config/` |
| Docker broken pipe | Downgrade to Docker 24.x (see DEPLOYMENT_GUIDE.md) |

---

## 📚 Next Steps

1. **Learn More**: Read `README.md` for complete API documentation
2. **Security**: Read `SECURITY.md` for security details
3. **Deploy to Production**: Follow `DEPLOYMENT_GUIDE.md`
4. **Run Full Tests**: Follow `TESTING_GUIDE.md`
5. **Integrate Backend**: Read `INTEGRATION.md`

---

## 💡 Pro Tips

- Always run `fabric-env` before any peer commands
- Use query for reads (faster, no consensus needed)
- Use invoke for writes (slower, requires consensus)
- Monitor Docker logs for troubleshooting
- Keep network running for faster testing

---

**You're ready to go!** 🎉

For detailed guides, see:
- `DEPLOYMENT_GUIDE.md` - Complete deployment instructions
- `TESTING_GUIDE.md` - Comprehensive testing procedures
- `SECURITY.md` - Security features and configuration
- `INTEGRATION.md` - Backend integration guide

---

**Document Version**: 1.0  
**Last Updated**: November 30, 2025



