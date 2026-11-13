import { once } from 'node:events';
import Stripe from 'stripe';
import { createAiProvider } from '../src/ai/providers.js';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createDb } from '../src/db/index.js';
import { migrate } from '../src/db/migrate.js';
import { createLogger } from '../src/lib/logger.js';
import { buildPlans } from '../src/plans.js';
import { createBilling } from '../src/services/billing.js';

export const APP_URL = 'http://localhost:3000';
export const WEBHOOK_SECRET = 'whsec_test_secret';
export const PASSWORD = 'una frase bastante segura';

const GENEROUS_LIMITS = {
  register: { limit: 1000, windowMs: 60_000 },
  login: { limit: 1000, windowMs: 60_000 },
  email: { limit: 1000, windowMs: 60_000 },
  token: { limit: 1000, windowMs: 60_000 },
  run: { limit: 1000, windowMs: 60_000 },
};

/**
 * Base de datos de prueba: PGlite en memoria, o una base nueva en PostgreSQL real
 * si se define TEST_DATABASE_URL (por ejemplo en CI).
 */
async function testDatabase() {
  const adminUrl = process.env.TEST_DATABASE_URL;
  if (!adminUrl) return { db: await createDb({ memory: true }), dropDatabase: async () => {} };
  const name = `prueba_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const admin = await createDb({ url: adminUrl, poolMax: 1 });
  await admin.query(`CREATE DATABASE ${name}`);
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  const db = await createDb({ url: url.toString(), poolMax: 5 });
  return {
    db,
    dropDatabase: async () => {
      await admin.query(`DROP DATABASE IF EXISTS ${name}`);
      await admin.close();
    },
  };
}

/** Levanta la app completa con base de datos en memoria y dependencias falsas. */
export async function setup({ env = {}, ai, stripe, limits } = {}) {
  const config = loadConfig({
    NODE_ENV: 'test',
    APP_URL,
    AI_PROVIDER: 'mock',
    REQUIRE_EMAIL_VERIFICATION: 'true',
    ADMIN_EMAILS: 'jefa@ejemplo.mx',
    ...(stripe ? { STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET } : {}),
    ...env,
  });
  const { db, dropDatabase } = await testDatabase();
  await migrate(db);
  const logger = createLogger({ silent: true });
  const plans = buildPlans(config.plans);
  const mails = [];
  const mailer = { enabled: true, send: async (message) => { mails.push(message); return true; } };
  const billing = createBilling({ config, db, logger, plans, mailer, stripe });
  const app = createApp({
    config, db, logger, plans, mailer, billing,
    ai: ai ?? createAiProvider(config.ai),
    limits: { ...GENEROUS_LIMITS, ...limits },
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;

  return {
    config, db, plans, mails, base,
    client: () => createClient(base),
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await db.close();
      await dropDatabase();
    },
    /** Último token enviado por correo a `email` (verificación o recuperación). */
    tokenFor(email, path) {
      const mail = [...mails].reverse().find((m) => m.to === email && m.text.includes(path));
      return mail?.text.match(/token=([\w-]+)/)?.[1];
    },
  };
}

function createClient(base) {
  const cookies = new Map();
  const client = {
    cookies,
    async request(method, path, body, headers = {}) {
      const response = await fetch(base + path, {
        method,
        headers: {
          Origin: APP_URL,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(cookies.size ? { Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
      });
      for (const header of response.headers.getSetCookie()) {
        const [pair] = header.split(';');
        const [name, value] = pair.split('=');
        if (!value || /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(header)) cookies.delete(name);
        else cookies.set(name, value);
      }
      const text = await response.text();
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch { json = null; }
      return { status: response.status, body: json, headers: response.headers };
    },
    get: (path, headers) => client.request('GET', path, undefined, headers),
    post: (path, body = {}, headers) => client.request('POST', path, body, headers),
    patch: (path, body, headers) => client.request('PATCH', path, body, headers),
    del: (path, body, headers) => client.request('DELETE', path, body, headers),
  };
  return client;
}

/** Registra un usuario y, opcionalmente, confirma su correo. Devuelve el cliente con sesión. */
export async function signUp(ctx, { email, name = 'Usuario Prueba', verify = true } = {}) {
  const client = ctx.client();
  const res = await client.post('/api/auth/register', { name, email, password: PASSWORD, acceptTerms: true });
  if (res.status !== 201) throw new Error(`registro falló: ${res.status} ${JSON.stringify(res.body)}`);
  if (verify) {
    const token = ctx.tokenFor(email, '/verificar');
    const verified = await client.post('/api/auth/verify-email', { token });
    if (verified.status !== 200) throw new Error('verificación falló');
  }
  return { client, user: res.body.user };
}

/** Stripe falso: usa la verificación de firmas real de la librería y simula la API. */
export function fakeStripe() {
  const real = new Stripe('sk_test_dummy');
  const subscriptions = new Map();
  const calls = { customers: [], checkout: [], portal: [], canceled: [] };
  const stripe = {
    webhooks: real.webhooks,
    calls,
    subscriptions: {
      retrieve: async (id) => {
        const sub = subscriptions.get(id);
        if (!sub) throw Object.assign(new Error('No such subscription'), { statusCode: 404 });
        return sub;
      },
      cancel: async (id) => {
        calls.canceled.push(id);
        const sub = subscriptions.get(id);
        if (sub) sub.status = 'canceled';
        return sub;
      },
    },
    customers: {
      create: async (params) => {
        calls.customers.push(params);
        return { id: `cus_${calls.customers.length}` };
      },
    },
    prices: {
      list: async ({ lookup_keys: keys }) => ({ data: [{ id: `price_${keys[0]}`, lookup_key: keys[0] }] }),
    },
    checkout: {
      sessions: {
        create: async (params) => {
          calls.checkout.push(params);
          return { url: 'https://checkout.stripe.com/c/pay/cs_test_123' };
        },
      },
    },
    billingPortal: {
      sessions: {
        create: async (params) => {
          calls.portal.push(params);
          return { url: 'https://billing.stripe.com/p/session/test_123' };
        },
      },
    },
    /** Registra una suscripción simulada (lo que devolvería la API). */
    setSubscription({ id = 'sub_1', customer = 'cus_1', status = 'active', lookupKey = 'impulsaia_pro_mensual', amount = 19900, userId, planId } = {}) {
      const sub = {
        id, object: 'subscription', customer, status,
        cancel_at_period_end: false, cancel_at: null, canceled_at: status === 'canceled' ? Math.floor(Date.now() / 1000) : null,
        metadata: { ...(userId ? { user_id: userId } : {}), ...(planId ? { plan_id: planId } : {}) },
        items: { data: [{ quantity: 1, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400, price: { id: `price_${lookupKey}`, lookup_key: lookupKey, unit_amount: amount, currency: 'mxn', recurring: { interval: 'month', interval_count: 1 } } }] },
      };
      subscriptions.set(id, sub);
      return sub;
    },
  };
  return stripe;
}

/** Envía un evento firmado al webhook, igual que lo haría Stripe. */
export async function sendWebhook(ctx, stripe, event, { secret = WEBHOOK_SECRET } = {}) {
  const payload = JSON.stringify({ id: `evt_${Math.random().toString(36).slice(2)}`, object: 'event', ...event });
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
  const response = await fetch(`${ctx.base}/api/webhooks/stripe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signature },
    body: payload,
  });
  return { status: response.status, body: await response.json().catch(() => null), id: JSON.parse(payload).id, payload };
}
