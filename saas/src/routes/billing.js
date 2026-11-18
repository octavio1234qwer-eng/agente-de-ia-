import express from 'express';
import { z } from 'zod';
import { parse } from '../lib/http.js';
import { requireUser, requireVerified } from '../middleware/auth.js';
import { CURRENCIES, publicPlan } from '../plans.js';
import { SUPPORTED_LOCALES } from '../i18n.js';

export function billingRouter(ctx) {
  const { config, db, plans, billing } = ctx;
  const router = express.Router();

  router.get('/plans', (req, res) => {
    res.json({
      appName: config.appName,
      supportEmail: config.supportEmail ?? null,
      plans: plans.list.map((plan) => publicPlan(plan, req.locale)),
      billingEnabled: billing.enabled,
      requireEmailVerification: config.auth.requireEmailVerification,
      currencies: CURRENCIES,
      locales: SUPPORTED_LOCALES,
      defaultLocale: config.defaultLocale,
    });
  });

  router.post('/billing/checkout', requireUser, requireVerified(config), async (req, res) => {
    const { planId, currency } = parse(z.object({ planId: z.string().max(40), currency: z.enum(CURRENCIES).optional() }), req.body);
    let user = req.user;
    // El usuario puede elegir la moneda al pagar; billing.createCheckout rechaza el cambio si ya tiene suscripción.
    if (currency && currency !== user.currency) {
      const { rows } = await db.query(
        `UPDATE users SET currency = $2, updated_at = now() WHERE id = $1
           AND NOT EXISTS (SELECT 1 FROM subscriptions WHERE user_id = $1 AND status IN ('active', 'trialing', 'past_due'))
         RETURNING *`,
        [user.id, currency],
      );
      if (rows[0]) user = { ...user, ...rows[0] };
    }
    res.json({ url: await billing.createCheckout(user, planId, req.locale) });
  });

  router.post('/billing/portal', requireUser, async (req, res) => {
    res.json({ url: await billing.createPortal(req.user, req.locale) });
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
