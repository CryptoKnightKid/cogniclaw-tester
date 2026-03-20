# AWS Deployment Baseline (ECS Fargate)

This folder contains baseline artifacts to align with the hosted-control-plane plan.

## Resources

- ECS cluster for tenant runtime tasks
- ECS service/task definition for control plane
- S3 bucket for tenant file storage
- Secrets Manager namespace for BYOK references
- CloudWatch log groups for control plane + tenant runtimes

## Minimal Environment Variables

- `AWS_REGION`
- `S3_BUCKET`
- `ECS_CLUSTER`
- `ECS_TASK_DEFINITION`
- `ECS_SUBNETS` (comma separated)
- `ECS_SECURITY_GROUPS` (comma separated)
- `SECRETS_PREFIX`

## Suggested Split

- `control-plane` service:
  - public API + auth + Stripe webhooks
  - private admin/provisioning endpoints
- `tenant-runtime` tasks:
  - one isolated runtime per tenant
  - tenant-specific env vars and secret refs

## IAM Guidance

Control-plane task role should have least privilege for:
- `ecs:RunTask`, `ecs:DescribeServices`, `ecs:UpdateService`
- `secretsmanager:CreateSecret`, `secretsmanager:PutSecretValue`
- `s3:GetObject`, `s3:PutObject`, `s3:ListBucket` limited to tenant prefixes
- `kms:Encrypt`, `kms:Decrypt` for managed keys

Use account-level CloudTrail + CloudWatch alarms for API failures and auth anomalies.