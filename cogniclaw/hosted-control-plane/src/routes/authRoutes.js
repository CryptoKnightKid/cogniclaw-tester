const express = require('express');
const { asyncHandler } = require('../middleware/errors');

function createAuthRoutes(services, authMiddleware) {
  const router = express.Router();

  router.post(
    '/signup',
    asyncHandler(async (req, res) => {
      const result = services.authService.signup(req.body);
      res.status(201).json(result);
    })
  );

  router.post(
    '/login',
    asyncHandler(async (req, res) => {
      const result = services.authService.login(req.body);
      res.status(200).json(result);
    })
  );

  router.post(
    '/logout',
    authMiddleware,
    asyncHandler(async (req, res) => {
      services.authService.logout(req.auth.token, req.auth.claims);
      res.status(200).json({ ok: true });
    })
  );

  return router;
}

module.exports = { createAuthRoutes };