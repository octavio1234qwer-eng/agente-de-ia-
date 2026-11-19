/**
 * Analytics Engine. Todas las métricas salen de la base; sin datos → ceros.
 * Reglas:
 *  - Solo transacciones con status = 'confirmed' y source != 'demo' cuentan como reales.
 *  - beneficio neto = ingresos brutos − reembolsos − comisiones − gastos operativos.
 *  - Los ingresos brutos nunca se presentan como beneficio.
 */
import { all, get, type DB } from '../../database/src/index.ts';

export type PeriodKey = 'today' | '7d' | '30d' | '90d' | 'all' | 'custom';

export function periodRange(period: PeriodKey, now: Date = new Date(), custom?: { from?: string; to?: string }): { from?: string; to?: string } {
  if (period === 'all') return {};
  if (period === 'custom') {
    const from = custom?.from && !Number.isNaN(Date.parse(custom.from)) ? new Date(custom.from).toISOString() : undefined;
    const to = custom?.to && !Number.isNaN(Date.parse(custom.to)) ? new Date(custom.to).toISOString() : undefined;
    return { from, to };
  }
  if (period === 'today') {
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    return { from: start.toISOString(), to: now.toISOString() };
  }
  const days = { '7d': 7, '30d': 30, '90d': 90 }[period];
  return { from: new Date(now.getTime() - days * 86_400_000).toISOString(), to: now.toISOString() };
}

export interface FinancialSummary {
  grossIncomeCents: number;
  refundsCents: number;
  feesCents: number;
  expensesCents: number;
  netRevenueCents: number;
  netProfitCents: number;
  confirmedIncomeCount: number;
  pendingIncomeCents: number;
  demoTransactionsExcluded: number;
  currencies: string[];
}

function where(filter: { businessId?: string; from?: string; to?: string }, alias = ''): { sql: string; params: string[] } {
  const p = alias ? `${alias}.` : '';
  const parts: string[] = [];
  const params: string[] = [];
  if (filter.businessId) { parts.push(`${p}business_id = ?`); params.push(filter.businessId); }
  if (filter.from) { parts.push(`${p}occurred_at >= ?`); params.push(filter.from); }
  if (filter.to) { parts.push(`${p}occurred_at <= ?`); params.push(filter.to); }
  return { sql: parts.length ? ' AND ' + parts.join(' AND ') : '', params };
}

export function financialSummary(db: DB, filter: { businessId?: string; from?: string; to?: string } = {}): FinancialSummary {
  const w = where(filter);
  const rows = all<{ kind: string; total: number; n: number }>(
    db,
    `SELECT kind, COALESCE(SUM(amount_cents),0) total, COUNT(*) n FROM transactions WHERE status = 'confirmed' AND source != 'demo'${w.sql} GROUP BY kind`,
    ...w.params,
  );
  const by = (k: string) => rows.find((r) => r.kind === k) ?? { total: 0, n: 0 };
  const pending = get<{ t: number }>(db, `SELECT COALESCE(SUM(amount_cents),0) t FROM transactions WHERE status = 'pending' AND kind = 'income' AND source != 'demo'${w.sql}`, ...w.params)!.t;
  const demo = get<{ n: number }>(db, `SELECT COUNT(*) n FROM transactions WHERE source = 'demo'${w.sql}`, ...w.params)!.n;
  const currencies = all<{ currency: string }>(db, `SELECT DISTINCT currency FROM transactions WHERE source != 'demo'${w.sql}`, ...w.params).map((r) => r.currency);
  const gross = by('income').total;
  const refunds = by('refund').total;
  const fees = by('fee').total;
  const expenses = by('expense').total;
  return {
    grossIncomeCents: gross,
    refundsCents: refunds,
    feesCents: fees,
    expensesCents: expenses,
    netRevenueCents: gross - refunds - fees,
    netProfitCents: gross - refunds - fees - expenses,
    confirmedIncomeCount: by('income').n,
    pendingIncomeCents: pending,
    demoTransactionsExcluded: demo,
    currencies,
  };
}

export function trafficSummary(db: DB, filter: { businessId?: string; from?: string; to?: string } = {}) {
  const parts: string[] = [];
  const params: string[] = [];
  if (filter.businessId) { parts.push('business_id = ?'); params.push(filter.businessId); }
  if (filter.from) { parts.push('created_at >= ?'); params.push(filter.from); }
  if (filter.to) { parts.push('created_at <= ?'); params.push(filter.to); }
  const w = parts.length ? 'WHERE ' + parts.join(' AND ') : '';
  const byType = all<{ type: string; n: number }>(db, `SELECT type, COUNT(*) n FROM analytics_events ${w} GROUP BY type`, ...params);
  const visitors = get<{ n: number }>(db, `SELECT COUNT(DISTINCT visitor_hash) n FROM analytics_events ${w ? w + " AND type = 'page_view'" : "WHERE type = 'page_view'"}`, ...params)!.n;
  const byChannel = all<{ channel: string; views: number; conversions: number }>(
    db,
    `SELECT channel, SUM(type = 'page_view') views, SUM(type IN ('lead','signup','purchase')) conversions FROM analytics_events ${w} GROUP BY channel ORDER BY conversions DESC, views DESC`,
    ...params,
  );
  const count = (t: string) => byType.find((r) => r.type === t)?.n ?? 0;
  const views = count('page_view');
  const conversions = count('lead') + count('signup') + count('purchase');
  return {
    pageViews: views,
    uniqueVisitors: visitors,
    leads: count('lead'),
    signups: count('signup'),
    purchases: count('purchase'),
    conversionRatePct: views > 0 ? Math.round((conversions / views) * 10000) / 100 : null,
    byChannel,
  };
}

export function topProducts(db: DB, filter: { businessId?: string; from?: string; to?: string } = {}, limit = 5) {
  const w = where(filter, 't');
  return all<{ product_id: string; name: string; sales: number; revenue_cents: number }>(
    db,
    `SELECT t.product_id, p.name, COUNT(*) sales, SUM(t.amount_cents) revenue_cents FROM transactions t JOIN products p ON p.id = t.product_id
     WHERE t.kind = 'income' AND t.status = 'confirmed' AND t.source != 'demo'${w.sql} GROUP BY t.product_id ORDER BY revenue_cents DESC LIMIT ?`,
    ...w.params, limit,
  );
}

/** Snapshot del Command Center: todo calculado desde la base. */
export function dashboard(db: DB, opts: { from?: string; to?: string } = {}) {
  const count = (sql: string, ...p: string[]) => get<{ n: number }>(db, sql, ...p)!.n;
  const businesses = all<Record<string, unknown>>(db, "SELECT id, name, status, autonomy_level, currency, brand_color FROM businesses WHERE status != 'archived' ORDER BY created_at");
  const perBusiness = businesses.map((b) => ({
    id: b.id, name: b.name, status: b.status, autonomyLevel: b.autonomy_level, currency: b.currency, brandColor: b.brand_color,
    finance: financialSummary(db, { businessId: b.id as string, ...opts }),
    products: count("SELECT COUNT(*) n FROM products WHERE business_id = ? AND status != 'archived'", b.id as string),
    customers: count("SELECT COUNT(*) n FROM customers WHERE business_id = ? AND kind = 'customer'", b.id as string),
    leads: count("SELECT COUNT(*) n FROM customers WHERE business_id = ? AND kind = 'lead'", b.id as string),
  }));
  const tasks = Object.fromEntries(all<{ status: string; n: number }>(db, 'SELECT status, COUNT(*) n FROM tasks GROUP BY status').map((r) => [r.status, r.n]));
  const infra = get<{ t: number }>(db, 'SELECT COALESCE(SUM(monthly_cents),0) t FROM service_costs WHERE enabled = 1')!.t;
  return {
    generatedAt: new Date().toISOString(),
    businesses: { active: businesses.filter((b) => b.status === 'active').length, total: businesses.length, list: perBusiness },
    agents: { activeRunning: count("SELECT COUNT(DISTINCT agent_id) n FROM tasks WHERE status = 'RUNNING'") },
    tasks: {
      pending: (tasks.PENDING ?? 0) + (tasks.QUEUED ?? 0),
      running: tasks.RUNNING ?? 0,
      waitingApproval: tasks.WAITING_APPROVAL ?? 0,
      completed: tasks.COMPLETED ?? 0,
      failed: tasks.FAILED ?? 0,
      cancelled: tasks.CANCELLED ?? 0,
    },
    products: count("SELECT COUNT(*) n FROM products WHERE status != 'archived'"),
    customers: count("SELECT COUNT(*) n FROM customers WHERE kind = 'customer'"),
    leads: count("SELECT COUNT(*) n FROM customers WHERE kind = 'lead'"),
    quotes: count('SELECT COUNT(*) n FROM quotes'),
    finance: financialSummary(db, opts),
    infrastructureMonthlyCents: infra,
    unreadNotifications: count('SELECT COUNT(*) n FROM notifications WHERE read = 0'),
    recentActivity: all(db, 'SELECT actor, action, entity, entity_id, business_id, created_at FROM audit_log ORDER BY id DESC LIMIT 15'),
  };
}
