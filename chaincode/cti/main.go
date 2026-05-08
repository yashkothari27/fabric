package main

import (
	"log"

	"github.com/cti-chaincode/cti"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

func main() {
	ctiChaincode, err := contractapi.NewChaincode(&cti.CTIContract{})
	if err != nil {
		log.Panicf("Error creating CTI chaincode: %v", err)
	}

	if err := ctiChaincode.Start(); err != nil {
		log.Panicf("Error starting CTI chaincode: %v", err)
	}
}

