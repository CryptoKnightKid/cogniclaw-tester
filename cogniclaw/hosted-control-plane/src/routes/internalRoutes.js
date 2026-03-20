const express = require('express');
const { z } = require('zod');
const { asyncHandler } = require('../middleware/errors');

const heartbeatSchema = z.object({
  tenantId: z.string().min(4),
  service: z.string().min(2),
  status: z.string().min(2),
  details: z.record(z.any()).optional()
});

function createInternalRoutes(services, internalAuth) {
  const router = express.Router();
  router.use(internalAuth);

  router.post(
    '/tenants/:tenantId/provision',
    asyncHandler(async (req, res) => {
      const runtime = services.runtimeService.createRuntimeForTenant(req.params.tenantId, { initiatedBy: null });
      res.status(202).json(runtime);
    })
  );

  router.post(
    '/tenants/:tenantId/runtime/:action',
    asyncHandler(async (req, res) => {
      const action = req.params.action;
      if (!['restart', 'suspend', 'terminate'].includes(action)) {
        return res.status(400).json({ error: 'Invalid runtime action' });
      }

      const result = services.runtimeService.changeRuntimeStatus(req.params.tenantId, action, null);
      res.status(200).json(result);
    })
  );

  router.post(
    '/heartbeat',
    asyncHandler(async (req, res) => {
      const payload = heartbeatSchema.parse(req.body);
      const snapshot = services.runtimeService.markHeartbeat(
        payload.tenantId,
        payload.service,
        payload.status,
        payload.details || {}
      );
      res.status(201).json(snapshot);
    })
  );

  return router;
}

module.exports = { createInternalRoutes };