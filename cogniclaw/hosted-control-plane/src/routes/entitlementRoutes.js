const express = require('express');
const { asyncHandler } = require('../middleware/errors');

function createEntitlementRoutes(services, authMiddleware) {
  const router = express.Router();

  router.get(
    '/',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const entitlements = services.entitlementService.listEntitlements(req.auth.tenantId);
      res.status(200).json(entitlements || {});
    })
  );

  return router;
}

module.exports = { createEntitlementRoutes };