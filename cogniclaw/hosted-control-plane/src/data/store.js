const fs = require('fs');
const path = require('path');
const { nowIso } = require('../lib/utils');

const TABLES = [
  'organizations',
  'users',
  'memberships',
  'tenants',
  'tenant_runtime_instances',
  'subscriptions',
  'plans',
  'entitlements',
  'provider_connections',
  'usage_events',
  'quota_snapshots',
  'channel_connections',
  'tenant_files',
  'service_health_snapshots',
  'audit_events',
  'revoked_tokens'
];

const DEFAULT_PLANS = [
  {
    id: 'plan_starter',
    slug: 'starter',
    name: 'Starter',
    monthlyQuotaRuns: 500,
    monthlyStorageMb: 1024,
    maxUsers: 5,
    allowedChannels: ['discord', 'telegram', 'whatsapp']
  },
  {
    id: 'plan_growth',
    slug: 'growth',
    name: 'Growth',
    monthlyQuotaRuns: 2500,
    monthlyStorageMb: 10240,
    maxUsers: 20,
    allowedChannels: ['discord', 'telegram', 'whatsapp', 'slack', 'imessage']
  },
  {
    id: 'plan_scale',
    slug: 'scale',
    name: 'Scale',
    monthlyQuotaRuns: 10000,
    monthlyStorageMb: 51200,
    maxUsers: 100,
    allowedChannels: ['discord', 'telegram', 'whatsapp', 'slack', 'imessage']
  }
];

class DataStore {
  constructor(filePath) {
    this.filePath = path.resolve(filePath);
    this.state = this.load();
  }

  load() {
    const initial = {
      version: 1,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };

    for (const table of TABLES) {
      initial[table] = [];
    }

    const directory = path.dirname(this.filePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    if (!fs.existsSync(this.filePath)) {
      initial.plans = DEFAULT_PLANS;
      fs.writeFileSync(this.filePath, JSON.stringify(initial, null, 2));
      return initial;
    }

    const loaded = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    const merged = { ...initial, ...loaded };

    for (const table of TABLES) {
      if (!Array.isArray(merged[table])) {
        merged[table] = [];
      }
    }

    if (!merged.plans.length) {
      merged.plans = DEFAULT_PLANS;
    }

    return merged;
  }

  flush() {
    this.state.updatedAt = nowIso();
    fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2));
  }

  get(table) {
    return this.state[table] || [];
  }

  insert(table, record) {
    this.state[table].push(record);
    this.flush();
    return record;
  }

  findById(table, id) {
    return this.get(table).find((record) => record.id === id) || null;
  }

  findOne(table, predicate) {
    return this.get(table).find(predicate) || null;
  }

  list(table, predicate = () => true) {
    return this.get(table).filter(predicate);
  }

  update(table, id, patch) {
    const records = this.get(table);
    const index = records.findIndex((record) => record.id === id);
    if (index === -1) return null;

    const updated = {
      ...records[index],
      ...patch,
      updatedAt: nowIso()
    };

    records[index] = updated;
    this.flush();
    return updated;
  }

  upsert(table, findFn, buildFn) {
    const records = this.get(table);
    const existing = records.find(findFn);

    if (existing) {
      const updated = buildFn(existing, true);
      Object.assign(existing, updated, { updatedAt: nowIso() });
      this.flush();
      return existing;
    }

    const created = buildFn(null, false);
    records.push(created);
    this.flush();
    return created;
  }
}

module.exports = {
  DataStore,
  TABLES,
  DEFAULT_PLANS
};