# CTI Chaincode - Quick Reference

## 🔐 Security Functions Quick Reference

### Identity & Certificate Validation
```go
// Get complete validated user identity
identity, err := c.GetFullUserIdentity(ctx)
// Returns: ClientID, MSPID, Role, CommonName, Attributes
// Validates: Certificate expiry, validity, role

// Get simplified identity
clientID, mspID, err := c.getCallerIdentity(ctx)

// Validate a certificate
err := c.ValidateCertificate(certPEM)

// Get my identity
identity, err := c.GetMyIdentity(ctx)

// Get my permissions
permissions, err := c.GetMyPermissions(ctx)
```

### Permission Checks
```go
// Check if user has permission
err := c.CheckPermission(ctx, PermissionCreate)
err := c.CheckPermission(ctx, PermissionRead)
err := c.CheckPermission(ctx, PermissionUpdate)
err := c.CheckPermission(ctx, PermissionDelete)
err := c.CheckPermission(ctx, PermissionAudit)

// Check if user can modify specific CTI
err := c.CanModifyCTI(ctx, cti)

// Check organization-based access
hasAccess := c.hasAccessToCTI(ctx, cti, callerOrg)
```

### Signature & Endorsement
```go
// Verify transaction signature
err := c.VerifyTransactionSignature(ctx)

// Validate endorsement from required orgs
requiredOrgs := []string{"Org1MSP", "Org2MSP"}
err := c.ValidateEndorsement(ctx, requiredOrgs)

// Get endorsement information
info, err := c.GetEndorsementInfo(ctx)
// Returns: txId, channelId, timestamp, creator
```

### Attribute-Based Access
```go
// Check specific attribute value
err := c.CheckAttribute(ctx, "department", "engineering")

// Assert organization membership
allowedOrgs := []string{"Org1MSP", "Org2MSP"}
err := c.AssertOrgMembership(ctx, allowedOrgs)
```

### Audit Logging
```go
// Log audit event
err := c.LogAuditEvent(ctx, "CTI", "CTI001", "CREATE")
```

---

## 🎭 Roles & Permissions Matrix

| Role | Create | Read | Update | Delete | Audit | Cross-Org |
|------|--------|------|--------|--------|-------|-----------|
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Manager** | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Engineer** | ✅ | ✅ | ✅* | ❌ | ❌ | ❌ |
| **Viewer** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Auditor** | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |

*Engineers can only update CTIs they created or are assigned to

---

## 📝 CRUD Operations

### Create CTI
```bash
peer chaincode invoke -C mychannel -n cti \
  -c '{"function":"CreateCTI","Args":["CTI001","Title","Description","OPEN","HIGH","Technical","user@org1","{}"]}'
```

### Read CTI
```bash
peer chaincode query -C mychannel -n cti \
  -c '{"function":"ReadCTI","Args":["CTI001"]}'
```

### Update CTI
```bash
peer chaincode invoke -C mychannel -n cti \
  -c '{"function":"UpdateCTI","Args":["CTI001","New Title","New Description","IN_PROGRESS","CRITICAL","Technical","user@org1","{}"]}'
```

### Delete CTI
```bash
peer chaincode invoke -C mychannel -n cti \
  -c '{"function":"DeleteCTI","Args":["CTI001"]}'
```

---

## 🔍 Query Operations

### Get All CTIs
```bash
peer chaincode query -C mychannel -n cti \
  -c '{"function":"GetAllCTIs","Args":[]}'
```

### Query by Status
```bash
peer chaincode query -C mychannel -n cti \
  -c '{"function":"QueryCTIsByStatus","Args":["OPEN"]}'
```

### Query by Priority
```bash
peer chaincode query -C mychannel -n cti \
  -c '{"function":"QueryCTIsByPriority","Args":["CRITICAL"]}'
```

### Query by Category
```bash
peer chaincode query -C mychannel -n cti \
  -c '{"function":"QueryCTIsByCategory","Args":["Technical"]}'
```

### Query by Organization
```bash
peer chaincode query -C mychannel -n cti \
  -c '{"function":"QueryCTIsByOrganization","Args":["Org1MSP"]}'
```

### Query by Assignee
```bash
peer chaincode query -C mychannel -n cti \
  -c '{"function":"QueryCTIsByAssignee","Args":["engineer@org1"]}'
```

---

## 📊 History & Audit

### Get CTI History
```bash
peer chaincode query -C mychannel -n cti \
  -c '{"function":"GetCTIHistory","Args":["CTI001"]}'
```

### Add Document Reference
```bash
peer chaincode invoke -C mychannel -n cti \
  -c '{"function":"AddDocumentReference","Args":["CTI001","document-ref-123"]}'
```

---

## 🛠️ Utility Functions

### Check if CTI Exists
```bash
peer chaincode query -C mychannel -n cti \
  -c '{"function":"CTIExists","Args":["CTI001"]}'
```

### Get My Identity
```bash
peer chaincode query -C mychannel -n cti \
  -c '{"function":"GetMyIdentity","Args":[]}'
```

### Get My Permissions
```bash
peer chaincode query -C mychannel -n cti \
  -c '{"function":"GetMyPermissions","Args":[]}'
```

---

## 📋 Valid Values

### Status
- `OPEN`
- `IN_PROGRESS`
- `RESOLVED`
- `CLOSED`

### Priority
- `LOW`
- `MEDIUM`
- `HIGH`
- `CRITICAL`

### Roles
- `admin`
- `manager`
- `engineer`
- `viewer`
- `auditor`

---

## 🚀 Deployment Commands

### Package Chaincode
```bash
peer lifecycle chaincode package cti.tar.gz \
  --path ./chaincode/cti \
  --lang golang \
  --label cti_1.0
```

### Install Chaincode
```bash
peer lifecycle chaincode install cti.tar.gz
```

### Approve for Organization
```bash
peer lifecycle chaincode approveformyorg \
  --channelID mychannel \
  --name cti \
  --version 1.0 \
  --package-id $PACKAGE_ID \
  --sequence 1
```

### Commit Chaincode
```bash
peer lifecycle chaincode commit \
  --channelID mychannel \
  --name cti \
  --version 1.0 \
  --sequence 1 \
  --signature-policy "OR('Org1MSP.member','Org2MSP.member')"
```

---

## 🎯 Common Endorsement Policies

### OR Policy (Either org)
```bash
--signature-policy "OR('Org1MSP.member','Org2MSP.member')"
```

### AND Policy (Both orgs)
```bash
--signature-policy "AND('Org1MSP.member','Org2MSP.member')"
```

### Majority (2 of 3)
```bash
--signature-policy "OutOf(2, 'Org1MSP.member', 'Org2MSP.member', 'Org3MSP.member')"
```

### Admin Only
```bash
--signature-policy "OR('Org1MSP.admin','Org2MSP.admin')"
```

---

## 🚨 Common Errors

### "certificate has expired"
**Solution**: Re-enroll user with Fabric CA
```bash
fabric-ca-client enroll -u https://user:password@ca.org1.com:7054
```

### "access denied: role 'viewer' does not have 'create' permission"
**Solution**: Use user with appropriate role or assign correct role

### "access denied: you don't have access to this CTI"
**Solution**: Use account from the CTI's organization or use admin account

### "endorsement policy failure"
**Solution**: Provide --peerAddresses for all required organizations

---

## 🔧 Configuration

### Enroll User with Attributes
```bash
fabric-ca-client register \
  --id.name engineer@org1 \
  --id.secret password \
  --id.type client \
  --id.attrs 'role=engineer:ecert,department=engineering:ecert,email=engineer@org1.com:ecert'

fabric-ca-client enroll \
  -u https://engineer@org1:password@ca.org1.com:7054 \
  --enrollment.attrs "role,department,email"
```

### Required Certificate Attributes
- `role` - User role (required)
- `department` - Department name (optional)
- `email` - User email (optional)

---

## 📚 Documentation Links

- **Full API Documentation**: `README.md`
- **Security Details**: `SECURITY.md`
- **Endorsement Policies**: `ENDORSEMENT_POLICIES.md`
- **Backend Integration**: `INTEGRATION.md`
- **Deployment Script**: `scripts/deploy.sh`
- **Test Script**: `scripts/test.sh`

---

## 💡 Tips

1. **Always check certificate expiry** before operations
2. **Use appropriate role** for each user
3. **Test endorsement policies** in dev before production
4. **Monitor audit logs** for compliance
5. **Use admin sparingly** - prefer least privilege
6. **Engineers can only modify their own CTIs** - use manager for others
7. **Auditors have read-only access** across all orgs
8. **Viewers are read-only** for their org

---

## 🔗 Quick Links

- Deploy: `cd chaincode/cti && ./scripts/deploy.sh`
- Test: `cd chaincode/cti && ./scripts/test.sh`
- Build: `cd chaincode/cti && go build`
- Unit Test: `cd chaincode/cti && go test -v`

---

## 📞 Function Call Examples (Go)

### In Chaincode
```go
// Validate identity
identity, err := c.GetFullUserIdentity(ctx)
if err != nil {
    return fmt.Errorf("identity validation failed: %v", err)
}

// Check permission
if err := c.CheckPermission(ctx, PermissionCreate); err != nil {
    return err
}

// Verify signature
if err := c.VerifyTransactionSignature(ctx); err != nil {
    return fmt.Errorf("signature verification failed: %v", err)
}

// Check organization
if err := c.AssertOrgMembership(ctx, []string{"Org1MSP"}); err != nil {
    return err
}

// Log audit
c.LogAuditEvent(ctx, "CTI", "CTI001", "CREATE")
```

---

## 🎓 Learning Path

1. **Start**: Read `README.md` for overview
2. **Security**: Read `SECURITY.md` for security details
3. **Deploy**: Run `./scripts/deploy.sh`
4. **Test**: Run `./scripts/test.sh`
5. **Integrate**: Follow `INTEGRATION.md` for backend
6. **Customize**: Modify access control as needed
7. **Monitor**: Set up audit log monitoring

---

**Version**: 1.0
**Last Updated**: November 6, 2025

