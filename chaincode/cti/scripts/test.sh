#!/bin/bash

# CTI Chaincode Test Script
# This script tests various functions of the CTI chaincode

set -e

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

CHANNEL_NAME=${CHANNEL_NAME:-"mychannel"}
CHAINCODE_NAME="cti"

println() {
    echo -e "${GREEN}${1}${NC}"
}

warnln() {
    echo -e "${YELLOW}${1}${NC}"
}

# Test 1: Create a CTI
test_create_cti() {
    println "\n========================================="
    println "Test 1: Creating a CTI"
    println "========================================="
    
    peer chaincode invoke \
        -o localhost:7050 \
        --ordererTLSHostnameOverride orderer.example.com \
        --tls \
        --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" \
        -C $CHANNEL_NAME \
        -n ${CHAINCODE_NAME} \
        --peerAddresses localhost:7051 \
        --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
        -c '{"function":"CreateCTI","Args":["CTI_TEST_001","Database Connection Issue","Unable to connect to production database","OPEN","CRITICAL","Technical","dba@org1","{\"server\":\"prod-db-01\",\"error\":\"connection_timeout\"}"]}'
    
    println "✓ CTI created successfully"
}

# Test 2: Read a CTI
test_read_cti() {
    println "\n========================================="
    println "Test 2: Reading a CTI"
    println "========================================="
    
    peer chaincode query \
        -C $CHANNEL_NAME \
        -n ${CHAINCODE_NAME} \
        -c '{"function":"ReadCTI","Args":["CTI_TEST_001"]}'
    
    println "\n✓ CTI read successfully"
}

# Test 3: Update a CTI
test_update_cti() {
    println "\n========================================="
    println "Test 3: Updating a CTI"
    println "========================================="
    
    peer chaincode invoke \
        -o localhost:7050 \
        --ordererTLSHostnameOverride orderer.example.com \
        --tls \
        --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" \
        -C $CHANNEL_NAME \
        -n ${CHAINCODE_NAME} \
        --peerAddresses localhost:7051 \
        --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
        -c '{"function":"UpdateCTI","Args":["CTI_TEST_001","Database Connection Issue","Database connection restored","IN_PROGRESS","HIGH","Technical","dba@org1","{\"server\":\"prod-db-01\",\"status\":\"investigating\"}"]}'
    
    println "✓ CTI updated successfully"
}

# Test 4: Get all CTIs
test_get_all_ctis() {
    println "\n========================================="
    println "Test 4: Getting All CTIs"
    println "========================================="
    
    peer chaincode query \
        -C $CHANNEL_NAME \
        -n ${CHAINCODE_NAME} \
        -c '{"function":"GetAllCTIs","Args":[]}'
    
    println "\n✓ Retrieved all CTIs successfully"
}

# Test 5: Query by status
test_query_by_status() {
    println "\n========================================="
    println "Test 5: Querying CTIs by Status"
    println "========================================="
    
    warnln "Querying OPEN CTIs:"
    peer chaincode query \
        -C $CHANNEL_NAME \
        -n ${CHAINCODE_NAME} \
        -c '{"function":"QueryCTIsByStatus","Args":["OPEN"]}'
    
    println "\n✓ Query by status successful"
}

# Test 6: Query by priority
test_query_by_priority() {
    println "\n========================================="
    println "Test 6: Querying CTIs by Priority"
    println "========================================="
    
    warnln "Querying CRITICAL CTIs:"
    peer chaincode query \
        -C $CHANNEL_NAME \
        -n ${CHAINCODE_NAME} \
        -c '{"function":"QueryCTIsByPriority","Args":["CRITICAL"]}'
    
    println "\n✓ Query by priority successful"
}

# Test 7: Add document reference
test_add_document() {
    println "\n========================================="
    println "Test 7: Adding Document Reference"
    println "========================================="
    
    peer chaincode invoke \
        -o localhost:7050 \
        --ordererTLSHostnameOverride orderer.example.com \
        --tls \
        --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" \
        -C $CHANNEL_NAME \
        -n ${CHAINCODE_NAME} \
        --peerAddresses localhost:7051 \
        --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
        -c '{"function":"AddDocumentReference","Args":["CTI_TEST_001","doc-incident-report-20250106.pdf"]}'
    
    println "✓ Document reference added successfully"
}

# Test 8: Get CTI history
test_get_history() {
    println "\n========================================="
    println "Test 8: Getting CTI History"
    println "========================================="
    
    peer chaincode query \
        -C $CHANNEL_NAME \
        -n ${CHAINCODE_NAME} \
        -c '{"function":"GetCTIHistory","Args":["CTI_TEST_001"]}'
    
    println "\n✓ History retrieved successfully"
}

# Test 9: Create multiple CTIs for testing
test_create_multiple() {
    println "\n========================================="
    println "Test 9: Creating Multiple CTIs"
    println "========================================="
    
    # Create CTI 2
    peer chaincode invoke \
        -o localhost:7050 \
        --ordererTLSHostnameOverride orderer.example.com \
        --tls \
        --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" \
        -C $CHANNEL_NAME \
        -n ${CHAINCODE_NAME} \
        --peerAddresses localhost:7051 \
        --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
        -c '{"function":"CreateCTI","Args":["CTI_TEST_002","API Performance Issue","API response time exceeding SLA","OPEN","HIGH","Performance","devops@org1","{}"]}'
    
    sleep 2
    
    # Create CTI 3
    peer chaincode invoke \
        -o localhost:7050 \
        --ordererTLSHostnameOverride orderer.example.com \
        --tls \
        --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" \
        -C $CHANNEL_NAME \
        -n ${CHAINCODE_NAME} \
        --peerAddresses localhost:7051 \
        --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
        -c '{"function":"CreateCTI","Args":["CTI_TEST_003","Security Patch Required","Apply latest security patches","RESOLVED","MEDIUM","Security","security@org1","{}"]}'
    
    println "✓ Multiple CTIs created successfully"
}

# Test 10: Query by category
test_query_by_category() {
    println "\n========================================="
    println "Test 10: Querying CTIs by Category"
    println "========================================="
    
    warnln "Querying Technical CTIs:"
    peer chaincode query \
        -C $CHANNEL_NAME \
        -n ${CHAINCODE_NAME} \
        -c '{"function":"QueryCTIsByCategory","Args":["Technical"]}'
    
    println "\n✓ Query by category successful"
}

# Main test execution
main() {
    println "========================================="
    println "CTI Chaincode Test Suite"
    println "========================================="
    println "Channel: $CHANNEL_NAME"
    println "Chaincode: $CHAINCODE_NAME"
    println "========================================="
    
    # Run all tests
    test_create_cti
    sleep 2
    test_read_cti
    sleep 2
    test_update_cti
    sleep 2
    test_add_document
    sleep 2
    test_get_history
    sleep 2
    test_create_multiple
    sleep 2
    test_get_all_ctis
    sleep 2
    test_query_by_status
    sleep 2
    test_query_by_priority
    sleep 2
    test_query_by_category
    
    println "\n========================================="
    println "All Tests Completed Successfully! ✓"
    println "========================================="
}

# Run main function
main

