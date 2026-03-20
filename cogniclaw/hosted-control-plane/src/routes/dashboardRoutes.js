const express = require('express');
const { asyncHandler } = require('../middleware/errors');

function createDashboardRoutes(services, authMiddleware) {
  const router = express.Router();

  router.get(
    '/uptime',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const payload = services.dashboardService.uptime(req.auth.tenantId);
      res.status(200).json(payload);
    })
  );

  router.get(
    '/services',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const payload = services.dashboardService.services(req.auth.tenantId);
      res.status(200).json({ services: payload });
    })
  );

  router.get(
    '/runs',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const limit = Number(req.query.limit || 20);
      const payload = services.dashboardService.runs(req.auth.tenantId, limit);
      res.status(200).json({ runs: payload });
    })
  );

  router.get(
    '/channels',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const payload = services.dashboardService.channels(req.auth.tenantId);
      res.status(200).json({ channels: payload });
    })
  );

  return router;
}

module.exports = { createDashboardRoutes };