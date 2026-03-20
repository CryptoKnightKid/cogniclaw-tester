const { createId, nowIso } = require('../lib/utils');

class RuntimeService {
  constructor(store, ecsAdapter, auditService) {
    this.store = store;
    this.ecsAdapter = ecsAdapter;
    this.auditService = auditService;
  }

  createRuntimeForTenant(tenantId, options = {}) {
    const runtime = this.store.insert('tenant_runtime_instances', {
      id: createId('rti'),
      tenantId,
      provider: 'aws',
      runtimeType: 'ecs-fargate',
      status: 'provisioning',
      metadata: {
        runtimeRef: null,
        mode: 'pending'
      },
      createdAt: nowIso(),
      updatedAt: nowIso(),
      startedAt: nowIso(),
      lastHealthyAt: null
    });

    Promise.resolve(this.ecsAdapter.provisionTenantRuntime(tenantId)).then((result) => {
      this.store.update('tenant_runtime_instances', runtime.id, {
        status: result.status === 'running' ? 'running' : 'error',
        metadata: {
          ...runtime.metadata,
          mode: result.mode,
          runtimeRef: result.runtimeRef,
          failures: result.failures || [],
          error: result.error || null
        },
        lastHealthyAt: result.status === 'running' ? nowIso() : null
      });

      this.store.update('tenants', tenantId, {
        status: result.status === 'running' ? 'active' : 'degraded'
      });

      this.store.insert('service_health_snapshots', {
        id: createId('hlth'),
        tenantId,
        service: 'runtime',
        status: result.status === 'running' ? 'healthy' : 'degraded',
        details: {
          mode: result.mode,
          runtimeRef: result.runtimeRef,
          error: result.error || null
        },
        observedAt: nowIso(),
        createdAt: nowIso(),
        updatedAt: nowIso()
      });

      this.auditService.write({
        tenantId,
        actorUserId: options.initiatedBy || null,
        action: 'runtime.provisioned',
        resourceType: 'tenant_runtime_instances',
        resourceId: runtime.id,
        metadata: { mode: result.mode, status: result.status }
      });
    });

    return runtime;
  }

  listTenantRuntimes(tenantId) {
    return this.store.list('tenant_runtime_instances', (item) => item.tenantId === tenantId);
  }

  latestRuntime(tenantId) {
    const runtimes = this.listTenantRuntimes(tenantId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return runtimes[0] || null;
  }

  markHeartbeat(tenantId, service, status, details = {}) {
    return this.store.insert('service_health_snapshots', {
      id: createId('hlth'),
      tenantId,
      service,
      status,
      details,
      observedAt: nowIso(),
      createdAt: nowIso(),
      updatedAt: nowIso()
    });
  }

  changeRuntimeStatus(tenantId, action, initiatedBy) {
    const runtime = this.latestRuntime(tenantId);
    if (!runtime) {
      const error = new Error('No runtime found for tenant');
      error.statusCode = 404;
      throw error;
    }

    let targetStatus = runtime.status;
    if (action === 'restart') targetStatus = 'running';
    if (action === 'suspend') targetStatus = 'suspended';
    if (action === 'terminate') targetStatus = 'terminated';

    const updated = this.store.update('tenant_runtime_instances', runtime.id, {
      status: targetStatus,
      metadata: {
        ...runtime.metadata,
        lastAction: action,
        actionedAt: nowIso()
      },
      lastHealthyAt: targetStatus === 'running' ? nowIso() : runtime.lastHealthyAt
    });

    const tenantStatus = targetStatus === 'running' ? 'active' : targetStatus === 'suspended' ? 'suspended' : 'terminated';
    this.store.update('tenants', tenantId, { status: tenantStatus });

    this.auditService.write({
      tenantId,
      actorUserId: initiatedBy || null,
      action: `runtime.${action}`,
      resourceType: 'tenant_runtime_instances',
      resourceId: runtime.id,
      metadata: { targetStatus }
    });

    return updated;
  }
}

module.exports = { RuntimeService };