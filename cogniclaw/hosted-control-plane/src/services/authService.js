const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { createId, nowIso } = require('../lib/utils');
const { hashPassword, verifyPassword } = require('../lib/crypto');

const signupSchema = z.object({
  organizationName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(100).optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

function createTenantSlug(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

class AuthService {
  constructor(store, config, runtimeService, auditService) {
    this.store = store;
    this.config = config;
    this.runtimeService = runtimeService;
    this.auditService = auditService;
  }

  issueToken(payload) {
    return jwt.sign(payload, this.config.jwtSecret, {
      expiresIn: '12h',
      jwtid: createId('jti')
    });
  }

  verifyToken(token) {
    return jwt.verify(token, this.config.jwtSecret);
  }

  signup(rawInput) {
    const input = signupSchema.parse(rawInput);

    const existing = this.store.findOne('users', (user) => user.email.toLowerCase() === input.email.toLowerCase());
    if (existing) {
      const error = new Error('Email already exists');
      error.statusCode = 409;
      throw error;
    }

    const orgId = createId('org');
    const userId = createId('usr');
    const membershipId = createId('mbr');
    const tenantId = createId('ten');
    const plan = this.store.findOne('plans', (record) => record.slug === 'starter');

    const organization = this.store.insert('organizations', {
      id: orgId,
      name: input.organizationName,
      createdAt: nowIso(),
      updatedAt: nowIso()
    });

    const user = this.store.insert('users', {
      id: userId,
      email: input.email.toLowerCase(),
      passwordHash: hashPassword(input.password),
      displayName: input.displayName || input.email.split('@')[0],
      createdAt: nowIso(),
      updatedAt: nowIso()
    });

    const membership = this.store.insert('memberships', {
      id: membershipId,
      organizationId: orgId,
      userId,
      role: 'owner',
      createdAt: nowIso(),
      updatedAt: nowIso()
    });

    const tenant = this.store.insert('tenants', {
      id: tenantId,
      organizationId: orgId,
      slug: createTenantSlug(input.organizationName),
      region: this.config.aws.region,
      status: 'provisioning',
      settings: {
        timeZone: 'UTC',
        locale: 'en-US'
      },
      createdAt: nowIso(),
      updatedAt: nowIso()
    });

    this.store.insert('subscriptions', {
      id: createId('sub'),
      tenantId,
      planId: plan.id,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      status: 'trialing',
      currentPeriodStart: nowIso(),
      currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: nowIso(),
      updatedAt: nowIso()
    });

    this.runtimeService.createRuntimeForTenant(tenantId, { initiatedBy: userId });

    this.auditService.write({
      tenantId,
      actorUserId: userId,
      action: 'auth.signup',
      resourceType: 'user',
      resourceId: userId,
      metadata: { organizationId: orgId }
    });

    const token = this.issueToken({
      sub: user.id,
      tenantId: tenant.id,
      organizationId: organization.id,
      membershipId: membership.id,
      role: membership.role,
      email: user.email
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName
      },
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        status: tenant.status
      }
    };
  }

  login(rawInput) {
    const input = loginSchema.parse(rawInput);
    const user = this.store.findOne('users', (record) => record.email.toLowerCase() === input.email.toLowerCase());

    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      const error = new Error('Invalid credentials');
      error.statusCode = 401;
      throw error;
    }

    const membership = this.store.findOne('memberships', (record) => record.userId === user.id);
    if (!membership) {
      const error = new Error('User has no active membership');
      error.statusCode = 403;
      throw error;
    }

    const tenant = this.store.findOne('tenants', (record) => record.organizationId === membership.organizationId);
    if (!tenant) {
      const error = new Error('No tenant found for membership');
      error.statusCode = 404;
      throw error;
    }

    const token = this.issueToken({
      sub: user.id,
      tenantId: tenant.id,
      organizationId: membership.organizationId,
      membershipId: membership.id,
      role: membership.role,
      email: user.email
    });

    this.auditService.write({
      tenantId: tenant.id,
      actorUserId: user.id,
      action: 'auth.login',
      resourceType: 'user',
      resourceId: user.id
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName
      },
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        status: tenant.status
      }
    };
  }

  logout(token, claims) {
    this.store.insert('revoked_tokens', {
      id: createId('rev'),
      token,
      userId: claims.sub,
      tenantId: claims.tenantId,
      expiresAt: claims.exp ? new Date(claims.exp * 1000).toISOString() : null,
      createdAt: nowIso(),
      updatedAt: nowIso()
    });

    this.auditService.write({
      tenantId: claims.tenantId,
      actorUserId: claims.sub,
      action: 'auth.logout',
      resourceType: 'user',
      resourceId: claims.sub
    });
  }
}

module.exports = { AuthService };