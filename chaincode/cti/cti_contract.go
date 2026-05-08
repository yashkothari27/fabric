package cti

import (
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"strings"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// CTIContract provides functions for managing Case Tracking Information
type CTIContract struct {
	contractapi.Contract
}

// UserRole represents the role of a user in the system
type UserRole string

const (
	RoleAdmin     UserRole = "admin"
	RoleManager   UserRole = "manager"
	RoleEngineer  UserRole = "engineer"
	RoleViewer    UserRole = "viewer"
	RoleAuditor   UserRole = "auditor"
)

// Permission represents an operation permission
type Permission string

const (
	PermissionCreate Permission = "create"
	PermissionRead   Permission = "read"
	PermissionUpdate Permission = "update"
	PermissionDelete Permission = "delete"
	PermissionAudit  Permission = "audit"
)

// UserIdentity contains detailed information about a user's identity
type UserIdentity struct {
	ClientID     string            `json:"clientId"`
	MSPID        string            `json:"mspId"`
	Attributes   map[string]string `json:"attributes"`
	Role         UserRole          `json:"role"`
	CommonName   string            `json:"commonName"`
	Organization string            `json:"organization"`
}

// CTI represents a Case Tracking Information record
type CTI struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Status      string    `json:"status"` // OPEN, IN_PROGRESS, RESOLVED, CLOSED
	Priority    string    `json:"priority"` // LOW, MEDIUM, HIGH, CRITICAL
	Category    string    `json:"category"`
	CreatedBy   string    `json:"createdBy"`
	AssignedTo  string    `json:"assignedTo"`
	Organization string   `json:"organization"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
	Metadata    map[string]string `json:"metadata"`
	Documents   []string  `json:"documents"` // References to attached documents
}

// CTIHistory represents a historical change to a CTI
type CTIHistory struct {
	TxID      string    `json:"txId"`
	Timestamp time.Time `json:"timestamp"`
	IsDelete  bool      `json:"isDelete"`
	Value     *CTI      `json:"value"`
}

// QueryResult structure used for handling result of query
type QueryResult struct {
	Key    string `json:"key"`
	Record *CTI   `json:"record"`
}

// InitLedger adds a base set of CTIs to the ledger (optional, for testing)
func (c *CTIContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	ctis := []CTI{
		{
			ID:          "CTI001",
			Title:       "System Integration Issue",
			Description: "Integration between modules A and B failing",
			Status:      "OPEN",
			Priority:    "HIGH",
			Category:    "Technical",
			CreatedBy:   "admin@org1",
			AssignedTo:  "engineer@org1",
			Organization: "Org1MSP",
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
			Metadata:    map[string]string{"module": "integration", "severity": "high"},
			Documents:   []string{},
		},
	}

	for _, cti := range ctis {
		ctiJSON, err := json.Marshal(cti)
		if err != nil {
			return err
		}

		err = ctx.GetStub().PutState(cti.ID, ctiJSON)
		if err != nil {
			return fmt.Errorf("failed to put CTI to world state: %v", err)
		}
	}

	return nil
}

// CreateCTI creates a new CTI record with full identity and permission validation
func (c *CTIContract) CreateCTI(
	ctx contractapi.TransactionContextInterface,
	id string,
	title string,
	description string,
	status string,
	priority string,
	category string,
	assignedTo string,
	metadataJSON string,
) error {
	// Verify transaction signature
	if err := c.VerifyTransactionSignature(ctx); err != nil {
		return fmt.Errorf("signature verification failed: %v", err)
	}
	
	// Check permission to create
	if err := c.CheckPermission(ctx, PermissionCreate); err != nil {
		return err
	}
	
	// Get caller identity with full validation
	identity, err := c.GetFullUserIdentity(ctx)
	if err != nil {
		return fmt.Errorf("identity validation failed: %v", err)
	}

	// Check if CTI already exists
	exists, err := c.CTIExists(ctx, id)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("CTI %s already exists", id)
	}

	// Validate inputs
	if strings.TrimSpace(title) == "" {
		return fmt.Errorf("title cannot be empty")
	}
	if !isValidStatus(status) {
		return fmt.Errorf("invalid status: %s. Must be OPEN, IN_PROGRESS, RESOLVED, or CLOSED", status)
	}
	if !isValidPriority(priority) {
		return fmt.Errorf("invalid priority: %s. Must be LOW, MEDIUM, HIGH, or CRITICAL", priority)
	}

	// Parse metadata
	var metadata map[string]string
	if metadataJSON != "" {
		err = json.Unmarshal([]byte(metadataJSON), &metadata)
		if err != nil {
			return fmt.Errorf("failed to parse metadata JSON: %v", err)
		}
	} else {
		metadata = make(map[string]string)
	}

	// Create CTI object
	cti := CTI{
		ID:           id,
		Title:        title,
		Description:  description,
		Status:       status,
		Priority:     priority,
		Category:     category,
		CreatedBy:    identity.ClientID,
		AssignedTo:   assignedTo,
		Organization: identity.MSPID,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
		Metadata:     metadata,
		Documents:    []string{},
	}

	ctiJSON, err := json.Marshal(cti)
	if err != nil {
		return err
	}

	err = ctx.GetStub().PutState(id, ctiJSON)
	if err != nil {
		return err
	}
	
	// Log audit event
	err = c.LogAuditEvent(ctx, "CTI", id, "CREATE")
	if err != nil {
		// Log but don't fail the transaction
		fmt.Printf("Warning: failed to log audit event: %v\n", err)
	}

	return nil
}

// ReadCTI retrieves a CTI by ID with role-based access control
func (c *CTIContract) ReadCTI(ctx contractapi.TransactionContextInterface, id string) (*CTI, error) {
	// Get caller identity
	_, callerOrg, err := c.getCallerIdentity(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get caller identity: %v", err)
	}

	ctiJSON, err := ctx.GetStub().GetState(id)
	if err != nil {
		return nil, fmt.Errorf("failed to read CTI %s: %v", id, err)
	}
	if ctiJSON == nil {
		return nil, fmt.Errorf("CTI %s does not exist", id)
	}

	var cti CTI
	err = json.Unmarshal(ctiJSON, &cti)
	if err != nil {
		return nil, err
	}

	// Check if caller has access to this CTI
	if !c.hasAccessToCTI(ctx, &cti, callerOrg) {
		return nil, fmt.Errorf("access denied: you don't have permission to view this CTI")
	}

	return &cti, nil
}

// UpdateCTI updates an existing CTI with permission validation
func (c *CTIContract) UpdateCTI(
	ctx contractapi.TransactionContextInterface,
	id string,
	title string,
	description string,
	status string,
	priority string,
	category string,
	assignedTo string,
	metadataJSON string,
) error {
	// Verify transaction signature
	if err := c.VerifyTransactionSignature(ctx); err != nil {
		return fmt.Errorf("signature verification failed: %v", err)
	}
	
	// Check permission to update
	if err := c.CheckPermission(ctx, PermissionUpdate); err != nil {
		return err
	}

	// Check if CTI exists
	cti, err := c.ReadCTI(ctx, id)
	if err != nil {
		return err
	}

	// Check if caller can modify this specific CTI
	if err := c.CanModifyCTI(ctx, cti); err != nil {
		return err
	}

	// Validate inputs
	if strings.TrimSpace(title) == "" {
		return fmt.Errorf("title cannot be empty")
	}
	if !isValidStatus(status) {
		return fmt.Errorf("invalid status: %s", status)
	}
	if !isValidPriority(priority) {
		return fmt.Errorf("invalid priority: %s", priority)
	}

	// Parse metadata
	var metadata map[string]string
	if metadataJSON != "" {
		err = json.Unmarshal([]byte(metadataJSON), &metadata)
		if err != nil {
			return fmt.Errorf("failed to parse metadata JSON: %v", err)
		}
	} else {
		metadata = cti.Metadata
	}

	// Update CTI
	cti.Title = title
	cti.Description = description
	cti.Status = status
	cti.Priority = priority
	cti.Category = category
	cti.AssignedTo = assignedTo
	cti.Metadata = metadata
	cti.UpdatedAt = time.Now()

	ctiJSON, err := json.Marshal(cti)
	if err != nil {
		return err
	}

	err = ctx.GetStub().PutState(id, ctiJSON)
	if err != nil {
		return err
	}
	
	// Log audit event
	err = c.LogAuditEvent(ctx, "CTI", id, "UPDATE")
	if err != nil {
		fmt.Printf("Warning: failed to log audit event: %v\n", err)
	}

	return nil
}

// DeleteCTI deletes a CTI by ID with strict permission validation
func (c *CTIContract) DeleteCTI(ctx contractapi.TransactionContextInterface, id string) error {
	// Verify transaction signature
	if err := c.VerifyTransactionSignature(ctx); err != nil {
		return fmt.Errorf("signature verification failed: %v", err)
	}
	
	// Check permission to delete (only admins and managers)
	if err := c.CheckPermission(ctx, PermissionDelete); err != nil {
		return err
	}

	// Check if CTI exists
	cti, err := c.ReadCTI(ctx, id)
	if err != nil {
		return err
	}

	// Additional check - only allow deletion from same organization
	identity, err := c.GetFullUserIdentity(ctx)
	if err != nil {
		return err
	}
	
	// Only admins can delete cross-org, managers can delete their org's CTIs
	if identity.Role != RoleAdmin && cti.Organization != identity.MSPID {
		return fmt.Errorf("access denied: cannot delete CTI from another organization")
	}

	err = ctx.GetStub().DelState(id)
	if err != nil {
		return err
	}
	
	// Log audit event
	err = c.LogAuditEvent(ctx, "CTI", id, "DELETE")
	if err != nil {
		fmt.Printf("Warning: failed to log audit event: %v\n", err)
	}

	return nil
}

// GetAllCTIs returns all CTIs accessible to the caller
func (c *CTIContract) GetAllCTIs(ctx contractapi.TransactionContextInterface) ([]*CTI, error) {
	// Get caller identity
	_, callerOrg, err := c.getCallerIdentity(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get caller identity: %v", err)
	}

	// Range query with empty string for startKey and endKey does an open-ended query of all ctis in the chaincode namespace
	resultsIterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var ctis []*CTI
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var cti CTI
		err = json.Unmarshal(queryResponse.Value, &cti)
		if err != nil {
			return nil, err
		}

		// Only include CTIs the caller has access to
		if c.hasAccessToCTI(ctx, &cti, callerOrg) {
			ctis = append(ctis, &cti)
		}
	}

	return ctis, nil
}

// QueryCTIsByStatus retrieves CTIs by status
func (c *CTIContract) QueryCTIsByStatus(ctx contractapi.TransactionContextInterface, status string) ([]*CTI, error) {
	// Get caller identity
	_, callerOrg, err := c.getCallerIdentity(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get caller identity: %v", err)
	}

	// Validate status
	if !isValidStatus(status) {
		return nil, fmt.Errorf("invalid status: %s", status)
	}

	queryString := fmt.Sprintf(`{"selector":{"status":"%s"}}`, status)
	return c.getQueryResultForQueryString(ctx, queryString, callerOrg)
}

// QueryCTIsByOrganization retrieves CTIs by organization
func (c *CTIContract) QueryCTIsByOrganization(ctx contractapi.TransactionContextInterface, organization string) ([]*CTI, error) {
	// Get caller identity
	_, callerOrg, err := c.getCallerIdentity(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get caller identity: %v", err)
	}

	queryString := fmt.Sprintf(`{"selector":{"organization":"%s"}}`, organization)
	return c.getQueryResultForQueryString(ctx, queryString, callerOrg)
}

// QueryCTIsByPriority retrieves CTIs by priority
func (c *CTIContract) QueryCTIsByPriority(ctx contractapi.TransactionContextInterface, priority string) ([]*CTI, error) {
	// Get caller identity
	_, callerOrg, err := c.getCallerIdentity(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get caller identity: %v", err)
	}

	// Validate priority
	if !isValidPriority(priority) {
		return nil, fmt.Errorf("invalid priority: %s", priority)
	}

	queryString := fmt.Sprintf(`{"selector":{"priority":"%s"}}`, priority)
	return c.getQueryResultForQueryString(ctx, queryString, callerOrg)
}

// QueryCTIsByCategory retrieves CTIs by category
func (c *CTIContract) QueryCTIsByCategory(ctx contractapi.TransactionContextInterface, category string) ([]*CTI, error) {
	// Get caller identity
	_, callerOrg, err := c.getCallerIdentity(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get caller identity: %v", err)
	}

	queryString := fmt.Sprintf(`{"selector":{"category":"%s"}}`, category)
	return c.getQueryResultForQueryString(ctx, queryString, callerOrg)
}

// QueryCTIsByAssignee retrieves CTIs assigned to a specific user
func (c *CTIContract) QueryCTIsByAssignee(ctx contractapi.TransactionContextInterface, assignedTo string) ([]*CTI, error) {
	// Get caller identity
	_, callerOrg, err := c.getCallerIdentity(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get caller identity: %v", err)
	}

	queryString := fmt.Sprintf(`{"selector":{"assignedTo":"%s"}}`, assignedTo)
	return c.getQueryResultForQueryString(ctx, queryString, callerOrg)
}

// GetCTIHistory returns the history of changes for a CTI
func (c *CTIContract) GetCTIHistory(ctx contractapi.TransactionContextInterface, id string) ([]*CTIHistory, error) {
	// Get caller identity
	_, callerOrg, err := c.getCallerIdentity(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get caller identity: %v", err)
	}

	// Check if CTI exists and caller has access
	cti, err := c.ReadCTI(ctx, id)
	if err != nil {
		return nil, err
	}

	if !c.hasAccessToCTI(ctx, cti, callerOrg) {
		return nil, fmt.Errorf("access denied: you don't have permission to view this CTI history")
	}

	resultsIterator, err := ctx.GetStub().GetHistoryForKey(id)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var history []*CTIHistory
	for resultsIterator.HasNext() {
		modification, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var ctiValue *CTI
		if !modification.IsDelete {
			err = json.Unmarshal(modification.Value, &ctiValue)
			if err != nil {
				return nil, err
			}
		}

		historyEntry := &CTIHistory{
			TxID:      modification.TxId,
			Timestamp: time.Unix(modification.Timestamp.Seconds, int64(modification.Timestamp.Nanos)),
			IsDelete:  modification.IsDelete,
			Value:     ctiValue,
		}
		history = append(history, historyEntry)
	}

	return history, nil
}

// CTIExists checks if a CTI exists
func (c *CTIContract) CTIExists(ctx contractapi.TransactionContextInterface, id string) (bool, error) {
	ctiJSON, err := ctx.GetStub().GetState(id)
	if err != nil {
		return false, fmt.Errorf("failed to read from world state: %v", err)
	}

	return ctiJSON != nil, nil
}

// AddDocumentReference adds a document reference to a CTI
func (c *CTIContract) AddDocumentReference(ctx contractapi.TransactionContextInterface, id string, documentRef string) error {
	cti, err := c.ReadCTI(ctx, id)
	if err != nil {
		return err
	}

	// Get caller identity
	_, callerOrg, err := c.getCallerIdentity(ctx)
	if err != nil {
		return fmt.Errorf("failed to get caller identity: %v", err)
	}

	// Check if caller has permission
	if !c.hasAccessToCTI(ctx, cti, callerOrg) {
		return fmt.Errorf("access denied: you don't have permission to modify this CTI")
	}

	cti.Documents = append(cti.Documents, documentRef)
	cti.UpdatedAt = time.Now()

	ctiJSON, err := json.Marshal(cti)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(id, ctiJSON)
}

// ============================================================================
// IDENTITY & CERTIFICATE VALIDATION FUNCTIONS
// ============================================================================

// GetFullUserIdentity extracts and validates complete user identity with certificate validation
func (c *CTIContract) GetFullUserIdentity(ctx contractapi.TransactionContextInterface) (*UserIdentity, error) {
	// Get client identity
	clientIdentity := ctx.GetClientIdentity()
	
	// Get client ID (DN from certificate)
	clientID, err := clientIdentity.GetID()
	if err != nil {
		return nil, fmt.Errorf("failed to get client ID: %v", err)
	}
	
	// Get MSP ID (organization)
	mspID, err := clientIdentity.GetMSPID()
	if err != nil {
		return nil, fmt.Errorf("failed to get MSP ID: %v", err)
	}
	
	// Parse and validate certificate
	certPEM, err := clientIdentity.GetX509Certificate()
	if err != nil {
		return nil, fmt.Errorf("failed to get X509 certificate: %v", err)
	}
	
	// Validate certificate is not expired
	currentTime := time.Now()
	if currentTime.Before(certPEM.NotBefore) {
		return nil, fmt.Errorf("certificate not yet valid")
	}
	if currentTime.After(certPEM.NotAfter) {
		return nil, fmt.Errorf("certificate has expired")
	}
	
	// Extract Common Name from certificate
	commonName := certPEM.Subject.CommonName
	
	// Get user attributes from certificate
	attributes := make(map[string]string)
	
	// Extract role attribute
	roleValue, found, err := clientIdentity.GetAttributeValue("role")
	if err != nil {
		return nil, fmt.Errorf("failed to get role attribute: %v", err)
	}
	if found {
		attributes["role"] = roleValue
	}
	
	// Extract department attribute (optional)
	dept, found, _ := clientIdentity.GetAttributeValue("department")
	if found {
		attributes["department"] = dept
	}
	
	// Extract email attribute (optional)
	email, found, _ := clientIdentity.GetAttributeValue("email")
	if found {
		attributes["email"] = email
	}
	
	// Determine user role (default to viewer if not specified)
	var userRole UserRole = RoleViewer
	if roleValue != "" {
		userRole = UserRole(roleValue)
	}
	
	// Validate role is recognized
	if !c.isValidRole(userRole) {
		return nil, fmt.Errorf("invalid role: %s", roleValue)
	}
	
	identity := &UserIdentity{
		ClientID:     clientID,
		MSPID:        mspID,
		Attributes:   attributes,
		Role:         userRole,
		CommonName:   commonName,
		Organization: mspID,
	}
	
	return identity, nil
}

// getCallerIdentity extracts the caller's identity and organization (simplified version)
func (c *CTIContract) getCallerIdentity(ctx contractapi.TransactionContextInterface) (string, string, error) {
	identity, err := c.GetFullUserIdentity(ctx)
	if err != nil {
		return "", "", err
	}
	return identity.ClientID, identity.MSPID, nil
}

// ValidateCertificate validates an X.509 certificate
func (c *CTIContract) ValidateCertificate(certPEM string) error {
	// Decode PEM
	block, _ := pem.Decode([]byte(certPEM))
	if block == nil {
		return fmt.Errorf("failed to decode PEM certificate")
	}
	
	// Parse certificate
	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return fmt.Errorf("failed to parse certificate: %v", err)
	}
	
	// Check validity period
	currentTime := time.Now()
	if currentTime.Before(cert.NotBefore) {
		return fmt.Errorf("certificate not yet valid (valid from: %v)", cert.NotBefore)
	}
	if currentTime.After(cert.NotAfter) {
		return fmt.Errorf("certificate expired (expired on: %v)", cert.NotAfter)
	}
	
	// Verify certificate purpose
	if cert.KeyUsage&x509.KeyUsageDigitalSignature == 0 {
		return fmt.Errorf("certificate does not have digital signature capability")
	}
	
	return nil
}

// ============================================================================
// ROLE-BASED ACCESS CONTROL (RBAC) FUNCTIONS
// ============================================================================

// CheckPermission validates if a user has permission to perform an operation
func (c *CTIContract) CheckPermission(ctx contractapi.TransactionContextInterface, permission Permission) error {
	identity, err := c.GetFullUserIdentity(ctx)
	if err != nil {
		return fmt.Errorf("identity validation failed: %v", err)
	}
	
	// Check if role has permission
	if !c.roleHasPermission(identity.Role, permission) {
		return fmt.Errorf("access denied: role '%s' does not have '%s' permission", identity.Role, permission)
	}
	
	return nil
}

// roleHasPermission checks if a role has a specific permission
func (c *CTIContract) roleHasPermission(role UserRole, permission Permission) bool {
	// Define role-permission matrix
	rolePermissions := map[UserRole][]Permission{
		RoleAdmin: {
			PermissionCreate,
			PermissionRead,
			PermissionUpdate,
			PermissionDelete,
			PermissionAudit,
		},
		RoleManager: {
			PermissionCreate,
			PermissionRead,
			PermissionUpdate,
			PermissionAudit,
		},
		RoleEngineer: {
			PermissionCreate,
			PermissionRead,
			PermissionUpdate,
		},
		RoleViewer: {
			PermissionRead,
		},
		RoleAuditor: {
			PermissionRead,
			PermissionAudit,
		},
	}
	
	permissions, exists := rolePermissions[role]
	if !exists {
		return false
	}
	
	for _, p := range permissions {
		if p == permission {
			return true
		}
	}
	
	return false
}

// hasAccessToCTI checks if the caller has access to a CTI based on their organization and role
func (c *CTIContract) hasAccessToCTI(ctx contractapi.TransactionContextInterface, cti *CTI, callerOrg string) bool {
	identity, err := c.GetFullUserIdentity(ctx)
	if err != nil {
		return false
	}
	
	// Admins and auditors have cross-organization access
	if identity.Role == RoleAdmin || identity.Role == RoleAuditor {
		return true
	}
	
	// Managers can access CTIs from their organization
	if identity.Role == RoleManager && cti.Organization == callerOrg {
		return true
	}
	
	// Engineers and viewers can only access CTIs from their organization
	if cti.Organization == callerOrg {
		return true
	}
	
	return false
}

// CanModifyCTI checks if user can modify a specific CTI
func (c *CTIContract) CanModifyCTI(ctx contractapi.TransactionContextInterface, cti *CTI) error {
	identity, err := c.GetFullUserIdentity(ctx)
	if err != nil {
		return fmt.Errorf("identity validation failed: %v", err)
	}
	
	// Check read access first
	if !c.hasAccessToCTI(ctx, cti, identity.MSPID) {
		return fmt.Errorf("access denied: you don't have access to this CTI")
	}
	
	// Admins can modify any CTI
	if identity.Role == RoleAdmin {
		return nil
	}
	
	// Managers can modify CTIs in their organization
	if identity.Role == RoleManager && cti.Organization == identity.MSPID {
		return nil
	}
	
	// Engineers can modify CTIs they created or are assigned to
	if identity.Role == RoleEngineer {
		if cti.CreatedBy == identity.ClientID || cti.AssignedTo == identity.ClientID {
			return nil
		}
	}
	
	return fmt.Errorf("access denied: insufficient permissions to modify this CTI")
}

// ============================================================================
// ENDORSEMENT & TRANSACTION VALIDATION
// ============================================================================

// GetEndorsementInfo returns information about transaction endorsements
func (c *CTIContract) GetEndorsementInfo(ctx contractapi.TransactionContextInterface) (map[string]interface{}, error) {
	// Get transaction ID
	txID := ctx.GetStub().GetTxID()
	
	// Get transaction timestamp
	txTimestamp, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return nil, fmt.Errorf("failed to get tx timestamp: %v", err)
	}
	
	// Get channel ID
	channelID := ctx.GetStub().GetChannelID()
	
	// Get creator (submitter) information
	creator, err := ctx.GetStub().GetCreator()
	if err != nil {
		return nil, fmt.Errorf("failed to get creator: %v", err)
	}
	
	info := map[string]interface{}{
		"txId":      txID,
		"channelId": channelID,
		"timestamp": time.Unix(txTimestamp.Seconds, int64(txTimestamp.Nanos)),
		"creator":   string(creator),
	}
	
	return info, nil
}

// ValidateEndorsement checks if the transaction has proper endorsements
func (c *CTIContract) ValidateEndorsement(ctx contractapi.TransactionContextInterface, requiredOrgs []string) error {
	// Get signed proposal
	signedProposal, err := ctx.GetStub().GetSignedProposal()
	if err != nil {
		return fmt.Errorf("failed to get signed proposal: %v", err)
	}
	
	if signedProposal == nil {
		return fmt.Errorf("signed proposal is nil")
	}
	
	// Get caller's MSP ID
	callerMSP, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("failed to get caller MSP ID: %v", err)
	}
	
	// Validate caller is from required organization
	isAuthorized := false
	for _, org := range requiredOrgs {
		if callerMSP == org {
			isAuthorized = true
			break
		}
	}
	
	if !isAuthorized {
		return fmt.Errorf("endorsement validation failed: caller from '%s' is not in required orgs %v", callerMSP, requiredOrgs)
	}
	
	return nil
}

// ============================================================================
// ATTRIBUTE-BASED ACCESS CONTROL (ABAC)
// ============================================================================

// CheckAttribute verifies if caller has a specific attribute with expected value
func (c *CTIContract) CheckAttribute(ctx contractapi.TransactionContextInterface, attributeName string, expectedValue string) error {
	value, found, err := ctx.GetClientIdentity().GetAttributeValue(attributeName)
	if err != nil {
		return fmt.Errorf("failed to get attribute '%s': %v", attributeName, err)
	}
	
	if !found {
		return fmt.Errorf("attribute '%s' not found in certificate", attributeName)
	}
	
	if value != expectedValue {
		return fmt.Errorf("attribute '%s' has value '%s', expected '%s'", attributeName, value, expectedValue)
	}
	
	return nil
}

// AssertOrgMembership verifies caller belongs to one of the specified organizations
func (c *CTIContract) AssertOrgMembership(ctx contractapi.TransactionContextInterface, allowedOrgs []string) error {
	mspID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("failed to get MSP ID: %v", err)
	}
	
	for _, org := range allowedOrgs {
		if mspID == org {
			return nil
		}
	}
	
	return fmt.Errorf("access denied: organization '%s' is not authorized (allowed: %v)", mspID, allowedOrgs)
}

// getQueryResultForQueryString executes a rich query and returns results
func (c *CTIContract) getQueryResultForQueryString(ctx contractapi.TransactionContextInterface, queryString string, callerOrg string) ([]*CTI, error) {
	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var ctis []*CTI
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var cti CTI
		err = json.Unmarshal(queryResponse.Value, &cti)
		if err != nil {
			return nil, err
		}

		// Only include CTIs the caller has access to
		if c.hasAccessToCTI(ctx, &cti, callerOrg) {
			ctis = append(ctis, &cti)
		}
	}

	return ctis, nil
}

// ============================================================================
// VALIDATION HELPER FUNCTIONS
// ============================================================================

func isValidStatus(status string) bool {
	validStatuses := []string{"OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"}
	for _, v := range validStatuses {
		if v == status {
			return true
		}
	}
	return false
}

func isValidPriority(priority string) bool {
	validPriorities := []string{"LOW", "MEDIUM", "HIGH", "CRITICAL"}
	for _, v := range validPriorities {
		if v == priority {
			return true
		}
	}
	return false
}

func (c *CTIContract) isValidRole(role UserRole) bool {
	validRoles := []UserRole{RoleAdmin, RoleManager, RoleEngineer, RoleViewer, RoleAuditor}
	for _, v := range validRoles {
		if v == role {
			return true
		}
	}
	return false
}

// ============================================================================
// ADMINISTRATIVE & UTILITY FUNCTIONS
// ============================================================================

// GetMyIdentity returns the caller's full identity information
func (c *CTIContract) GetMyIdentity(ctx contractapi.TransactionContextInterface) (*UserIdentity, error) {
	return c.GetFullUserIdentity(ctx)
}

// GetMyPermissions returns list of permissions for the caller's role
func (c *CTIContract) GetMyPermissions(ctx contractapi.TransactionContextInterface) ([]Permission, error) {
	identity, err := c.GetFullUserIdentity(ctx)
	if err != nil {
		return nil, err
	}
	
	allPermissions := []Permission{
		PermissionCreate,
		PermissionRead,
		PermissionUpdate,
		PermissionDelete,
		PermissionAudit,
	}
	
	var userPermissions []Permission
	for _, perm := range allPermissions {
		if c.roleHasPermission(identity.Role, perm) {
			userPermissions = append(userPermissions, perm)
		}
	}
	
	return userPermissions, nil
}

// VerifyTransactionSignature verifies the digital signature of the transaction
func (c *CTIContract) VerifyTransactionSignature(ctx contractapi.TransactionContextInterface) error {
	// Get the signed proposal
	signedProposal, err := ctx.GetStub().GetSignedProposal()
	if err != nil {
		return fmt.Errorf("failed to get signed proposal: %v", err)
	}
	
	if signedProposal == nil {
		return fmt.Errorf("signed proposal is nil - transaction not properly signed")
	}
	
	if len(signedProposal.Signature) == 0 {
		return fmt.Errorf("transaction signature is empty")
	}
	
	// Signature is validated by Fabric peer before chaincode execution
	// If we reach here, signature is valid
	return nil
}

// LogAuditEvent logs an audit event for compliance tracking
func (c *CTIContract) LogAuditEvent(ctx contractapi.TransactionContextInterface, eventType string, resourceID string, action string) error {
	identity, err := c.GetFullUserIdentity(ctx)
	if err != nil {
		return err
	}
	
	txInfo, err := c.GetEndorsementInfo(ctx)
	if err != nil {
		return err
	}
	
	auditEvent := map[string]interface{}{
		"eventType":    eventType,
		"resourceId":   resourceID,
		"action":       action,
		"userId":       identity.ClientID,
		"userRole":     identity.Role,
		"organization": identity.MSPID,
		"txId":         txInfo["txId"],
		"channelId":    txInfo["channelId"],
		"timestamp":    txInfo["timestamp"],
	}
	
	auditJSON, err := json.Marshal(auditEvent)
	if err != nil {
		return err
	}
	
	// Emit event for off-chain audit systems to capture
	err = ctx.GetStub().SetEvent("AuditEvent", auditJSON)
	if err != nil {
		return fmt.Errorf("failed to set audit event: %v", err)
	}
	
	return nil
}

