import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Carga `.env` si existe (Node >= 20.12). En producción usa variables del proveedor. */
export function loadEnvFile(file = path.join(rootDir, '.env')) {
  if (fs.existsSync(file) && typeof process.loadEnvFile === 'function') process.loadEnvFile(file);
}

const bool = (fallback) => z
  .enum(['true', 'false', '1', '0', 'yes', 'no', ''])
  .optional()
  .transform((value) => (value === undefined || value === '' ? fallback : ['true', '1', 'yes'].includes(value)));

const optionalString = z.string().trim().optional().transform((value) => value || undefined);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_NAME: z.string().trim().min(1).default('ImpulsaIA'),
  APP_URL: z.string().trim().url().default('http://localhost:3000'),
  APP_TIMEZONE: z.string().trim().default('America/Mexico_City'),
  TRUST_PROXY: z.string().trim().default('0'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  DATABASE_URL: optionalString,
  DATABASE_SSL: z.enum(['disable', 'require', 'no-verify']).default('disable'),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  PGLITE_DIR: optionalString,

  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  REQUIRE_EMAIL_VERIFICATION: bool(true),
  ADMIN_EMAILS: z.string().default('').transform((value) => value
    .split(',').map((email) => email.trim().toLowerCase()).filter(Boolean)),

  AI_PROVIDER: z.enum(['openai', 'anthropic', 'mock']).default('mock'),
  AI_MODEL: optionalString,
  OPENAI_API_KEY: optionalString,
  ANTHROPIC_API_KEY: optionalString,
  AI_TIMEOUT_MS: z.coerce.number().int().min(5000).max(300000).default(60000),
  // Solo Anthropic: nivel de esfuerzo de los modelos Claude actuales (vacío = valor por defecto del modelo).
  AI_EFFORT: z.enum(['low', 'medium', 'high', 'xhigh', 'max', '']).default('low'),
  AI_COST_INPUT_USD_PER_MTOK: z.coerce.number().min(0).default(0),
  AI_COST_OUTPUT_USD_PER_MTOK: z.coerce.number().min(0).default(0),

  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  STRIPE_PRICE_PRO: optionalString,
  STRIPE_PRICE_NEGOCIO: optionalString,

  PLAN_FREE_CREDITS: z.coerce.number().int().min(0).default(25),
  PLAN_PRO_CREDITS: z.coerce.number().int().min(1).default(500),
  PLAN_NEGOCIO_CREDITS: z.coerce.number().int().min(1).default(2000),
  PLAN_PRO_PRICE_MXN: z.coerce.number().int().min(1).default(199),
  PLAN_NEGOCIO_PRICE_MXN: z.coerce.number().int().min(1).default(499),

  MAIL_HOST: optionalString,
  MAIL_PORT: z.coerce.number().int().positive().default(587),
  MAIL_SECURE: bool(false),
  MAIL_USER: optionalString,
  MAIL_PASS: optionalString,
  MAIL_FROM: optionalString,
  SUPPORT_EMAIL: optionalString,
});

export function loadConfig(env = process.env) {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Configuración inválida: ${details}`);
  }
  const e = parsed.data;
  const isProduction = e.NODE_ENV === 'production';
  const appUrl = new URL(e.APP_URL);
  const warnings = [];

  if (isProduction) {
    if (!e.DATABASE_URL) {
      throw new Error('DATABASE_URL es obligatoria en producción (PostgreSQL). La base embebida solo es para desarrollo.');
    }
    if (appUrl.protocol !== 'https:') throw new Error('APP_URL debe usar https:// en producción.');
    if (e.AI_PROVIDER === 'mock') warnings.push('AI_PROVIDER=mock: las herramientas devuelven texto de demostración.');
    if (!e.STRIPE_SECRET_KEY || !e.STRIPE_WEBHOOK_SECRET) warnings.push('Stripe no está configurado: los pagos están deshabilitados.');
    if (e.REQUIRE_EMAIL_VERIFICATION && !e.MAIL_HOST) {
      warnings.push('REQUIRE_EMAIL_VERIFICATION=true sin SMTP: los usuarios no podrán verificar su correo.');
    }
  }
  if (e.AI_PROVIDER === 'openai' && !e.OPENAI_API_KEY) throw new Error('AI_PROVIDER=openai requiere OPENAI_API_KEY.');
  if (e.AI_PROVIDER === 'anthropic' && !e.ANTHROPIC_API_KEY) throw new Error('AI_PROVIDER=anthropic requiere ANTHROPIC_API_KEY.');
  if (e.AI_PROVIDER !== 'mock' && !e.AI_MODEL) throw new Error('Define AI_MODEL con un modelo habilitado en tu cuenta del proveedor de IA.');

  const trustProxy = /^\d+$/.test(e.TRUST_PROXY) ? Number(e.TRUST_PROXY) : e.TRUST_PROXY === 'true';

  return Object.freeze({
    env: e.NODE_ENV,
    isProduction,
    isTest: e.NODE_ENV === 'test',
    port: e.PORT,
    appName: e.APP_NAME,
    appUrl: appUrl.origin,
    timezone: e.APP_TIMEZONE,
    trustProxy,
    logLevel: e.LOG_LEVEL,
    secureCookies: appUrl.protocol === 'https:',
    db: {
      url: e.DATABASE_URL,
      ssl: e.DATABASE_SSL,
      poolMax: e.DATABASE_POOL_MAX,
      pgliteDir: e.PGLITE_DIR,
    },
    auth: {
      sessionTtlMs: e.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
      requireEmailVerification: e.REQUIRE_EMAIL_VERIFICATION,
      adminEmails: e.ADMIN_EMAILS,
    },
    ai: {
      provider: e.AI_PROVIDER,
      model: e.AI_MODEL ?? 'demo',
      openaiApiKey: e.OPENAI_API_KEY,
      anthropicApiKey: e.ANTHROPIC_API_KEY,
      timeoutMs: e.AI_TIMEOUT_MS,
      effort: e.AI_EFFORT || undefined,
      costInputPerMTok: e.AI_COST_INPUT_USD_PER_MTOK,
      costOutputPerMTok: e.AI_COST_OUTPUT_USD_PER_MTOK,
    },
    stripe: {
      secretKey: e.STRIPE_SECRET_KEY,
      webhookSecret: e.STRIPE_WEBHOOK_SECRET,
      enabled: Boolean(e.STRIPE_SECRET_KEY && e.STRIPE_WEBHOOK_SECRET),
      priceIds: { pro: e.STRIPE_PRICE_PRO, negocio: e.STRIPE_PRICE_NEGOCIO },
    },
    plans: {
      freeCredits: e.PLAN_FREE_CREDITS,
      proCredits: e.PLAN_PRO_CREDITS,
      negocioCredits: e.PLAN_NEGOCIO_CREDITS,
      proPriceMxn: e.PLAN_PRO_PRICE_MXN,
      negocioPriceMxn: e.PLAN_NEGOCIO_PRICE_MXN,
    },
    mail: {
      host: e.MAIL_HOST,
      port: e.MAIL_PORT,
      secure: e.MAIL_SECURE,
      user: e.MAIL_USER,
      pass: e.MAIL_PASS,
      from: e.MAIL_FROM ?? `${e.APP_NAME} <no-reply@${appUrl.hostname}>`,
      enabled: Boolean(e.MAIL_HOST),
    },
    supportEmail: e.SUPPORT_EMAIL,
    warnings,
  });
}
