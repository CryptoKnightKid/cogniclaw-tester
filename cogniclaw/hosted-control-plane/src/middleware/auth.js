function createAuthMiddleware(services) {
  return function authMiddleware(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

    if (!token) {
      return res.status(401).json({ error: 'Missing bearer token' });
    }

    try {
      const claims = services.authService.verifyToken(token);
      const revoked = services.store.findOne('revoked_tokens', (item) => item.token === token);
      if (revoked) {
        return res.status(401).json({ error: 'Token revoked' });
      }

      req.auth = {
        token,
        claims,
        userId: claims.sub,
        tenantId: claims.tenantId,
        organizationId: claims.organizationId,
        role: claims.role
      };

      return next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

function createInternalAuthMiddleware(config) {
  return function internalAuth(req, res, next) {
    const key = req.headers['x-internal-api-key'];
    if (!key || key !== config.internalApiKey) {
      return res.status(401).json({ error: 'Invalid internal API key' });
    }
    return next();
  };
}

module.exports = {
  createAuthMiddleware,
  createInternalAuthMiddleware
};