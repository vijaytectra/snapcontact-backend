# SnapContact

> **Your Screenshots Organized** — Turn saved numbers into contacts automatically.

Offline-first, privacy-respecting cross-platform contact capture utility for iOS, Android, and Web.

## Documentation Pointers

- **[Complete App Details & Architecture](APP_DETAILS.md)** — Exhaustive specification of the 5-screen UI flow, tech stack, native Android Quick Capture module, entity parsing, security/privacy model, and subscription system.
- **[Project Work Summary](PROJECT_WORK_SUMMARY.md)** — Comprehensive engineering log, setup history, bug fixes, port conflict resolution, and feature implementations.
- **[Deployment Guide](docs/DEPLOYMENT.md)** — Production deployment and cloud operations runbook.
- **[SnapContact Package Details](artifacts/snapcontact/README.md)** — Expo and native module setup.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start Backend API Server (Port 5001)
pnpm --filter @workspace/api-server run dev

# Start Frontend Expo App (Port 8081)
pnpm --filter @workspace/snapcontact run dev

# Run all 56 tests
pnpm --filter @workspace/snapcontact run test
```

