import path from 'node:path';
import express from 'express';
import { rootDir } from './config.js';
import { errorHandler, notFoundApi, setLocale } from './middleware/errors.js';
import { loadSession } from './middleware/auth.js';
import { csrfProtection, noStore, requestId, securityHeaders } from './middleware/security.js';
import { effectivePlanId } from './plans.js';
import { accountRouter } from './routes/account.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { billingRouter, stripeWebhookHandler } from './routes/billing.js';
import { toolsRouter } from './routes/tools.js';
import { usageSummary } from './services/usage.js';
import { getActiveSubscription, userView } from './services/users.js';

/** Límites de peticiones por defecto (se pueden ajustar en pruebas). */
export const DEFAULT_LIMITS = {
  register: { limit: 5, windowMs: 60 * 60 * 1000 },
  login: { limit: 10, windowMs: 15 * 60 * 1000 },
  email: { limit: 5, windowMs: 60 * 60 * 1000 },
  token: { limit: 20, windowMs: 60 * 60 * 1000 },
  run: { limit: 20, windowMs: 60 * 1000 },
};

/**
 * Construye la aplicación Express. Todas las dependencias se inyectan
 * (db, ai, billing, mailer) para poder probarla sin servicios externos.
 */
export function createApp({ config, db, logger, plans, ai, billing, mailer, limits = {} }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  const ctx = {
    config, db, logger, plans, ai, billing, mailer,
    limits: { ...DEFAULT_LIMITS, ...limits },
    async sendUser(res, user, locale = res.req?.locale) {
      const plan = plans.get(effectivePlanId(user));
      const [usage, subscription] = await Promise.all([
        usageSummary(db, user.id, plan, config.timezone),
        getActiveSubscription(db, user.id),
      ]);
      res.json({ user: userView(user, { plans, usage, subscription, billingEnabled: billing.enabled, locale }) });
    },
  };

  app.use(requestId);
  app.use(securityHeaders(config));
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api/')) return next();
    const started = Date.now();
    const route = req.path; // Sin query string: nunca registrar tokens ni parámetros.
    res.on('finish', () => {
      logger.info('petición', { requestId: req.id, method: req.method, path: route, status: res.statusCode, ms: Date.now() - started });
    });
    next();
  });

  app.get('/health', async (_req, res) => {
    try {
      await db.query('SELECT 1');
      res.json({ ok: true, database: 'ok' });
    } catch {
      res.status(503).json({ ok: false, database: 'error' });
    }
  });

  // El webhook va antes de express.json: Stripe firma el cuerpo exacto.
  app.post('/api/webhooks/stripe', express.raw({ type: 'application/json', limit: '1mb' }), stripeWebhookHandler(ctx));

  const api = express.Router();
  api.use(noStore);
  api.use(express.json({ limit: '256kb' }));
  api.use(csrfProtection(config));
  api.use(loadSession(ctx));
  api.use(setLocale);
  api.use('/auth', authRouter(ctx));
  api.use('/account', accountRouter(ctx));
  api.use('/admin', adminRouter(ctx));
  api.use(billingRouter(ctx));
  api.use(toolsRouter(ctx));
  api.use(notFoundApi);
  app.use('/api', api);

  const publicDir = path.join(rootDir, 'public');
  app.use(express.static(publicDir, {
    extensions: ['html'],
    setHeaders(res, file) {
      res.set('Cache-Control', file.endsWith('.html') ? 'no-cache' : 'public, max-age=300');
    },
  }));
  app.use((req, res) => {
    res.status(404).sendFile(path.join(publicDir, '404.html'));
  });

  app.use(errorHandler(logger));
  return app;
}
