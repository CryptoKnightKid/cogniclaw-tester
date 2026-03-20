const express = require('express');
const { asyncHandler } = require('../middleware/errors');

function createTenantRoutes(services, authMiddleware) {
  const router = express.Router();

  router.get(
    '/',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const result = services.tenantService.getTenantContext(req.auth.tenantId, req.auth.userId);
      res.status(200).json(result);
    })
  );

  router.patch(
    '/settings',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const updated = services.tenantService.patchTenantSettings(req.auth.tenantId, req.auth.userId, req.body);
      res.status(200).json(updated);
    })
  );

  return router;
}

module.exports = { createTenantRoutes };