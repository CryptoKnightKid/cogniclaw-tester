const { createId, nowIso } = require('../lib/utils');

class AuditService {
  constructor(store) {
    this.store = store;
  }

  write(event) {
    return this.store.insert('audit_events', {
      id: createId('audit'),
      tenantId: event.tenantId || null,
      actorUserId: event.actorUserId || null,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId || null,
      metadata: event.metadata || {},
      createdAt: nowIso(),
      updatedAt: nowIso()
    });
  }
}

module.exports = { AuditService };