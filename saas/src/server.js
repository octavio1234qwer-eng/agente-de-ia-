import { createAiProvider } from './ai/providers.js';
import { createApp } from './app.js';
import { loadConfig, loadEnvFile } from './config.js';
import { createDb } from './db/index.js';
import { migrate } from './db/migrate.js';
import { createLogger, errorFields } from './lib/logger.js';
import { buildPlans } from './plans.js';
import { createBilling, createStripeClient } from './services/billing.js';
import { startMaintenance } from './services/jobs.js';
import { createMailer } from './services/mailer.js';

loadEnvFile();
const config = loadConfig();
const logger = createLogger({ level: config.logLevel });

async function main() {
  for (const warning of config.warnings) logger.warn(warning);

  const db = await createDb({ ...config.db, pgliteDir: config.db.pgliteDir ?? './data/pglite' });
  await migrate(db, logger);

  const plans = buildPlans(config.plans);
  const ai = createAiProvider(config.ai);
  const mailer = createMailer(config.mail, { logger, isProduction: config.isProduction });
  const stripe = config.stripe.secretKey ? createStripeClient(config.stripe.secretKey) : null;
  const billing = createBilling({ config, db, logger, plans, mailer, stripe });

  const app = createApp({ config, db, logger, plans, ai, billing, mailer });
  const server = app.listen(config.port, () => {
    logger.info('servidor iniciado', {
      url: config.appUrl, port: config.port, database: db.kind, ai: ai.name, billing: billing.enabled, email: mailer.enabled,
    });
  });
  server.requestTimeout = config.ai.timeoutMs * 2 + 10_000;
  const stopMaintenance = startMaintenance(db, plans, logger);

  let closing = false;
  const shutdown = (signal) => {
    if (closing) return;
    closing = true;
    logger.info('apagando', { signal });
    stopMaintenance();
    server.close(async () => {
      await db.close().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 25_000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  logger.error('no se pudo iniciar', errorFields(error));
  process.exit(1);
});
