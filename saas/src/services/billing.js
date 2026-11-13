import Stripe from 'stripe';
import { HttpError, badRequest } from '../lib/http.js';
import { errorFields } from '../lib/logger.js';
import { emails } from './mailer.js';

const GRANTING_STATUSES = ['active', 'trialing', 'past_due'];

export function createStripeClient(secretKey) {
  return new Stripe(secretKey, { maxNetworkRetries: 2, timeout: 20_000, appInfo: { name: 'impulsaia-saas' } });
}

/**
 * Integración con Stripe Billing (disponible en México, cobra en MXN).
 * `stripe` se inyecta para poder probar sin red.
 */
export function createBilling({ config, db, logger, plans, mailer, stripe }) {
  const enabled = Boolean(config.stripe.enabled && stripe);
  const priceCache = new Map();

  function assertEnabled() {
    if (!enabled) throw new HttpError(503, 'billing_disabled', 'Los pagos aún no están habilitados en esta plataforma.');
  }

  async function resolvePriceId(plan) {
    const configured = config.stripe.priceIds[plan.id];
    if (configured) return configured;
    const cached = priceCache.get(plan.id);
    if (cached && cached.expires > Date.now()) return cached.id;
    const { data } = await stripe.prices.list({ lookup_keys: [plan.stripeLookupKey], active: true, limit: 1 });
    if (!data[0]) {
      throw new HttpError(503, 'price_missing', `No existe en Stripe un precio con lookup_key "${plan.stripeLookupKey}". Ejecuta npm run stripe:setup.`);
    }
    priceCache.set(plan.id, { id: data[0].id, expires: Date.now() + 10 * 60 * 1000 });
    return data[0].id;
  }

  function planFromSubscription(subscription) {
    const price = subscription.items?.data?.[0]?.price;
    for (const plan of plans.paid) {
      if (price && (price.id === config.stripe.priceIds[plan.id] || (price.lookup_key && price.lookup_key === plan.stripeLookupKey))) {
        return plan.id;
      }
    }
    const fromMetadata = subscription.metadata?.plan_id;
    return fromMetadata && plans.has(fromMetadata) && fromMetadata !== 'free' ? fromMetadata : null;
  }

  async function ensureCustomer(user) {
    if (user.stripe_customer_id) return user.stripe_customer_id;
    const customer = await stripe.customers.create(
      { email: user.email, name: user.business_name || user.name, metadata: { user_id: user.id } },
      { idempotencyKey: `customer-${user.id}` },
    );
    const { rows } = await db.query(
      `UPDATE users SET stripe_customer_id = COALESCE(stripe_customer_id, $2), updated_at = now()
       WHERE id = $1 RETURNING stripe_customer_id`,
      [user.id, customer.id],
    );
    return rows[0].stripe_customer_id;
  }

  async function findUserForCustomer(customerId, fallbackUserId) {
    if (customerId) {
      const { rows } = await db.query('SELECT * FROM users WHERE stripe_customer_id = $1', [customerId]);
      if (rows[0]) return rows[0];
    }
    if (fallbackUserId && /^[0-9a-f-]{36}$/i.test(fallbackUserId)) {
      const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [fallbackUserId]);
      const user = rows[0];
      if (user && customerId && !user.stripe_customer_id) {
        await db.query('UPDATE users SET stripe_customer_id = $2 WHERE id = $1 AND stripe_customer_id IS NULL', [user.id, customerId]);
      }
      return user ?? null;
    }
    return null;
  }

  /** Guarda el estado de la suscripción y recalcula el plan del usuario. */
  async function syncSubscription(subscription) {
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
    const user = await findUserForCustomer(customerId, subscription.metadata?.user_id);
    if (!user) {
      logger.warn('suscripción sin usuario asociado', { subscription: subscription.id });
      return;
    }
    const planId = planFromSubscription(subscription);
    if (!planId) {
      logger.warn('suscripción con precio desconocido', { subscription: subscription.id });
      return;
    }
    const item = subscription.items?.data?.[0];
    const price = item?.price;
    const interval = price?.recurring?.interval ?? 'month';
    const intervalCount = price?.recurring?.interval_count ?? 1;
    const monthlyFactor = interval === 'year' ? 1 / (12 * intervalCount) : interval === 'month' ? 1 / intervalCount : 1;
    const monthlyAmount = Math.round((price?.unit_amount ?? 0) * (item?.quantity ?? 1) * monthlyFactor);
    // Desde la versión 2025-03-31 de la API, el periodo vive en cada item de la suscripción.
    const periodEnd = item?.current_period_end ?? subscription.current_period_end;

    await db.tx(async (q) => {
      await q.query(
        `INSERT INTO subscriptions (user_id, provider, provider_subscription_id, plan_id, status, amount_cents, currency,
           current_period_end, cancel_at_period_end, canceled_at, updated_at)
         VALUES ($1, 'stripe', $2, $3, $4, $5, $6, $7, $8, $9, now())
         ON CONFLICT (provider_subscription_id) DO UPDATE SET
           plan_id = EXCLUDED.plan_id, status = EXCLUDED.status, amount_cents = EXCLUDED.amount_cents,
           currency = EXCLUDED.currency, current_period_end = EXCLUDED.current_period_end,
           cancel_at_period_end = EXCLUDED.cancel_at_period_end, canceled_at = EXCLUDED.canceled_at, updated_at = now()`,
        [
          user.id, subscription.id, planId, subscription.status, monthlyAmount, price?.currency ?? 'mxn',
          periodEnd ? new Date(periodEnd * 1000) : null,
          Boolean(subscription.cancel_at_period_end || subscription.cancel_at),
          subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
        ],
      );
      const { rows } = await q.query(
        `SELECT plan_id FROM subscriptions WHERE user_id = $1 AND status = ANY($2::text[])
         ORDER BY amount_cents DESC LIMIT 1`,
        [user.id, GRANTING_STATUSES],
      );
      if (rows[0]) {
        await q.query(
          `UPDATE users SET plan_id = $2, plan_source = 'stripe', plan_expires_at = NULL, updated_at = now() WHERE id = $1`,
          [user.id, rows[0].plan_id],
        );
      } else {
        await q.query(
          `UPDATE users SET plan_id = 'free', plan_source = 'default', plan_expires_at = NULL, updated_at = now()
           WHERE id = $1 AND plan_source = 'stripe'`,
          [user.id],
        );
      }
    });
    logger.info('suscripción sincronizada', { user: user.id, subscription: subscription.id, status: subscription.status, plan: planId });
  }

  async function recordInvoicePaid(invoice) {
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    const user = await findUserForCustomer(customerId);
    const paidAt = invoice.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : new Date();
    await db.query(
      `INSERT INTO payments (user_id, provider, provider_invoice_id, amount_cents, currency, status, paid_at)
       VALUES ($1, 'stripe', $2, $3, $4, 'paid', $5)
       ON CONFLICT (provider_invoice_id) DO NOTHING`,
      [user?.id ?? null, invoice.id, invoice.amount_paid ?? 0, invoice.currency ?? 'mxn', paidAt],
    );
  }

  async function notifyPaymentFailed(invoice) {
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    const user = await findUserForCustomer(customerId);
    if (!user) return;
    const message = emails.paymentFailed(config.appName, user.name, `${config.appUrl}/app#/planes`);
    await mailer.send({ to: user.email, ...message }).catch((error) => logger.error('no se envió aviso de pago fallido', errorFields(error)));
  }

  async function processEvent(event) {
    const object = event.data.object;
    switch (event.type) {
      case 'checkout.session.completed':
        if (object.mode === 'subscription' && object.subscription) {
          await findUserForCustomer(object.customer, object.client_reference_id);
          const id = typeof object.subscription === 'string' ? object.subscription : object.subscription.id;
          await syncSubscription(await stripe.subscriptions.retrieve(id));
        }
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed':
        // Se vuelve a consultar para usar siempre el estado más reciente (los eventos pueden llegar desordenados).
        await syncSubscription(await stripe.subscriptions.retrieve(object.id));
        break;
      case 'invoice.paid':
        await recordInvoicePaid(object);
        break;
      case 'invoice.payment_failed':
        await notifyPaymentFailed(object);
        break;
      default:
        break;
    }
  }

  return {
    enabled,

    async createCheckout(user, planId) {
      assertEnabled();
      const plan = plans.get(planId);
      if (!plans.has(planId) || plan.priceMxn <= 0) throw badRequest('Plan no válido.');
      const { rows } = await db.query(
        'SELECT 1 FROM subscriptions WHERE user_id = $1 AND status = ANY($2::text[]) LIMIT 1',
        [user.id, GRANTING_STATUSES],
      );
      if (rows.length) {
        throw new HttpError(409, 'already_subscribed', 'Ya tienes una suscripción. Cambia de plan desde "Administrar suscripción".');
      }
      const customer = await ensureCustomer(user);
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer,
        client_reference_id: user.id,
        line_items: [{ price: await resolvePriceId(plan), quantity: 1 }],
        subscription_data: { metadata: { user_id: user.id, plan_id: plan.id } },
        metadata: { user_id: user.id, plan_id: plan.id },
        allow_promotion_codes: true,
        locale: 'es',
        success_url: `${config.appUrl}/app?pago=ok#/planes`,
        cancel_url: `${config.appUrl}/app?pago=cancelado#/planes`,
      });
      return session.url;
    },

    async createPortal(user) {
      assertEnabled();
      if (!user.stripe_customer_id) throw badRequest('Aún no tienes una suscripción de pago.');
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripe_customer_id,
        return_url: `${config.appUrl}/app#/planes`,
        locale: 'es',
      });
      return session.url;
    },

    async handleWebhook(rawBody, signature) {
      assertEnabled();
      let event;
      try {
        event = stripe.webhooks.constructEvent(rawBody, signature ?? '', config.stripe.webhookSecret);
      } catch {
        throw badRequest('Firma de webhook inválida.');
      }
      const inserted = await db.query(
        'INSERT INTO billing_events (id, type) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING RETURNING id',
        [event.id, event.type],
      );
      if (!inserted.rows.length) return { duplicate: true };
      try {
        await processEvent(event);
      } catch (error) {
        // Se borra el registro para que el reintento de Stripe vuelva a procesarlo.
        await db.query('DELETE FROM billing_events WHERE id = $1', [event.id]);
        logger.error('falló el procesamiento del webhook', { event: event.id, type: event.type, ...errorFields(error) });
        throw error;
      }
      return { duplicate: false, type: event.type };
    },

    /** Cancela de inmediato las suscripciones activas antes de borrar una cuenta. */
    async cancelAllForUser(user) {
      if (!enabled) return;
      const { rows } = await db.query(
        "SELECT provider_subscription_id FROM subscriptions WHERE user_id = $1 AND status NOT IN ('canceled', 'incomplete_expired')",
        [user.id],
      );
      for (const row of rows) {
        try {
          await stripe.subscriptions.cancel(row.provider_subscription_id);
        } catch (error) {
          if (error?.statusCode !== 404) throw error;
        }
      }
    },
  };
}
