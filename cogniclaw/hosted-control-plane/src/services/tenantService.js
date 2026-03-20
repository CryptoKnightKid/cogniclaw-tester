const { z } = require('zod');

const patchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  region: z.string().min(2).max(40).optional(),
  timeZone: z.string().min(2).max(100).optional(),
  locale: z.string().min(2).max(20).optional(),
  preferences: z.record(z.any()).optional()
});

class TenantService {
  constructor(store, auditService) {
    this.store = store;
    this.auditService = auditService;
  }

  getTenantContext(tenantId, userId) {
    const tenant = this.store.findById('tenants', tenantId);
    if (!tenant) {
      const error = new Error('Tenant not found');
      error.statusCode = 404;
      throw error;
    }

    const membership = this.store.findOne(
      'memberships',
      (record) => record.organizationId === tenant.organizationId && record.userId === userId
    );

    if (!membership) {
      const error = new Error('Membership not found for tenant');
      error.statusCode = 403;
      throw error;
    }

    const organization = this.store.findById('organizations', tenant.organizationId);

    return {
      tenant,
      organization,
      membership
    };
  }

  patchTenantSettings(tenantId, userId, rawPatch) {
    const patch = patchSchema.parse(rawPatch);
    const context = this.getTenantContext(tenantId, userId);

    const updated = this.store.update('tenants', tenantId, {
      region: patch.region || context.tenant.region,
      settings: {
        ...context.tenant.settings,
        ...(patch.timeZone ? { timeZone: patch.timeZone } : {}),
        ...(patch.locale ? { locale: patch.locale } : {}),
        ...(patch.preferences ? { preferences: patch.preferences } : {})
      },
      name: patch.name || context.tenant.name
    });

    this.auditService.write({
      tenantId,
      actorUserId: userId,
      action: 'tenant.settings.updated',
      resourceType: 'tenant',
      resourceId: tenantId,
      metadata: { keys: Object.keys(patch) }
    });

    return updated;
  }
}

module.exports = { TenantService };