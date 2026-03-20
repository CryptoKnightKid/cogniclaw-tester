const express = require('express');
const { asyncHandler } = require('../middleware/errors');

function createChannelRoutes(services, authMiddleware) {
  const router = express.Router();

  router.get(
    '/capabilities',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const capabilities = services.channelService.getCapabilities();
      res.status(200).json({ capabilities });
    })
  );

  router.post(
    '/connect',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const connection = services.channelService.connectChannel(req.auth.tenantId, req.auth.userId, req.body);
      res.status(201).json(connection);
    })
  );

  router.get(
    '/health',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const channels = services.channelService.health(req.auth.tenantId);
      res.status(200).json({ channels });
    })
  );

  return router;
}

module.exports = { createChannelRoutes };