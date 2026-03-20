# CogniClaw Hosted Control Plane (v1 Foundation)

This module implements a hosted SaaS control plane for CogniClaw with:

- Multi-tenant account + tenant management
- Single-tenant runtime orchestration hooks (ECS Fargate adapter)
- Stripe subscription lifecycle endpoints
- BYOK provider connection flow with encrypted secret references
- Mission Control API surfaces (uptime, services, runs, channels)
- S3 signed upload/download URL workflow for tenant-isolated file transfer
- Channel capability detection from OpenClaw (with override)

## Included API Surface

### Auth & Tenant
- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /tenant`
- `PATCH /tenant/settings`

### Billing & Entitlements
- `GET /billing/subscription`
- `POST /billing/checkout-session`
- `POST /billing/webhooks/stripe`
- `GET /entitlements`

### Providers
- `GET /providers`
- `POST /providers/byok`
- `GET /providers/status`

### Usage + Quota
- `GET /usage/summary`
- `GET /usage/history`
- `GET /usage/quota`

### Mission Control
- `GET /dashboard/uptime`
- `GET /dashboard/services`
- `GET /dashboard/runs`
- `GET /dashboard/channels`

### Files
- `POST /files/upload-url`
- `POST /files/complete`
- `GET /files/list`
- `POST /files/download-url`

### Channels
- `GET /channels/capabilities`
- `POST /channels/connect`
- `GET /channels/health`

### Internal concierge/provisioning
- `POST /internal/tenants/:tenantId/provision`
- `POST /internal/tenants/:tenantId/runtime/:action`
- `POST /internal/heartbeat`

## Quick Start

1. Copy env file:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
npm install
```

3. Start server:

```bash
npm run dev
```

4. Health check:

```bash
curl http://localhost:4000/healthz
```

## Notes on Production

- Current persistence is file-backed JSON for local/dev bootstrap.
- Production DB target is PostgreSQL (`src/data/schema.sql`).
- BYOK values are encrypted before storage reference writes.
- Real Stripe verification is used when Stripe secrets are configured.
- S3 signed URLs are used when `S3_BUCKET` is configured.
- ECS adapter provisions runtimes when ECS config is present; falls back to mock mode otherwise.

## Security Baseline Implemented

- JWT auth with token revocation list
- Tenant-scoped access controls on all tenant resources
- Secret-masked responses for provider/channel configs
- AES-256-GCM encryption for BYOK payload before secret-store write
- Audit events for sensitive actions

## Next Step To Reach Full Production Plan

- Replace file store with PostgreSQL repositories
- Add migration runner and idempotent schema management
- Add Redis/SQS for async orchestration and retries
- Add full Stripe idempotency + replay protection table
- Add dashboard frontend and admin operations console
- Add SOC2-ready controls/evidence pipeline