const formatters = new Map();

/** Periodo de facturación de créditos: mes calendario en la zona horaria del negocio (AAAA-MM). */
export function periodFor(date, timezone) {
  if (!formatters.has(timezone)) {
    formatters.set(timezone, new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit' }));
  }
  const parts = formatters.get(timezone).formatToParts(date);
  const year = parts.find((part) => part.type === 'year').value;
  const month = parts.find((part) => part.type === 'month').value;
  return `${year}-${month}`;
}

export function nextPeriodStartLabel(period) {
  const [year, month] = period.split('-').map(Number);
  const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
  return `${next}-01`;
}

export async function getUsed(db, userId, period) {
  const { rows } = await db.query('SELECT used FROM usage_counters WHERE user_id = $1 AND period = $2', [userId, period]);
  return rows[0]?.used ?? 0;
}

export async function usageSummary(db, userId, plan, timezone, now = new Date()) {
  const period = periodFor(now, timezone);
  const used = await getUsed(db, userId, period);
  return {
    period,
    used,
    limit: plan.monthlyCredits,
    remaining: Math.max(plan.monthlyCredits - used, 0),
    resetsOn: nextPeriodStartLabel(period),
  };
}

/**
 * Reserva créditos de forma atómica (segura con varias instancias y peticiones simultáneas).
 * Devuelve true si se reservaron; false si se rebasaría el límite.
 */
export async function reserveCredits(db, { userId, period, cost, limit }) {
  if (cost > limit) return false;
  const { rows } = await db.query(
    `INSERT INTO usage_counters (user_id, period, used) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, period) DO UPDATE SET used = usage_counters.used + $3
     WHERE usage_counters.used + $3 <= $4
     RETURNING used`,
    [userId, period, cost, limit],
  );
  return rows.length > 0;
}

export async function refundCredits(db, { userId, period, cost }) {
  await db.query(
    'UPDATE usage_counters SET used = GREATEST(used - $3, 0) WHERE user_id = $1 AND period = $2',
    [userId, period, cost],
  );
}
