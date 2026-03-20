const { createId, monthKey, nowIso } = require('../lib/utils');

class EntitlementService {
  constructor(store, channelService) {
    this.store = store;
    this.channelService = channelService;
  }

  getTenantPlan(tenantId) {
    const subscription = this.store.findOne('subscriptions', (record) => record.tenantId === tenantId);
    if (!subscription) return null;
    const plan = this.store.findById('plans', subscription.planId);
    if (!plan) return null;
    return { subscription, plan };
  }

  syncQuotaSnapshot(tenantId) {
    const key = monthKey();

    return this.store.upsert(
      'quota_snapshots',
      (record) => record.tenantId === tenantId && record.monthKey === key,
      (existing, exists) => {
        if (exists) return existing;
        return {
          id: createId('qta'),
          tenantId,
          monthKey: key,
          runsUsed: 0,
          storageMbUsed: 0,
          createdAt: nowIso(),
          updatedAt: nowIso()
        };
      }
    );
  }

  listEntitlements(tenantId) {
    const planBundle = this.getTenantPlan(tenantId);
    if (!planBundle) return null;

    const { plan, subscription } = planBundle;
    const capabilities = this.channelService.getCapabilities();
    const allowedChannels = plan.allowedChannels.filter((channel) => capabilities.includes(channel));
    const quota = this.syncQuotaSnapshot(tenantId);

    const payload = {
      tenantId,
      plan: {
        id: plan.id,
        slug: plan.slug,
        name: plan.name
      },
      subscription: {
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd
      },
      limits: {
        monthlyRuns: plan.monthlyQuotaRuns,
        monthlyStorageMb: plan.monthlyStorageMb,
        maxUsers: plan.maxUsers
      },
      usage: {
        monthKey: quota.monthKey,
        runsUsed: quota.runsUsed,
        storageMbUsed: quota.storageMbUsed
      },
      channels: {
        available: capabilities,
        allowed: allowedChannels
      }
    };

    this.store.upsert(
      'entitlements',
      (record) => record.tenantId === tenantId && record.key === 'resolved',
      (existing, exists) => {
        if (exists) {
          return { ...existing, value: payload, updatedAt: nowIso() };
        }

        return {
          id: createId('ent'),
          tenantId,
          key: 'resolved',
          value: payload,
          createdAt: nowIso(),
          updatedAt: nowIso()
        };
      }
    );

    return payload;
  }

  ensureRunQuota(tenantId) {
    const entitlements = this.listEntitlements(tenantId);
    if (!entitlements) {
      const error = new Error('Entitlements unavailable for tenant');
      error.statusCode = 404;
      throw error;
    }

    if (entitlements.usage.runsUsed >= entitlements.limits.monthlyRuns) {
      const error = new Error('Monthly run quota exceeded');
      error.statusCode = 429;
      throw error;
    }

    return entitlements;
  }
}

module.exports = { EntitlementService };