const express = require('express');
const { asyncHandler } = require('../middleware/errors');

function createFileRoutes(services, authMiddleware) {
  const router = express.Router();

  router.post(
    '/upload-url',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const payload = await services.fileService.createUploadUrl(req.auth.tenantId, req.auth.userId, req.body);
      res.status(201).json(payload);
    })
  );

  router.post(
    '/complete',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const payload = services.fileService.completeUpload(req.auth.tenantId, req.auth.userId, req.body);
      res.status(200).json(payload);
    })
  );

  router.get(
    '/list',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const payload = services.fileService.listFiles(req.auth.tenantId, { limit: req.query.limit });
      res.status(200).json({ files: payload });
    })
  );

  router.post(
    '/download-url',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const payload = await services.fileService.createDownloadUrl(req.auth.tenantId, req.auth.userId, req.body);
      res.status(200).json(payload);
    })
  );

  return router;
}

module.exports = { createFileRoutes };