const { z } = require('zod');
const { createId, nowIso } = require('../lib/utils');
const { encryptText } = require('../lib/crypto');
const { config } = require('../config/env');

const byokSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'gemini', 'kimi', 'custom']),
  apiKey: z.string().min(8),
  baseUrl: z.string().url().optional(),
  model: z.string().min(2).optional()
});

function maskSecret(apiKey) {
  if (!apiKey || apiKey.length < 8) return '***';
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

class ProviderService {
  constructor(store, secretsAdapter, auditService) {
    this.store = store;
    this.secretsAdapter = secretsAdapter;
    this.auditService = auditService;
  }

  listProviders(tenantId) {
    return this.store
      .list('provider_connections', (item) => item.tenantId === tenantId)
      .map((item) => ({
        id: item.id,
        provider: item.provider,
        kind: item.kind,
        status: item.status,
        metadata: item.metadata,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }));
  }

  async connectByok(tenantId, userId, rawInput) {
    const input = byokSchema.parse(rawInput);

    const encrypted = encryptText(input.apiKey, config.encryptionKey);
    const secretPayload = {
      encrypted,
      provider: input.provider,
      updatedAt: nowIso()
    };

    const secretResult = await this.secretsAdapter.upsertProviderSecret({
      tenantId,
      provider: input.provider,
      secretValue: JSON.stringify(secretPayload)
    });

    const connection = this.store.upsert(
      'provider_connections',
      (record) => record.tenantId === tenantId && record.provider === input.provider && record.kind === 'byok',
      (existing, exists) => {
        if (exists) {
          return {
            ...existing,
            status: 'active',
            encryptedSecretRef: secretResult.secretRef,
            metadata: {
              ...existing.metadata,
              baseUrl: input.baseUrl || existing.metadata.baseUrl || null,
              model: input.model || existing.metadata.model || null,
              keyMask: maskSecret(input.apiKey),
              secretStoreMode: secretResult.mode,
              rotatedAt: nowIso()
            }
          };
        }

        return {
          id: createId('prv'),
          tenantId,
          provider: input.provider,
          kind: 'byok',
          encryptedSecretRef: secretResult.secretRef,
          metadata: {
            baseUrl: input.baseUrl || null,
            model: input.model || null,
            keyMask: maskSecret(input.apiKey),
            secretStoreMode: secretResult.mode
          },
          status: 'active',
          createdAt: nowIso(),
          updatedAt: nowIso()
        };
      }
    );

    this.auditService.write({
      tenantId,
      actorUserId: userId,
      action: 'provider.byok.connected',
      resourceType: 'provider_connections',
      resourceId: connection.id,
      metadata: {
        provider: input.provider,
        mode: secretResult.mode
      }
    });

    return {
      id: connection.id,
      provider: connection.provider,
      kind: connection.kind,
      status: connection.status,
      metadata: connection.metadata,
      encryptedSecretRef: connection.encryptedSecretRef
    };
  }

  providerStatus(tenantId) {
    const connections = this.store.list('provider_connections', (item) => item.tenantId === tenantId);
    return connections.map((connection) => ({
      id: connection.id,
      provider: connection.provider,
      kind: connection.kind,
      status: connection.status,
      mode: connection.metadata.secretStoreMode,
      model: connection.metadata.model,
      updatedAt: connection.updatedAt
    }));
  }
}

module.exports = { ProviderService };