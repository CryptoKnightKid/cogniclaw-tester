const express = require('express');
const { asyncHandler } = require('../middleware/errors');

function createBillingRoutes(services, authMiddleware) {
  const router = express.Router();

  router.get(
    '/subscription',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const sub = services.billingService.getActiveSubscription(req.auth.tenantId);
      res.status(200).json(sub || {});
    })
  );

  router.post(
    '/checkout-session',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const session = await services.billingService.createCheckoutSession(req.auth.tenantId, req.auth.userId, req.body);
      res.status(200).json(session);
    })
  );

  router.post(
    '/webhooks/stripe',
    asyncHandler(async (req, res) => {
      const signature = req.headers['stripe-signature'];
      const event = services.billingService.verifyWebhook(req.rawBody || Buffer.from(JSON.stringify(req.body)), signature);
      const outcome = services.billingService.applyStripeEvent(event);
      res.status(200).json({ received: true, outcome });
    })
  );

  return router;
}

module.exports = { createBillingRoutes };