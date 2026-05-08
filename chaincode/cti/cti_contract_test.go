package cti

import (
	"encoding/json"
	"testing"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockTransactionContext is a mock for TransactionContext
type MockTransactionContext struct {
	contractapi.TransactionContext
	mock.Mock
}

// MockStub is a mock for ChaincodeStubInterface
type MockStub struct {
	mock.Mock
}

// MockClientIdentity is a mock for ClientIdentity
type MockClientIdentity struct {
	mock.Mock
}

func (m *MockStub) GetState(key string) ([]byte, error) {
	args := m.Called(key)
	return args.Get(0).([]byte), args.Error(1)
}

func (m *MockStub) PutState(key string, value []byte) error {
	args := m.Called(key, value)
	return args.Error(0)
}

func (m *MockStub) DelState(key string) error {
	args := m.Called(key)
	return args.Error(0)
}

func (m *MockClientIdentity) GetID() (string, error) {
	args := m.Called()
	return args.String(0), args.Error(1)
}

func (m *MockClientIdentity) GetMSPID() (string, error) {
	args := m.Called()
	return args.String(0), args.Error(1)
}

func (m *MockClientIdentity) GetAttributeValue(attrName string) (string, bool, error) {
	args := m.Called(attrName)
	return args.String(0), args.Bool(1), args.Error(2)
}

func (m *MockTransactionContext) GetStub() contractapi.ChaincodeStubInterface {
	args := m.Called()
	return args.Get(0).(contractapi.ChaincodeStubInterface)
}

func (m *MockTransactionContext) GetClientIdentity() contractapi.ClientIdentity {
	args := m.Called()
	return args.Get(0).(contractapi.ClientIdentity)
}

func TestCreateCTI(t *testing.T) {
	contract := new(CTIContract)
	ctx := new(MockTransactionContext)
	stub := new(MockStub)
	clientIdentity := new(MockClientIdentity)

	// Setup mocks
	ctx.On("GetStub").Return(stub)
	ctx.On("GetClientIdentity").Return(clientIdentity)
	clientIdentity.On("GetID").Return("user@org1", nil)
	clientIdentity.On("GetMSPID").Return("Org1MSP", nil)

	// Test CTI doesn't exist
	stub.On("GetState", "CTI001").Return([]byte(nil), nil)

	// Test successful creation
	stub.On("PutState", "CTI001", mock.Anything).Return(nil)

	err := contract.CreateCTI(
		ctx,
		"CTI001",
		"Test Title",
		"Test Description",
		"OPEN",
		"HIGH",
		"Technical",
		"engineer@org1",
		`{"key":"value"}`,
	)

	assert.NoError(t, err)
	stub.AssertExpectations(t)
}

func TestReadCTI(t *testing.T) {
	contract := new(CTIContract)
	ctx := new(MockTransactionContext)
	stub := new(MockStub)
	clientIdentity := new(MockClientIdentity)

	// Setup mocks
	ctx.On("GetStub").Return(stub)
	ctx.On("GetClientIdentity").Return(clientIdentity)
	clientIdentity.On("GetMSPID").Return("Org1MSP", nil)
	clientIdentity.On("GetAttributeValue", "role").Return("", false, nil)

	// Create a test CTI
	cti := CTI{
		ID:           "CTI001",
		Title:        "Test Title",
		Description:  "Test Description",
		Status:       "OPEN",
		Priority:     "HIGH",
		Category:     "Technical",
		Organization: "Org1MSP",
	}
	ctiJSON, _ := json.Marshal(cti)

	stub.On("GetState", "CTI001").Return(ctiJSON, nil)

	result, err := contract.ReadCTI(ctx, "CTI001")

	assert.NoError(t, err)
	assert.Equal(t, "CTI001", result.ID)
	assert.Equal(t, "Test Title", result.Title)
	stub.AssertExpectations(t)
}

func TestCTIExists(t *testing.T) {
	contract := new(CTIContract)
	ctx := new(MockTransactionContext)
	stub := new(MockStub)

	ctx.On("GetStub").Return(stub)

	// Test CTI exists
	stub.On("GetState", "CTI001").Return([]byte(`{}`), nil).Once()
	exists, err := contract.CTIExists(ctx, "CTI001")
	assert.NoError(t, err)
	assert.True(t, exists)

	// Test CTI doesn't exist
	stub.On("GetState", "CTI002").Return([]byte(nil), nil).Once()
	exists, err = contract.CTIExists(ctx, "CTI002")
	assert.NoError(t, err)
	assert.False(t, exists)

	stub.AssertExpectations(t)
}

func TestIsValidStatus(t *testing.T) {
	assert.True(t, isValidStatus("OPEN"))
	assert.True(t, isValidStatus("IN_PROGRESS"))
	assert.True(t, isValidStatus("RESOLVED"))
	assert.True(t, isValidStatus("CLOSED"))
	assert.False(t, isValidStatus("INVALID"))
}

func TestIsValidPriority(t *testing.T) {
	assert.True(t, isValidPriority("LOW"))
	assert.True(t, isValidPriority("MEDIUM"))
	assert.True(t, isValidPriority("HIGH"))
	assert.True(t, isValidPriority("CRITICAL"))
	assert.False(t, isValidPriority("INVALID"))
}

func TestUpdateCTI(t *testing.T) {
	contract := new(CTIContract)
	ctx := new(MockTransactionContext)
	stub := new(MockStub)
	clientIdentity := new(MockClientIdentity)

	// Setup mocks
	ctx.On("GetStub").Return(stub)
	ctx.On("GetClientIdentity").Return(clientIdentity)
	clientIdentity.On("GetMSPID").Return("Org1MSP", nil)
	clientIdentity.On("GetAttributeValue", "role").Return("", false, nil)

	// Create existing CTI
	cti := CTI{
		ID:           "CTI001",
		Title:        "Old Title",
		Description:  "Old Description",
		Status:       "OPEN",
		Priority:     "HIGH",
		Category:     "Technical",
		Organization: "Org1MSP",
		Metadata:     map[string]string{"old": "value"},
	}
	ctiJSON, _ := json.Marshal(cti)

	stub.On("GetState", "CTI001").Return(ctiJSON, nil)
	stub.On("PutState", "CTI001", mock.Anything).Return(nil)

	err := contract.UpdateCTI(
		ctx,
		"CTI001",
		"New Title",
		"New Description",
		"IN_PROGRESS",
		"CRITICAL",
		"Technical",
		"engineer@org1",
		`{"new":"value"}`,
	)

	assert.NoError(t, err)
	stub.AssertExpectations(t)
}

func TestDeleteCTI(t *testing.T) {
	contract := new(CTIContract)
	ctx := new(MockTransactionContext)
	stub := new(MockStub)
	clientIdentity := new(MockClientIdentity)

	// Setup mocks
	ctx.On("GetStub").Return(stub)
	ctx.On("GetClientIdentity").Return(clientIdentity)
	clientIdentity.On("GetMSPID").Return("Org1MSP", nil)
	clientIdentity.On("GetAttributeValue", "role").Return("", false, nil)

	// Create existing CTI
	cti := CTI{
		ID:           "CTI001",
		Organization: "Org1MSP",
	}
	ctiJSON, _ := json.Marshal(cti)

	stub.On("GetState", "CTI001").Return(ctiJSON, nil)
	stub.On("DelState", "CTI001").Return(nil)

	err := contract.DeleteCTI(ctx, "CTI001")

	assert.NoError(t, err)
	stub.AssertExpectations(t)
}

func TestAccessControl(t *testing.T) {
	contract := new(CTIContract)
	ctx := new(MockTransactionContext)
	clientIdentity := new(MockClientIdentity)

	ctx.On("GetClientIdentity").Return(clientIdentity)

	// Test regular user accessing their org's CTI
	clientIdentity.On("GetAttributeValue", "role").Return("", false, nil).Once()
	cti := &CTI{Organization: "Org1MSP"}
	hasAccess := contract.hasAccessToCTI(ctx, cti, "Org1MSP")
	assert.True(t, hasAccess)

	// Test regular user accessing another org's CTI
	clientIdentity.On("GetAttributeValue", "role").Return("", false, nil).Once()
	hasAccess = contract.hasAccessToCTI(ctx, cti, "Org2MSP")
	assert.False(t, hasAccess)

	// Test admin accessing any org's CTI
	clientIdentity.On("GetAttributeValue", "role").Return("admin", true, nil).Once()
	hasAccess = contract.hasAccessToCTI(ctx, cti, "Org2MSP")
	assert.True(t, hasAccess)
}

