const path = require('path');

function asArray(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function valueOrDefault(value, fallback) {
  return value === undefined || value === null || value === '' ? fallback : value;
}

const config = {
  port: Number(valueOrDefault(process.env.PORT, 4000)),
  appEnv: valueOrDefault(process.env.APP_ENV, 'development'),
  jwtSecret: valueOrDefault(process.env.APP_JWT_SECRET, 'dev-secret'),
  encryptionKey: valueOrDefault(process.env.APP_ENCRYPTION_KEY, 'dev-encryption-key-32-bytes-minimum'),
  dataFile: path.resolve(valueOrDefault(process.env.APP_DATA_FILE, './src/data/control-plane.json')),
  internalApiKey: valueOrDefault(process.env.INTERNAL_API_KEY, 'internal-dev-key'),
  stripe: {
    secretKey: valueOrDefault(process.env.STRIPE_SECRET_KEY, ''),
    webhookSecret: valueOrDefault(process.env.STRIPE_WEBHOOK_SECRET, ''),
    prices: {
      starter: valueOrDefault(process.env.STRIPE_PRICE_STARTER, ''),
      growth: valueOrDefault(process.env.STRIPE_PRICE_GROWTH, ''),
      scale: valueOrDefault(process.env.STRIPE_PRICE_SCALE, '')
    }
  },
  aws: {
    region: valueOrDefault(process.env.AWS_REGION, 'us-east-1'),
    s3Bucket: valueOrDefault(process.env.S3_BUCKET, ''),
    ecsCluster: valueOrDefault(process.env.ECS_CLUSTER, ''),
    ecsTaskDefinition: valueOrDefault(process.env.ECS_TASK_DEFINITION, ''),
    ecsSubnets: asArray(process.env.ECS_SUBNETS),
    ecsSecurityGroups: asArray(process.env.ECS_SECURITY_GROUPS),
    secretsPrefix: valueOrDefault(process.env.SECRETS_PREFIX, 'cogniclaw/tenants')
  },
  channelCapabilitiesOverride: asArray(process.env.OPENCLAW_CHANNEL_CAPABILITIES)
};

module.exports = { config };