const { SecretsManagerClient, CreateSecretCommand, PutSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { config } = require('../../config/env');
const logger = require('../../lib/logger');

class SecretsAdapter {
  constructor() {
    this.client = new SecretsManagerClient({ region: config.aws.region });
  }

  enabled() {
    return Boolean(config.aws.secretsPrefix);
  }

  secretName(tenantId, provider) {
    return `${config.aws.secretsPrefix}/${tenantId}/providers/${provider}`;
  }

  async upsertProviderSecret({ tenantId, provider, secretValue }) {
    if (!this.enabled()) {
      return {
        mode: 'mock',
        secretRef: `mock://${tenantId}/${provider}`
      };
    }

    const name = this.secretName(tenantId, provider);

    try {
      await this.client.send(
        new CreateSecretCommand({
          Name: name,
          SecretString: secretValue
        })
      );
    } catch (error) {
      if (!String(error.name || '').includes('ResourceExistsException')) {
        logger.error('secrets.create.failed', { tenantId, provider, error: error.message });
      }

      await this.client.send(
        new PutSecretValueCommand({
          SecretId: name,
          SecretString: secretValue
        })
      );
    }

    return {
      mode: 'aws-secrets-manager',
      secretRef: name
    };
  }
}

module.exports = { SecretsAdapter };
