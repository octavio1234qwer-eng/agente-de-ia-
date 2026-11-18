import { t } from './i18n.js';

/** Monedas en las que se cobran los planes. Para agregar una, súmala aquí, en la migración y en los precios. */
export const CURRENCIES = ['mxn', 'usd'];

/**
 * Catálogo de planes. Los créditos se reinician el día 1 de cada mes (zona horaria APP_TIMEZONE).
 * maxInputChars es el total de caracteres por solicitud.
 * El precio que se cobra lo define Stripe; `prices` solo se usa para mostrarlo y debe coincidir
 * (npm run stripe:setup crea los precios de Stripe con estos montos).
 */
export function buildPlans(planConfig) {
  const plans = [
    {
      id: 'free',
      prices: { mxn: 0, usd: 0 },
      monthlyCredits: planConfig.freeCredits,
      maxInputChars: 4000,
      premiumTools: false,
      historyDays: 7,
      stripeLookupKeys: {},
      highlights: (locale) => [
        t(locale, 'plan.credits', { credits: planConfig.freeCredits }),
        t(locale, 'plan.essential_tools'),
        t(locale, 'plan.chars', { chars: 4000 }),
        t(locale, 'plan.languages'),
        t(locale, 'plan.history_days', { days: 7 }),
      ],
    },
    {
      id: 'pro',
      prices: planConfig.prices.pro,
      monthlyCredits: planConfig.proCredits,
      maxInputChars: 12000,
      premiumTools: true,
      historyDays: 365,
      stripeLookupKeys: { mxn: 'impulsaia_pro_mensual', usd: 'impulsaia_pro_mensual_usd' },
      highlights: (locale) => [
        t(locale, 'plan.credits', { credits: planConfig.proCredits }),
        t(locale, 'plan.all_tools_detail'),
        t(locale, 'plan.chars', { chars: 12000 }),
        t(locale, 'plan.languages'),
        t(locale, 'plan.history_years', { years: 1 }),
      ],
    },
    {
      id: 'negocio',
      prices: planConfig.prices.negocio,
      monthlyCredits: planConfig.negocioCredits,
      maxInputChars: 32000,
      premiumTools: true,
      historyDays: 730,
      stripeLookupKeys: { mxn: 'impulsaia_negocio_mensual', usd: 'impulsaia_negocio_mensual_usd' },
      highlights: (locale) => [
        t(locale, 'plan.credits', { credits: planConfig.negocioCredits }),
        t(locale, 'plan.all_tools'),
        t(locale, 'plan.documents', { chars: 30000 }),
        t(locale, 'plan.languages'),
        t(locale, 'plan.history_years', { years: 2 }),
      ],
    },
  ];
  const byId = new Map(plans.map((plan) => [plan.id, plan]));
  return {
    list: plans,
    get: (id) => byId.get(id) ?? byId.get('free'),
    has: (id) => byId.has(id),
    paid: plans.filter((plan) => plan.prices.usd > 0),
  };
}

export const planName = (planId, locale) => t(locale, `plan.${planId}`);

/** Plan vigente: un plan manual vencido regresa a Gratis. */
export function effectivePlanId(user, now = new Date()) {
  if (!user || user.plan_id === 'free') return 'free';
  if (user.plan_expires_at && new Date(user.plan_expires_at) <= now) return 'free';
  return user.plan_id;
}

export function publicPlan(plan, locale) {
  return {
    id: plan.id,
    name: planName(plan.id, locale),
    prices: plan.prices,
    monthlyCredits: plan.monthlyCredits,
    maxInputChars: plan.maxInputChars,
    premiumTools: plan.premiumTools,
    historyDays: plan.historyDays,
    highlights: plan.highlights(locale),
  };
}
