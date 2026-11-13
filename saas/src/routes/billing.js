import express from 'express';
import { z } from 'zod';
import { parse } from '../lib/http.js';
import { requireUser, requireVerified } from '../middleware/auth.js';
import { publicPlan } from '../plans.js';

export function billingRouter(ctx) {
  const { config, plans, billing } = ctx;
  const router = express.Router();

  router.get('/plans', (_req, res) => {
    res.json({
      appName: config.appName,
      supportEmail: config.supportEmail ?? null,
      plans: plans.list.map(publicPlan),
      billingEnabled: billing.enabled,
      requireEmailVerification: config.auth.requireEmailVerification,
      currency: 'MXN',
    });
  });

  router.post('/billing/checkout', requireUser, requireVerified(config), async (req, res) => {
    const { planId } = parse(z.object({ planId: z.string().max(40) }), req.body);
    res.json({ url: await billing.createCheckout(req.user, planId) });
  });

  router.post('/billing/portal', requireUser, async (req, res) => {
    res.json({ url: await billing.createPortal(req.user) });
  });

  return router;
}

/** Webhook de Stripe: necesita el cuerpo sin procesar para verificar la firma. */
export function stripeWebhookHandler(ctx) {
  return async (req, res) => {
    const result = await ctx.billing.handleWebhook(req.body, req.get('stripe-signature'));
    res.json({ received: true, duplicate: result.duplicate });
  };
}
