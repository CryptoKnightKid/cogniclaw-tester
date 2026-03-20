const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { config } = require('./config/env');
const { DataStore } = require('./data/store');
const { createAuthMiddleware, createInternalAuthMiddleware } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/errors');

const { AuditService } = require('./services/auditService');
const { EcsRuntimeAdapter } = require('./services/aws/ecsService');
const { SecretsAdapter } = require('./services/aws/secretsService');
const { RuntimeService } = require('./services/runtimeService');
const { AuthService } = require('./services/authService');
const { TenantService } = require('./services/tenantService');
const { BillingService } = require('./services/billingService');
const { ChannelService } = require('./services/channelService');
const { EntitlementService } = require('./services/entitlementService');
const { ProviderService } = require('./services/providerService');
const { UsageService } = require('./services/usageService');
const { DashboardService } = require('./services/dashboardService');
const { FileService } = require('./services/fileService');

const { createAuthRoutes } = require('./routes/authRoutes');
const { createTenantRoutes } = require('./routes/tenantRoutes');
const { createBillingRoutes } = require('./routes/billingRoutes');
const { createEntitlementRoutes } = require('./routes/entitlementRoutes');
const { createProviderRoutes } = require('./routes/providerRoutes');
const { createUsageRoutes } = require('./routes/usageRoutes');
const { createDashboardRoutes } = require('./routes/dashboardRoutes');
const { createFileRoutes } = require('./routes/fileRoutes');
const { createChannelRoutes } = require('./routes/channelRoutes');
const { createInternalRoutes } = require('./routes/internalRoutes');
const { asyncHandler } = require('./middleware/errors');

function createServices() {
  const store = new DataStore(config.dataFile);
  const auditService = new AuditService(store);
  const ecsAdapter = new EcsRuntimeAdapter();
  const secretsAdapter = new SecretsAdapter();
  const runtimeService = new RuntimeService(store, ecsAdapter, auditService);
  const channelService = new ChannelService(store, auditService);
  const entitlementService = new EntitlementService(store, channelService);
  const usageService = new UsageService(store, entitlementService, auditService);

  const services = {
    config,
    store,
    auditService,
    ecsAdapter,
    secretsAdapter,
    runtimeService,
    authService: null,
    tenantService: null,
    billingService: null,
    channelService,
    entitlementService,
    providerService: null,
    usageService,
    dashboardService: null,
    fileService: null
  };

  services.authService = new AuthService(store, config, runtimeService, auditService);
  services.tenantService = new TenantService(store, auditService);
  services.billingService = new BillingService(store, auditService);
  services.providerService = new ProviderService(store, secretsAdapter, auditService);
  services.dashboardService = new DashboardService(store, runtimeService, channelService);
  services.fileService = new FileService(store, usageService, auditService);

  return services;
}

function createApp() {
  const services = createServices();
  const authMiddleware = createAuthMiddleware(services);
  const internalAuth = createInternalAuthMiddleware(config);

  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(
    express.json({
      limit: '2mb',
      verify: (req, _res, buffer) => {
        req.rawBody = Buffer.from(buffer);
      }
    })
  );
  app.use(morgan('dev'));

  app.get('/healthz', (_req, res) => {
    res.status(200).json({
      ok: true,
      env: config.appEnv,
      timestamp: new Date().toISOString()
    });
  });

  app.use('/app', express.static(path.join(__dirname, 'public')));

  app.use('/auth', createAuthRoutes(services, authMiddleware));
  app.use('/tenant', createTenantRoutes(services, authMiddleware));
  app.use('/billing', createBillingRoutes(services, authMiddleware));
  app.use('/entitlements', createEntitlementRoutes(services, authMiddleware));
  app.use('/providers', createProviderRoutes(services, authMiddleware));
  app.use('/usage', createUsageRoutes(services, authMiddleware));
  app.get(
    '/quota',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const quota = services.usageService.quota(req.auth.tenantId);
      res.status(200).json(quota);
    })
  );
  app.use('/dashboard', createDashboardRoutes(services, authMiddleware));
  app.use('/files', createFileRoutes(services, authMiddleware));
  app.use('/channels', createChannelRoutes(services, authMiddleware));
  app.use('/internal', createInternalRoutes(services, internalAuth));

  app.use(notFound);
  app.use(errorHandler);

  app.locals.services = services;
  return app;
}

module.exports = { createApp };
