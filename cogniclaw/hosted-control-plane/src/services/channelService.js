const { spawnSync } = require('child_process');
const { z } = require('zod');
const { config } = require('../config/env');
const { createId, nowIso } = require('../lib/utils');

const connectSchema = z.object({
  channel: z.string().min(2),
  config: z.record(z.any()).optional()
});

function parseCapabilitiesFromOpenClaw() {
  const command = spawnSync('openclaw', ['channels', 'list', '--json'], {
    encoding: 'utf8',
    timeout: 1500
  });

  if (command.error || command.status !== 0 || !command.stdout) {
    return null;
  }

  try {
    const parsed = JSON.parse(command.stdout);
    if (Array.isArray(parsed)) {
      return parsed.map((entry) => String(entry.name || entry).toLowerCase());
    }
    if (Array.isArray(parsed.channels)) {
      return parsed.channels.map((entry) => String(entry.name || entry).toLowerCase());
    }
  } catch (error) {
    return null;
  }

  return null;
}

function maskConfig(configPayload) {
  const out = {};
  const secretLike = /(token|secret|password|key|sid|auth)/i;

  for (const [key, value] of Object.entries(configPayload || {})) {
    if (secretLike.test(key)) {
      out[key] = value ? '***' : '';
      continue;
    }
    out[key] = value;
  }

  return out;
}

class ChannelService {
  constructor(store, auditService) {
    this.store = store;
    this.auditService = auditService;
    this.cachedCapabilities = null;
  }

  getCapabilities() {
    if (this.cachedCapabilities) return this.cachedCapabilities;

    let capabilities = null;

    if (config.channelCapabilitiesOverride.length) {
      capabilities = config.channelCapabilitiesOverride.map((channel) => channel.toLowerCase());
    }

    if (!capabilities) {
      capabilities = parseCapabilitiesFromOpenClaw();
    }

    if (!capabilities || !capabilities.length) {
      capabilities = ['discord', 'telegram', 'whatsapp', 'slack', 'imessage'];
    }

    this.cachedCapabilities = [...new Set(capabilities)];
    return this.cachedCapabilities;
  }

  listConnections(tenantId) {
    return this.store.list('channel_connections', (item) => item.tenantId === tenantId);
  }

  connectChannel(tenantId, userId, rawInput) {
    const input = connectSchema.parse(rawInput);
    const channel = input.channel.toLowerCase();
    const capabilities = this.getCapabilities();

    if (!capabilities.includes(channel)) {
      const error = new Error(`Channel not supported by runtime: ${channel}`);
      error.statusCode = 400;
      throw error;
    }

    const connection = this.store.upsert(
      'channel_connections',
      (record) => record.tenantId === tenantId && record.channel === channel,
      (existing, exists) => {
        if (exists) {
          return {
            ...existing,
            status: 'connected',
            metadata: {
              ...existing.metadata,
              config: maskConfig(input.config || {}),
              lastConnectedAt: nowIso()
            }
          };
        }

        return {
          id: createId('chn'),
          tenantId,
          channel,
          status: 'connected',
          metadata: {
            config: maskConfig(input.config || {}),
            lastConnectedAt: nowIso()
          },
          createdAt: nowIso(),
          updatedAt: nowIso(),
          lastHeartbeatAt: nowIso()
        };
      }
    );

    this.auditService.write({
      tenantId,
      actorUserId: userId,
      action: 'channel.connected',
      resourceType: 'channel_connections',
      resourceId: connection.id,
      metadata: { channel }
    });

    return connection;
  }

  health(tenantId) {
    const connections = this.listConnections(tenantId);
    return connections.map((connection) => ({
      id: connection.id,
      channel: connection.channel,
      status: connection.status,
      lastHeartbeatAt: connection.lastHeartbeatAt || connection.updatedAt,
      details: connection.metadata || {}
    }));
  }
}

module.exports = { ChannelService };