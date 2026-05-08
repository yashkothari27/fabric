# Endorsement Policies for CTI Chaincode

## Overview

Endorsement policies define which organizations must validate (endorse) a transaction before it can be committed to the blockchain. This document explains how to configure endorsement policies for the CTI chaincode.

---

## 📋 Endorsement Policy Basics

### What is an Endorsement Policy?

An endorsement policy specifies:
- **Which organizations** must endorse a transaction
- **How many endorsements** are required
- **Combination logic** (AND/OR) between organizations

### Policy Syntax

Fabric uses policy expressions with the following operators:
- `AND('Org1MSP.member', 'Org2MSP.member')` - Both organizations must endorse
- `OR('Org1MSP.member', 'Org2MSP.member')` - Either organization must endorse
- `OutOf(2, 'Org1MSP.member', 'Org2MSP.member', 'Org3MSP.member')` - 2 out of 3 organizations

---

## 🔧 Setting Endorsement Policies

### During Chaincode Deployment

#### Option 1: Simple Majority Policy (Default)
```bash
peer lifecycle chaincode commit \
  --channelID mychannel \
  --name cti \
  --version 1.0 \
  --sequence 1 \
  --signature-policy "OR('Org1MSP.member','Org2MSP.member')"
```
**Effect**: Either Org1 OR Org2 can endorse transactions

#### Option 2: Require All Organizations
```bash
peer lifecycle chaincode commit \
  --channelID mychannel \
  --name cti \
  --version 1.0 \
  --sequence 1 \
  --signature-policy "AND('Org1MSP.member','Org2MSP.member')"
```
**Effect**: BOTH Org1 AND Org2 must endorse every transaction

#### Option 3: Majority of Organizations (2 of 3)
```bash
peer lifecycle chaincode commit \
  --channelID mychannel \
  --name cti \
  --version 1.0 \
  --sequence 1 \
  --signature-policy "OutOf(2, 'Org1MSP.member', 'Org2MSP.member', 'Org3MSP.member')"
```
**Effect**: Any 2 out of 3 organizations must endorse

#### Option 4: Channel Default Policy
```bash
peer lifecycle chaincode commit \
  --channelID mychannel \
  --name cti \
  --version 1.0 \
  --sequence 1
```
**Effect**: Uses channel's default endorsement policy (usually majority)

---

## 🎯 Recommended Policies by Use Case

### Use Case 1: Development/Testing
```bash
--signature-policy "OR('Org1MSP.member')"
```
- Single organization can endorse
- Fast development cycles
- No redundancy required

### Use Case 2: Production - Standard Security
```bash
--signature-policy "OR('Org1MSP.member','Org2MSP.member')"
```
- Multiple organizations available
- Either can endorse independently
- High availability

### Use Case 3: Production - High Security
```bash
--signature-policy "AND('Org1MSP.member','Org2MSP.member')"
```
- All organizations must agree
- Maximum security
- Slower transaction processing

### Use Case 4: Consortium - Majority Approval
```bash
--signature-policy "OutOf(3, 'Org1MSP.member', 'Org2MSP.member', 'Org3MSP.member', 'Org4MSP.member')"
```
- 3 out of 4 organizations must endorse
- Balances security with availability
- Fault tolerant (1 org can be down)

### Use Case 5: Mixed Trust Model
```bash
--signature-policy "AND('Org1MSP.admin', OR('Org2MSP.member', 'Org3MSP.member'))"
```
- Org1 admin MUST approve
- PLUS either Org2 or Org3 must approve
- Hierarchical approval model

---

## 🔐 Role-Based Endorsement Policies

### Admin-Only Approval
```bash
--signature-policy "OR('Org1MSP.admin','Org2MSP.admin')"
```
Only administrators can endorse transactions

### Peer-Specific Policy
```bash
--signature-policy "OR('Org1MSP.peer','Org2MSP.peer')"
```
Only peer identities (not clients) can endorse

### Member-Based Policy
```bash
--signature-policy "OR('Org1MSP.member','Org2MSP.member')"
```
Any member of the organization can endorse

---

## 📝 Policy Configuration File Format

### collection-config.json (For Private Data - Optional)
```json
[
  {
    "name": "ctiPrivateData",
    "policy": "OR('Org1MSP.member', 'Org2MSP.member')",
    "requiredPeerCount": 1,
    "maxPeerCount": 2,
    "blockToLive": 100,
    "memberOnlyRead": true,
    "memberOnlyWrite": true,
    "endorsementPolicy": {
      "signaturePolicy": "AND('Org1MSP.member', 'Org2MSP.member')"
    }
  }
]
```

Deploy with collection config:
```bash
peer lifecycle chaincode commit \
  --channelID mychannel \
  --name cti \
  --version 1.0 \
  --sequence 1 \
  --signature-policy "OR('Org1MSP.member','Org2MSP.member')" \
  --collections-config ./collection-config.json
```

---

## 🛡️ Chaincode-Level Endorsement Validation

### In CTI Chaincode

The chaincode includes a `ValidateEndorsement()` function to add **additional validation** on top of Fabric's endorsement policy:

```go
func (c *CTIContract) CreateCriticalCTI(...) error {
    // Require endorsement from both Org1 and Org2 (in addition to channel policy)
    requiredOrgs := []string{"Org1MSP", "Org2MSP"}
    if err := c.ValidateEndorsement(ctx, requiredOrgs); err != nil {
        return fmt.Errorf("critical CTI requires endorsement from Org1 and Org2")
    }
    
    // ... rest of creation logic
}
```

This adds an **extra layer** of validation within the smart contract itself.

---

## 🔄 Updating Endorsement Policies

### Step 1: Approve New Definition with Updated Policy
```bash
export PACKAGE_ID=cti_1.0:abc123...

peer lifecycle chaincode approveformyorg \
  --channelID mychannel \
  --name cti \
  --version 1.0 \
  --package-id $PACKAGE_ID \
  --sequence 2 \
  --signature-policy "AND('Org1MSP.member','Org2MSP.member')"
```

### Step 2: Commit Updated Definition
```bash
peer lifecycle chaincode commit \
  --channelID mychannel \
  --name cti \
  --version 1.0 \
  --sequence 2 \
  --signature-policy "AND('Org1MSP.member','Org2MSP.member')"
```

**Note**: Increment the `--sequence` number when updating policies.

---

## 🧪 Testing Endorsement Policies

### Test 1: Single Organization Endorsement
```bash
# With policy: OR('Org1MSP.member','Org2MSP.member')
peer chaincode invoke \
  -C mychannel \
  -n cti \
  --peerAddresses peer0.org1.example.com:7051 \
  --tlsRootCertFiles ${PWD}/crypto/peerOrganizations/org1/peers/peer0/tls/ca.crt \
  -c '{"function":"CreateCTI","Args":["CTI001","Test","Test Description","OPEN","HIGH","Technical","user@org1","{}"]}'
```
**Expected**: Success (Org1 endorsement sufficient)

### Test 2: Multi-Organization Endorsement
```bash
# With policy: AND('Org1MSP.member','Org2MSP.member')
peer chaincode invoke \
  -C mychannel \
  -n cti \
  --peerAddresses peer0.org1.example.com:7051 \
  --tlsRootCertFiles ${PWD}/crypto/peerOrganizations/org1/peers/peer0/tls/ca.crt \
  --peerAddresses peer0.org2.example.com:9051 \
  --tlsRootCertFiles ${PWD}/crypto/peerOrganizations/org2/peers/peer0/tls/ca.crt \
  -c '{"function":"CreateCTI","Args":["CTI001","Test","Test Description","OPEN","HIGH","Technical","user@org1","{}"]}'
```
**Expected**: Success (Both Org1 and Org2 endorse)

### Test 3: Insufficient Endorsements
```bash
# With policy: AND('Org1MSP.member','Org2MSP.member')
# But only providing Org1 peer
peer chaincode invoke \
  -C mychannel \
  -n cti \
  --peerAddresses peer0.org1.example.com:7051 \
  --tlsRootCertFiles ${PWD}/crypto/peerOrganizations/org1/peers/peer0/tls/ca.crt \
  -c '{"function":"CreateCTI","Args":["CTI001","Test","Test Description","OPEN","HIGH","Technical","user@org1","{}"]}'
```
**Expected**: Failure - "endorsement policy failure"

---

## 🎯 Operation-Specific Endorsement Requirements

### Different Policies for Different Operations

#### Option 1: Channel-Level Configuration
Set different policies per function in channel config:
```json
{
  "CreateCTI": "AND('Org1MSP.member', 'Org2MSP.member')",
  "UpdateCTI": "AND('Org1MSP.member', 'Org2MSP.member')",
  "DeleteCTI": "AND('Org1MSP.admin', 'Org2MSP.admin')",
  "ReadCTI": "OR('Org1MSP.member', 'Org2MSP.member')"
}
```

#### Option 2: Chaincode-Level Validation
Implement in chaincode:
```go
func (c *CTIContract) DeleteCTI(...) error {
    // Delete requires endorsement from admins of both orgs
    identity, _ := c.GetFullUserIdentity(ctx)
    if identity.Role != RoleAdmin {
        return fmt.Errorf("delete requires admin role")
    }
    
    // Validate both orgs endorsed
    requiredOrgs := []string{"Org1MSP", "Org2MSP"}
    if err := c.ValidateEndorsement(ctx, requiredOrgs); err != nil {
        return err
    }
    
    // ... deletion logic
}
```

---

## 📊 Endorsement Policy Decision Matrix

| Scenario | Organizations | Policy | Reasoning |
|----------|---------------|--------|-----------|
| Dev/Test | 1 | `OR('Org1MSP.member')` | Speed |
| Low Risk | 2-3 | `OR('Org1MSP.member','Org2MSP.member')` | Availability |
| Medium Risk | 2-3 | `OutOf(2, 'Org1', 'Org2', 'Org3')` | Balance |
| High Risk | 2-4 | `AND('Org1MSP.member','Org2MSP.member')` | Security |
| Critical | 3+ | `OutOf(3, 'Org1', 'Org2', 'Org3', 'Org4')` | Consensus |
| Regulatory | Any | `AND('Org1MSP.admin','Org2MSP.admin')` | Compliance |

---

## 🚨 Common Issues & Troubleshooting

### Issue 1: "Endorsement Policy Failure"
**Cause**: Not enough organizations endorsed the transaction
**Solution**: Provide `--peerAddresses` for all required organizations in invoke command

### Issue 2: "VSCC Endorsement Policy Failure"
**Cause**: Endorsement policy validation failed at commit time
**Solution**: Ensure all required organizations' peers are online and endorsing

### Issue 3: "Policy Not Satisfied"
**Cause**: Wrong organizations endorsed
**Solution**: Check policy requires the endorsing organizations (e.g., policy requires Org1, but Org2 endorsed)

### Issue 4: "MSP Principal Deserialization Error"
**Cause**: Invalid MSP ID in policy
**Solution**: Verify MSP IDs match those configured in channel (check `configtx.yaml`)

---

## 📚 Best Practices

### 1. **Start Simple, Scale Security**
- Begin with `OR` policy in development
- Move to `AND` or `OutOf` in production

### 2. **Consider Availability**
- `AND` policies require all orgs online
- `OutOf` provides fault tolerance
- `OR` maximizes availability

### 3. **Balance Security vs. Performance**
- More endorsers = More security
- More endorsers = Slower transactions
- Find the right balance for your use case

### 4. **Test Policy Changes**
- Test new policies in dev/staging first
- Verify all scenarios (success and failure)
- Have rollback plan ready

### 5. **Document Your Policies**
- Maintain policy documentation
- Explain why specific policies chosen
- Document any changes and reasons

### 6. **Use Chaincode Validation as Extra Layer**
- Don't rely solely on channel policy
- Add validation logic in chaincode for critical operations
- Use `ValidateEndorsement()` for additional checks

---

## 🔗 Integration with CTI Chaincode Security

The endorsement policies work in conjunction with the chaincode's built-in security:

```
Transaction Flow:
1. Client submits proposal to peers
2. Peers validate certificate (Fabric layer)
3. Peers execute chaincode:
   ├─ VerifyTransactionSignature()
   ├─ CheckPermission()
   ├─ GetFullUserIdentity()
   └─ ValidateEndorsement() (optional, in chaincode)
4. Peers endorse if validation successful
5. Client collects endorsements
6. Client submits to orderer
7. Orderer checks endorsement policy satisfied
8. If satisfied, block created and distributed
9. Peers validate endorsements against policy (VSCC)
10. If valid, transaction committed
```

**Multi-layer security:**
- **Layer 1**: Certificate validation (Fabric)
- **Layer 2**: Chaincode access control
- **Layer 3**: Endorsement policy (Fabric)
- **Layer 4**: Chaincode endorsement validation
- **Layer 5**: Commit-time policy validation (VSCC)

---

## Summary

Endorsement policies are a **critical security feature** that:
- Define which organizations must validate transactions
- Provide consensus and trust in multi-organization networks
- Can be configured at channel or chaincode level
- Work alongside chaincode access control for defense-in-depth

Choose policies that match your:
- **Security requirements** (how many orgs must agree?)
- **Availability requirements** (can you tolerate org downtime?)
- **Performance requirements** (how fast must transactions commit?)
- **Trust model** (equal trust or hierarchical?)

