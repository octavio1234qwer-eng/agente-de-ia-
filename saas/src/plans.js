/**
 * Catálogo de planes. Los créditos se reinician el día 1 de cada mes (zona horaria APP_TIMEZONE).
 * maxInputChars es el total de caracteres por solicitud.
 * El precio que se cobra lo define Stripe; `priceMxn` solo se usa para mostrarlo y debe coincidir.
 */
export function buildPlans(planConfig) {
  const plans = [
    {
      id: 'free',
      name: 'Gratis',
      priceMxn: 0,
      monthlyCredits: planConfig.freeCredits,
      maxInputChars: 4000,
      premiumTools: false,
      historyDays: 7,
      stripeLookupKey: null,
      highlights: [
        `${planConfig.freeCredits.toLocaleString('es-MX')} créditos al mes`,
        'Herramientas esenciales',
        'Textos de hasta 4,000 caracteres por solicitud',
        'Historial de 7 días',
      ],
    },
    {
      id: 'pro',
      name: 'Pro',
      priceMxn: planConfig.proPriceMxn,
      monthlyCredits: planConfig.proCredits,
      maxInputChars: 12000,
      premiumTools: true,
      historyDays: 365,
      stripeLookupKey: 'impulsaia_pro_mensual',
      highlights: [
        `${planConfig.proCredits.toLocaleString('es-MX')} créditos al mes`,
        'Todas las herramientas, incluidas cotizaciones, cobranza y análisis de documentos',
        'Textos de hasta 12,000 caracteres por solicitud',
        'Historial de 1 año',
      ],
    },
    {
      id: 'negocio',
      name: 'Negocio',
      priceMxn: planConfig.negocioPriceMxn,
      monthlyCredits: planConfig.negocioCredits,
      maxInputChars: 32000,
      premiumTools: true,
      historyDays: 730,
      stripeLookupKey: 'impulsaia_negocio_mensual',
      highlights: [
        `${planConfig.negocioCredits.toLocaleString('es-MX')} créditos al mes`,
        'Todas las herramientas',
        'Documentos de hasta 30,000 caracteres',
        'Historial de 2 años',
      ],
    },
  ];
  const byId = new Map(plans.map((plan) => [plan.id, plan]));
  return {
    list: plans,
    get: (id) => byId.get(id) ?? byId.get('free'),
    has: (id) => byId.has(id),
    paid: plans.filter((plan) => plan.priceMxn > 0),
  };
}

/** Plan vigente: un plan manual vencido regresa a Gratis. */
export function effectivePlanId(user, now = new Date()) {
  if (!user || user.plan_id === 'free') return 'free';
  if (user.plan_expires_at && new Date(user.plan_expires_at) <= now) return 'free';
  return user.plan_id;
}

export function publicPlan(plan) {
  const { stripeLookupKey, ...rest } = plan;
  return rest;
}
