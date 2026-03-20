class DashboardService {
  constructor(store, runtimeService, channelService) {
    this.store = store;
    this.runtimeService = runtimeService;
    this.channelService = channelService;
  }

  uptime(tenantId) {
    const runtime = this.runtimeService.latestRuntime(tenantId);
    if (!runtime) {
      return {
        tenantId,
        status: 'missing_runtime',
        uptimeSeconds: 0
      };
    }

    const started = runtime.startedAt ? new Date(runtime.startedAt).getTime() : Date.now();
    const now = Date.now();
    const uptimeSeconds = Math.max(0, Math.floor((now - started) / 1000));

    return {
      tenantId,
      runtimeId: runtime.id,
      status: runtime.status,
      uptimeSeconds,
      lastHealthyAt: runtime.lastHealthyAt,
      runtimeMode: runtime.metadata?.mode || 'unknown'
    };
  }

  services(tenantId) {
    const snapshots = this.store
      .list('service_health_snapshots', (record) => record.tenantId === tenantId)
      .sort((a, b) => b.observedAt.localeCompare(a.observedAt));

    const latestByService = new Map();

    for (const snapshot of snapshots) {
      if (!latestByService.has(snapshot.service)) {
        latestByService.set(snapshot.service, snapshot);
      }
    }

    const runtime = this.runtimeService.latestRuntime(tenantId);
    if (runtime && !latestByService.has('runtime')) {
      latestByService.set('runtime', {
        service: 'runtime',
        status: runtime.status === 'running' ? 'healthy' : runtime.status,
        observedAt: runtime.updatedAt,
        details: runtime.metadata
      });
    }

    return Array.from(latestByService.values()).map((item) => ({
      service: item.service,
      status: item.status,
      observedAt: item.observedAt,
      details: item.details || {}
    }));
  }

  runs(tenantId, limit = 20) {
    return this.store
      .list('usage_events', (event) => event.tenantId === tenantId && event.category === 'run')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, Math.max(1, Math.min(200, limit)));
  }

  channels(tenantId) {
    return this.channelService.health(tenantId);
  }
}

module.exports = { DashboardService };