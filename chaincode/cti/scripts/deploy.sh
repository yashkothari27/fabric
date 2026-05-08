#!/bin/bash

# CTI Chaincode Deployment Script
# This script packages, installs, approves, and commits the CTI chaincode

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
CHANNEL_NAME=${CHANNEL_NAME:-"mychannel"}
CHAINCODE_NAME="cti"
CHAINCODE_VERSION="1.0"
CHAINCODE_SEQUENCE="1"
CC_SRC_PATH="./chaincode/cti"
CC_RUNTIME_LANGUAGE="golang"
CC_END_POLICY=${CC_END_POLICY:-"NA"}
CC_COLL_CONFIG=${CC_COLL_CONFIG:-"NA"}
DELAY=${DELAY:-"3"}
MAX_RETRY=${MAX_RETRY:-"5"}

# Function to print colored messages
println() {
    echo -e "${GREEN}${1}${NC}"
}

errorln() {
    echo -e "${RED}${1}${NC}"
}

warnln() {
    echo -e "${YELLOW}${1}${NC}"
}

# Function to verify the result of a command
verifyResult() {
    if [ $1 -ne 0 ]; then
        errorln "!!!!!!!!!!!!!!! $2 !!!!!!!!!!!!!!!!"
        exit 1
    fi
}

# Package the chaincode
packageChaincode() {
    println "Packaging chaincode..."
    
    set -x
    peer lifecycle chaincode package ${CHAINCODE_NAME}.tar.gz \
        --path ${CC_SRC_PATH} \
        --lang ${CC_RUNTIME_LANGUAGE} \
        --label ${CHAINCODE_NAME}_${CHAINCODE_VERSION}
    res=$?
    set +x
    
    verifyResult $res "Chaincode packaging failed"
    println "Chaincode packaged successfully"
}

# Install chaincode on peer
installChaincode() {
    ORG=$1
    println "Installing chaincode on peer0.org${ORG}..."
    
    set -x
    peer lifecycle chaincode install ${CHAINCODE_NAME}.tar.gz
    res=$?
    set +x
    
    verifyResult $res "Chaincode installation on peer0.org${ORG} failed"
    println "Chaincode installed successfully on peer0.org${ORG}"
}

# Query installed chaincode
queryInstalled() {
    ORG=$1
    println "Querying installed chaincode on peer0.org${ORG}..."
    
    set -x
    peer lifecycle chaincode queryinstalled >&log.txt
    res=$?
    set +x
    
    verifyResult $res "Query installed on peer0.org${ORG} failed"
    
    PACKAGE_ID=$(sed -n "/${CHAINCODE_NAME}_${CHAINCODE_VERSION}/{s/^Package ID: //; s/, Label:.*$//; p;}" log.txt)
    println "Package ID: ${PACKAGE_ID}"
}

# Approve chaincode for organization
approveForMyOrg() {
    ORG=$1
    println "Approving chaincode for org${ORG}..."
    
    set -x
    peer lifecycle chaincode approveformyorg \
        -o localhost:7050 \
        --ordererTLSHostnameOverride orderer.example.com \
        --tls \
        --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" \
        --channelID $CHANNEL_NAME \
        --name ${CHAINCODE_NAME} \
        --version ${CHAINCODE_VERSION} \
        --package-id ${PACKAGE_ID} \
        --sequence ${CHAINCODE_SEQUENCE}
    res=$?
    set +x
    
    verifyResult $res "Chaincode approval for org${ORG} failed"
    println "Chaincode approved successfully for org${ORG}"
}

# Check commit readiness
checkCommitReadiness() {
    println "Checking commit readiness..."
    
    set -x
    peer lifecycle chaincode checkcommitreadiness \
        --channelID $CHANNEL_NAME \
        --name ${CHAINCODE_NAME} \
        --version ${CHAINCODE_VERSION} \
        --sequence ${CHAINCODE_SEQUENCE} \
        --output json
    res=$?
    set +x
    
    verifyResult $res "Failed to check commit readiness"
}

# Commit chaincode definition
commitChaincodeDefinition() {
    println "Committing chaincode definition to channel..."
    
    # Construct peer connection parameters
    PEER_CONN_PARMS=""
    PEERS=""
    
    for org in 1 2; do
        PEER="peer0.org${org}.example.com:$((7050 + $org * 1000))"
        TLSINFO="--tlsRootCertFiles ${PWD}/organizations/peerOrganizations/org${org}.example.com/peers/peer0.org${org}.example.com/tls/ca.crt"
        PEER_CONN_PARMS="$PEER_CONN_PARMS --peerAddresses $PEER"
        PEERS="$PEERS $PEER"
        PEER_CONN_PARMS="$PEER_CONN_PARMS $TLSINFO"
    done
    
    set -x
    peer lifecycle chaincode commit \
        -o localhost:7050 \
        --ordererTLSHostnameOverride orderer.example.com \
        --tls \
        --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" \
        --channelID $CHANNEL_NAME \
        --name ${CHAINCODE_NAME} \
        ${PEER_CONN_PARMS} \
        --version ${CHAINCODE_VERSION} \
        --sequence ${CHAINCODE_SEQUENCE}
    res=$?
    set +x
    
    verifyResult $res "Chaincode commit failed"
    println "Chaincode committed successfully"
}

# Query committed chaincode
queryCommitted() {
    println "Querying committed chaincode..."
    
    set -x
    peer lifecycle chaincode querycommitted \
        --channelID $CHANNEL_NAME \
        --name ${CHAINCODE_NAME}
    res=$?
    set +x
    
    verifyResult $res "Query committed chaincode failed"
}

# Initialize ledger (optional)
initializeLedger() {
    println "Initializing ledger..."
    
    set -x
    peer chaincode invoke \
        -o localhost:7050 \
        --ordererTLSHostnameOverride orderer.example.com \
        --tls \
        --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" \
        -C $CHANNEL_NAME \
        -n ${CHAINCODE_NAME} \
        --peerAddresses localhost:7051 \
        --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
        --peerAddresses localhost:9051 \
        --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" \
        -c '{"function":"InitLedger","Args":[]}'
    res=$?
    set +x
    
    verifyResult $res "Ledger initialization failed"
    println "Ledger initialized successfully"
}

# Main deployment flow
main() {
    println "========================================="
    println "CTI Chaincode Deployment"
    println "========================================="
    println "Channel: $CHANNEL_NAME"
    println "Chaincode: $CHAINCODE_NAME"
    println "Version: $CHAINCODE_VERSION"
    println "Sequence: $CHAINCODE_SEQUENCE"
    println "========================================="
    
    # Step 1: Package chaincode
    packageChaincode
    
    # Step 2: Install on Org1
    println "\n--- Installing on Org1 ---"
    installChaincode 1
    queryInstalled 1
    
    # Step 3: Install on Org2
    println "\n--- Installing on Org2 ---"
    installChaincode 2
    queryInstalled 2
    
    # Step 4: Approve for Org1
    println "\n--- Approving for Org1 ---"
    approveForMyOrg 1
    
    # Step 5: Approve for Org2
    println "\n--- Approving for Org2 ---"
    approveForMyOrg 2
    
    # Step 6: Check commit readiness
    println "\n--- Checking Commit Readiness ---"
    checkCommitReadiness
    
    # Step 7: Commit chaincode definition
    println "\n--- Committing Chaincode Definition ---"
    commitChaincodeDefinition
    
    # Step 8: Query committed
    println "\n--- Querying Committed Chaincode ---"
    queryCommitted
    
    # Step 9: Initialize ledger (optional)
    read -p "Do you want to initialize the ledger with sample data? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        println "\n--- Initializing Ledger ---"
        initializeLedger
    fi
    
    println "\n========================================="
    println "CTI Chaincode Deployment Complete!"
    println "========================================="
}

# Run main function
main

