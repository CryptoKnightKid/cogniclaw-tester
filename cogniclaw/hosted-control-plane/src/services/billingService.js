const Stripe = require('stripe');
const { z } = require('zod');
const { config } = require('../config/env');
const { createId, nowIso } = require('../lib/utils');

const checkoutSchema = z.object({
  plan: z.enum(['starter', 'growth', 'scale']),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional()
});

class BillingService {
  constructor(store, auditService) {
    this.store = store;
    this.auditService = auditService;
    this.stripe = config.stripe.secretKey ? new Stripe(config.stripe.secretKey) : null;
  }

  getActiveSubscription(tenantId) {
    return this.store.findOne('subscriptions', (record) => record.tenantId === tenantId) || null;
  }

  getPlanBySlug(slug) {
    return this.store.findOne('plans', (plan) => plan.slug === slug);
  }

  async createCheckoutSession(tenantId, userId, rawInput) {
    const input = checkoutSchema.parse(rawInput);
    const plan = this.getPlanBySlug(input.plan);
    if (!plan) {
      const error = new Error('Unknown plan selected');
      error.statusCode = 400;
      throw error;
    }

    const currentSubscription = this.getActiveSubscription(tenantId);

    if (!this.stripe) {
      const mockSession = {
        id: createId('checkout'),
        url: `${input.successUrl || 'https://example.com/success'}?mock_checkout=true&plan=${plan.slug}`
      };

      this.store.update('subscriptions', currentSubscription.id, {
        planId: plan.id,
        status: 'active',
        currentPeriodStart: nowIso(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });

      this.auditService.write({
        tenantId,
        actorUserId: userId,
        action: 'billing.checkout.mock',
        resourceType: 'subscription',
        resourceId: currentSubscription.id,
        metadata: { plan: plan.slug }
      });

      return mockSession;
    }

    const priceId = config.stripe.prices[input.plan];
    if (!priceId) {
      const error = new Error(`Stripe price is missing for plan: ${input.plan}`);
      error.statusCode = 500;
      throw error;
    }

    let customerId = currentSubscription.stripeCustomerId;

    if (!customerId) {
      const customer = await this.stripe.customers.create({
        metadata: {
          tenantId
        }
      });
      customerId = customer.id;
      this.store.update('subscriptions', currentSubscription.id, {
        stripeCustomerId: customerId
      });
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: input.successUrl || 'https://example.com/success',
      cancel_url: input.cancelUrl || 'https://example.com/cancel',
      metadata: {
        tenantId,
        targetPlanSlug: input.plan
      }
    });

    this.auditService.write({
      tenantId,
      actorUserId: userId,
      action: 'billing.checkout.created',
      resourceType: 'subscription',
      resourceId: currentSubscription.id,
      metadata: { checkoutSessionId: session.id, targetPlan: input.plan }
    });

    return {
      id: session.id,
      url: session.url
    };
  }

  applyStripeEvent(event) {
    const type = event.type;

    if (type === 'customer.subscription.updated' || type === 'customer.subscription.created') {
      const subscription = event.data.object;
      const tenantId = subscription.metadata?.tenantId;
      if (!tenantId) return { handled: false, reason: 'missing_tenant_metadata' };

      const localSub = this.getActiveSubscription(tenantId);
      if (!localSub) return { handled: false, reason: 'missing_local_subscription' };

      const planSlug = subscription.metadata?.targetPlanSlug || 'starter';
      const plan = this.getPlanBySlug(planSlug) || this.getPlanBySlug('starter');

      this.store.update('subscriptions', localSub.id, {
        status: subscription.status,
        planId: plan.id,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: subscription.customer,
        currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString()
      });

      this.auditService.write({
        tenantId,
        actorUserId: null,
        action: 'billing.subscription.synced',
        resourceType: 'subscription',
        resourceId: localSub.id,
        metadata: { stripeEventType: type, stripeSubscriptionId: subscription.id }
      });

      return { handled: true };
    }

    if (type === 'invoice.payment_failed') {
      const invoice = event.data.object;
      const tenantId = invoice.metadata?.tenantId;
      if (!tenantId) return { handled: false, reason: 'missing_tenant_metadata' };

      const localSub = this.getActiveSubscription(tenantId);
      if (!localSub) return { handled: false, reason: 'missing_local_subscription' };

      this.store.update('subscriptions', localSub.id, {
        status: 'past_due'
      });

      this.auditService.write({
        tenantId,
        actorUserId: null,
        action: 'billing.payment.failed',
        resourceType: 'subscription',
        resourceId: localSub.id,
        metadata: { stripeEventType: type, invoiceId: invoice.id }
      });

      return { handled: true };
    }

    return { handled: false, reason: 'event_not_supported' };
  }

  verifyWebhook(rawBody, signature) {
    if (!this.stripe || !config.stripe.webhookSecret) {
      return JSON.parse(rawBody.toString());
    }

    return this.stripe.webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);
  }
}

module.exports = { BillingService };