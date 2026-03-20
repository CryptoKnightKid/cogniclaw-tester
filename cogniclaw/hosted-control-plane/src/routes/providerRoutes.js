const express = require('express');
const { asyncHandler } = require('../middleware/errors');

function createProviderRoutes(services, authMiddleware) {
  const router = express.Router();

  router.get(
    '/',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const providers = services.providerService.listProviders(req.auth.tenantId);
      res.status(200).json({ providers });
    })
  );

  router.post(
    '/byok',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const connection = await services.providerService.connectByok(req.auth.tenantId, req.auth.userId, req.body);
      res.status(201).json(connection);
    })
  );

  router.get(
    '/status',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const status = services.providerService.providerStatus(req.auth.tenantId);
      res.status(200).json({ providers: status });
    })
  );

  return router;
}

module.exports = { createProviderRoutes };