import { tools } from '../ai/tools.js';

const toolNames = new Map(tools.map((tool) => [tool.id, tool.name]));

/** Métricas del negocio para el panel de administración. */
export async function adminStats(db, { timezone, plans, ai }) {
  const [users, planRows, subs, revenue, usage, daily, topTools, conversion] = await Promise.all([
    db.query(`SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS new7d,
        COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days')::int AS new30d,
        COUNT(*) FILTER (WHERE email_verified_at IS NOT NULL)::int AS verified,
        COUNT(*) FILTER (WHERE status = 'suspended')::int AS suspended,
        COUNT(*) FILTER (WHERE last_login_at >= now() - interval '30 days')::int AS active30d
      FROM users`),
    db.query(`SELECT CASE WHEN plan_expires_at IS NULL OR plan_expires_at > now() THEN plan_id ELSE 'free' END AS plan,
        COUNT(*)::int AS users
      FROM users GROUP BY 1`),
    db.query(`SELECT
        COUNT(*) FILTER (WHERE status IN ('active', 'trialing'))::int AS active,
        COUNT(*) FILTER (WHERE status = 'past_due')::int AS past_due,
        COUNT(*) FILTER (WHERE status = 'canceled' AND canceled_at >= now() - interval '30 days')::int AS canceled30d,
        COALESCE(SUM(amount_cents) FILTER (WHERE status IN ('active', 'trialing', 'past_due')), 0)::bigint AS mrr_cents
      FROM subscriptions`),
    db.query(`SELECT
        COALESCE(SUM(amount_cents) FILTER (WHERE paid_at >= now() - interval '30 days'), 0)::bigint AS paid30d_cents,
        COALESCE(SUM(amount_cents), 0)::bigint AS paid_total_cents,
        COUNT(*)::int AS payments
      FROM payments WHERE status = 'paid'`),
    db.query(`SELECT
        COUNT(*)::int AS generations,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
        COUNT(DISTINCT user_id)::int AS active_users,
        COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
        COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
        COALESCE(AVG(latency_ms) FILTER (WHERE status = 'succeeded'), 0)::int AS avg_latency_ms
      FROM generations WHERE created_at >= now() - interval '30 days'`),
    db.query(`WITH days AS (
        SELECT generate_series((now() AT TIME ZONE $1)::date - 29, (now() AT TIME ZONE $1)::date, interval '1 day')::date AS day
      ),
      g AS (
        SELECT (created_at AT TIME ZONE $1)::date AS day, COUNT(*)::int AS n
        FROM generations WHERE created_at >= now() - interval '31 days' GROUP BY 1
      ),
      u AS (
        SELECT (created_at AT TIME ZONE $1)::date AS day, COUNT(*)::int AS n
        FROM users WHERE created_at >= now() - interval '31 days' GROUP BY 1
      )
      SELECT to_char(days.day, 'YYYY-MM-DD') AS day, COALESCE(g.n, 0)::int AS generations, COALESCE(u.n, 0)::int AS signups
      FROM days LEFT JOIN g ON g.day = days.day LEFT JOIN u ON u.day = days.day
      ORDER BY days.day`, [timezone]),
    db.query(`SELECT tool_id, COUNT(*)::int AS uses
      FROM generations WHERE created_at >= now() - interval '30 days'
      GROUP BY tool_id ORDER BY uses DESC LIMIT 8`),
    db.query(`SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE plan_id <> 'free' AND (plan_expires_at IS NULL OR plan_expires_at > now()))::int AS paying
      FROM users WHERE role = 'user'`),
  ]);

  const u = usage.rows[0];
  const inputTokens = Number(u.input_tokens);
  const outputTokens = Number(u.output_tokens);
  const estimatedAiCostUsd = (inputTokens * ai.costInputPerMTok + outputTokens * ai.costOutputPerMTok) / 1_000_000;
  const planCounts = Object.fromEntries(plans.list.map((plan) => [plan.id, 0]));
  for (const row of planRows.rows) planCounts[row.plan] = (planCounts[row.plan] ?? 0) + row.users;
  const c = conversion.rows[0];

  return {
    generatedAt: new Date().toISOString(),
    users: users.rows[0],
    plans: plans.list.map((plan) => ({ id: plan.id, name: plan.name, users: planCounts[plan.id] ?? 0 })),
    subscriptions: {
      active: subs.rows[0].active,
      pastDue: subs.rows[0].past_due,
      canceled30d: subs.rows[0].canceled30d,
      mrrCents: Number(subs.rows[0].mrr_cents),
    },
    revenue: {
      paid30dCents: Number(revenue.rows[0].paid30d_cents),
      paidTotalCents: Number(revenue.rows[0].paid_total_cents),
      payments: revenue.rows[0].payments,
    },
    usage30d: {
      generations: u.generations,
      failed: u.failed,
      activeUsers: u.active_users,
      inputTokens,
      outputTokens,
      avgLatencyMs: u.avg_latency_ms,
      estimatedAiCostUsd: Math.round(estimatedAiCostUsd * 100) / 100,
      costConfigured: ai.costInputPerMTok > 0 || ai.costOutputPerMTok > 0,
    },
    conversionRate: c.total ? Math.round((c.paying / c.total) * 1000) / 10 : 0,
    daily: daily.rows,
    topTools: topTools.rows.map((row) => ({ toolId: row.tool_id, name: toolNames.get(row.tool_id) ?? row.tool_id, uses: row.uses })),
  };
}
