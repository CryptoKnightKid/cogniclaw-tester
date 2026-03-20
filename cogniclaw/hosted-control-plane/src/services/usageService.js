const { createId, monthKey, nowIso } = require('../lib/utils');

class UsageService {
  constructor(store, entitlementService, auditService) {
    this.store = store;
    this.entitlementService = entitlementService;
    this.auditService = auditService;
  }

  recordRun(tenantId, metadata = {}) {
    const entitlements = this.entitlementService.ensureRunQuota(tenantId);
    const snapshot = this.entitlementService.syncQuotaSnapshot(tenantId);

    this.store.insert('usage_events', {
      id: createId('use'),
      tenantId,
      category: 'run',
      metric: 'agent_run',
      amount: 1,
      metadata,
      createdAt: nowIso(),
      updatedAt: nowIso()
    });

    this.store.update('quota_snapshots', snapshot.id, {
      runsUsed: snapshot.runsUsed + 1
    });

    return entitlements;
  }

  recordStorage(tenantId, deltaMb, metadata = {}) {
    const snapshot = this.entitlementService.syncQuotaSnapshot(tenantId);

    this.store.insert('usage_events', {
      id: createId('use'),
      tenantId,
      category: 'storage',
      metric: 'storage_mb',
      amount: deltaMb,
      metadata,
      createdAt: nowIso(),
      updatedAt: nowIso()
    });

    this.store.update('quota_snapshots', snapshot.id, {
      storageMbUsed: Math.max(0, Number(snapshot.storageMbUsed || 0) + Number(deltaMb || 0))
    });
  }

  summary(tenantId) {
    const key = monthKey();
    const events = this.store.list(
      'usage_events',
      (event) => event.tenantId === tenantId && String(event.createdAt || '').startsWith(key)
    );

    const byCategory = events.reduce((acc, event) => {
      acc[event.category] = (acc[event.category] || 0) + Number(event.amount || 0);
      return acc;
    }, {});

    return {
      monthKey: key,
      totalEvents: events.length,
      byCategory
    };
  }

  history(tenantId, limit = 100) {
    const events = this.store
      .list('usage_events', (event) => event.tenantId === tenantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return events.slice(0, Math.max(1, Math.min(500, limit)));
  }

  quota(tenantId) {
    const entitlements = this.entitlementService.listEntitlements(tenantId);
    if (!entitlements) {
      const error = new Error('Entitlements unavailable for tenant');
      error.statusCode = 404;
      throw error;
    }

    return {
      monthKey: entitlements.usage.monthKey,
      runs: {
        used: entitlements.usage.runsUsed,
        limit: entitlements.limits.monthlyRuns,
        remaining: Math.max(0, entitlements.limits.monthlyRuns - entitlements.usage.runsUsed)
      },
      storageMb: {
        used: entitlements.usage.storageMbUsed,
        limit: entitlements.limits.monthlyStorageMb,
        remaining: Math.max(0, entitlements.limits.monthlyStorageMb - entitlements.usage.storageMbUsed)
      },
      subscription: entitlements.subscription
    };
  }
}

module.exports = { UsageService };