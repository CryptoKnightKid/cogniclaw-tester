# Concierge Onboarding Checklist (v1)

## 1. Account + Subscription
- [ ] Create tenant via `/auth/signup`
- [ ] Confirm Stripe checkout/session completed
- [ ] Verify subscription status is `active` or `trialing`

## 2. Runtime Provisioning
- [ ] Trigger `/internal/tenants/:tenantId/provision`
- [ ] Confirm runtime status in `/dashboard/services`
- [ ] Confirm uptime available in `/dashboard/uptime`

## 3. Provider Setup
- [ ] Collect BYOK credentials or assign managed provider profile
- [ ] Configure `/providers/byok` if customer-supplied key
- [ ] Validate `/providers/status`

## 4. Channels
- [ ] Review `/channels/capabilities`
- [ ] Connect supported channels via `/channels/connect`
- [ ] Verify `/channels/health` is green

## 5. Files + Access
- [ ] Validate signed upload flow (`/files/upload-url` + `/files/complete`)
- [ ] Validate signed download flow (`/files/download-url`)
- [ ] Confirm tenant file isolation via cross-tenant check

## 6. Dashboard Handoff
- [ ] Confirm core widgets: subscription, quota, uptime, channel status
- [ ] Provide customer onboarding call + runbook
- [ ] Set success check-in at day 7 and day 30

## SLA Targets
- Onboarding complete: < 60 minutes
- Tenant health detection: < 5 minutes
- Common runtime recovery: < 30 minutes