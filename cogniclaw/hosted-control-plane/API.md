# API Quick Reference

## Auth

### Signup
`POST /auth/signup`

```json
{
  "organizationName": "Acme Ops",
  "email": "owner@acme.com",
  "password": "strong-password",
  "displayName": "Owner"
}
```

### Login
`POST /auth/login`

### Logout
`POST /auth/logout` (Bearer token)

## Tenant

### Get tenant context
`GET /tenant`

### Patch tenant settings
`PATCH /tenant/settings`

```json
{
  "region": "us-east-1",
  "timeZone": "Australia/Sydney",
  "locale": "en-AU",
  "preferences": {
    "theme": "dark"
  }
}
```

## Billing

### Get subscription
`GET /billing/subscription`

### Create checkout session
`POST /billing/checkout-session`

```json
{
  "plan": "growth",
  "successUrl": "https://app.example.com/billing/success",
  "cancelUrl": "https://app.example.com/billing/cancel"
}
```

### Stripe webhook
`POST /billing/webhooks/stripe`

## Providers (BYOK)

### List providers
`GET /providers`

### Connect BYOK
`POST /providers/byok`

```json
{
  "provider": "openai",
  "apiKey": "sk-...",
  "model": "gpt-4o-mini"
}
```

### Provider status
`GET /providers/status`

## Usage and Quota

- `GET /usage/summary`
- `GET /usage/history?limit=100`
- `GET /usage/quota`

## Dashboard

- `GET /dashboard/uptime`
- `GET /dashboard/services`
- `GET /dashboard/runs?limit=20`
- `GET /dashboard/channels`

## Files

### Create upload URL
`POST /files/upload-url`

```json
{
  "fileName": "contracts/q1.pdf",
  "contentType": "application/pdf",
  "sizeBytes": 102400
}
```

### Complete upload
`POST /files/complete`

```json
{
  "fileId": "fil_xxx",
  "etag": "etag-value"
}
```

### List files
`GET /files/list?limit=50`

### Create download URL
`POST /files/download-url`

```json
{
  "fileId": "fil_xxx"
}
```

## Channels

- `GET /channels/capabilities`
- `POST /channels/connect`
- `GET /channels/health`

### Connect channel example

```json
{
  "channel": "discord",
  "config": {
    "guildId": "123",
    "channelId": "456",
    "botToken": "secret"
  }
}
```

## Internal (concierge only)

Requires `x-internal-api-key` header.

- `POST /internal/tenants/:tenantId/provision`
- `POST /internal/tenants/:tenantId/runtime/:action`
- `POST /internal/heartbeat`