const express = require('express');
const { asyncHandler } = require('../middleware/errors');

function createUsageRoutes(services, authMiddleware) {
  const router = express.Router();

  router.get(
    '/summary',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const summary = services.usageService.summary(req.auth.tenantId);
      res.status(200).json(summary);
    })
  );

  router.get(
    '/history',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const limit = Number(req.query.limit || 100);
      const history = services.usageService.history(req.auth.tenantId, limit);
      res.status(200).json({ events: history });
    })
  );

  router.get(
    '/quota',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const quota = services.usageService.quota(req.auth.tenantId);
      res.status(200).json(quota);
    })
  );

  return router;
}

module.exports = { createUsageRoutes };