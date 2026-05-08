# Hyperledger Fabric CTI Management System

A Case Tracking Information (CTI) system built on Hyperledger Fabric. Users register, enroll with a Fabric CA, and interact with a Go chaincode deployed on a permissioned blockchain channel.

## Project Structure

```
.
├── chaincode/cti/          Go chaincode — CTI CRUD, RBAC, audit logging
├── backend/                Node.js API server — Phases 1–5
│   ├── src/
│   │   ├── server.js       Express app entry point
│   │   ├── db.js           In-memory user & request store
│   │   ├── gatewayPool.js  Persistent Fabric Gateway connection pool
│   │   └── routes/
│   │       ├── auth.js     Phases 1–3: register / enroll / login
│   │       └── cti.js      Phases 4–5: CTI CRUD & queries
│   └── tests/              Jest test suite (54 tests, no live network needed)
└── docs/
    ├── diagrams/           Sequence diagram PNGs and Mermaid source files
    ├── guides/             Deployment, testing, and integration guides
    │   └── chaincode/      Chaincode-specific docs (RBAC, endorsement policy)
    └── specs/              Original specification PDFs and documents
```

## Phase Overview

| Phase | Description | Key Endpoint |
|-------|-------------|--------------|
| 1 | Registration & admin approval | `POST /api/auth/register-request` |
| 2 | CA enrollment & user creation | `POST /api/auth/enroll` |
| 3 | Login (password + key↔cert verify) | `POST /api/auth/login` |
| 4 | Create CTI on ledger | `POST /api/cti` |
| 5 | Query & retrieve CTI | `GET /api/cti` |

## Quick Start

```bash
# 1. Configure environment
cp .env.example backend/.env
# Edit backend/.env with your peer endpoint, CA URL, and session secret

# 2. Install backend dependencies
cd backend && npm install

# 3. Run tests (no live network required)
npm test

# 4. Start the backend
npm start
```

## Chaincode

```bash
cd chaincode/cti
go test ./...          # unit tests
# See docs/guides/deployment-guide.md for full network deployment
```

## Documentation

- [Quick Start](docs/guides/quick-start.md)
- [Deployment Guide](docs/guides/deployment-guide.md)
- [Testing Guide](docs/guides/testing-guide.md)
- [Chaincode Overview](docs/guides/chaincode-overview.md)
- [Security](docs/guides/chaincode/security.md)
- [Integration](docs/guides/chaincode/integration.md)
# fabric
