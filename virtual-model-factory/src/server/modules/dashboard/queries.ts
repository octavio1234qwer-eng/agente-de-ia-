import type { Queryable } from "../../db/types";

export type DashboardData = {
  models: { total: number; active: number; paused: number; draft: number; demo: number };
  jobs: { queued: number; running: number; failed: number; waitingApproval: number };
  pendingApprovals: number;
  errors24h: number;
  recentErrors: { id: number; created_at: Date; agent: string; message: string }[];
  socialAccounts: { total: number; connected: number };
  finance: { grossCents: number; feeCents: number; netCents: number; expensesCents: number; transactions: number; currency: string };
  content: { total: number; inReview: number; scheduled: number };
};

/** Métricas reales de la base de datos (con RLS). Sin datos => ceros, nunca valores inventados. */
export async function getDashboardData(db: Queryable, now = new Date()): Promise<DashboardData> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [m] = await db.query<DashboardData["models"]>(
    `select count(*) filter (where status <> 'archived')::int as total,
            count(*) filter (where status = 'active')::int as active,
            count(*) filter (where status = 'paused')::int as paused,
            count(*) filter (where status = 'draft')::int as draft,
            count(*) filter (where is_demo and status <> 'archived')::int as demo
       from vmf.models`,
  );
  const [j] = await db.query<DashboardData["jobs"]>(
    `select count(*) filter (where status = 'queued')::int as queued,
            count(*) filter (where status = 'running')::int as running,
            count(*) filter (where status in ('failed', 'dead'))::int as failed,
            count(*) filter (where status = 'waiting_approval')::int as "waitingApproval"
       from vmf.automation_jobs`,
  );
  const [a] = await db.query<{ n: number }>("select count(*)::int as n from vmf.approvals where status = 'pending'");
  const [e] = await db.query<{ n: number }>(
    "select count(*)::int as n from vmf.agent_logs where level = 'error' and created_at > now() - interval '24 hours'",
  );
  const recentErrors = await db.query<DashboardData["recentErrors"][number]>(
    "select id, created_at, agent, message from vmf.agent_logs where level = 'error' order by created_at desc limit 5",
  );
  const [s] = await db.query<DashboardData["socialAccounts"]>(
    "select count(*)::int as total, count(*) filter (where status = 'connected')::int as connected from vmf.social_accounts",
  );
  const [t] = await db.query<{ gross: number; fee: number; net: number; n: number }>(
    `select coalesce(sum(gross_cents), 0)::bigint as gross, coalesce(sum(fee_cents), 0)::bigint as fee,
            coalesce(sum(net_cents), 0)::bigint as net, count(*)::int as n
       from vmf.transactions where occurred_at >= $1 and currency = 'USD'`,
    [monthStart],
  );
  const [x] = await db.query<{ total: number }>(
    "select coalesce(sum(amount_cents), 0)::bigint as total from vmf.expenses where incurred_at >= $1 and currency = 'USD'",
    [monthStart],
  );
  const [c] = await db.query<DashboardData["content"]>(
    `select (select count(*)::int from vmf.content_library where status <> 'archived') as total,
            (select count(*)::int from vmf.content_library where status = 'in_review') as "inReview",
            (select count(*)::int from vmf.publishing_calendar where status = 'scheduled') as scheduled`,
  );
  return {
    models: m!, jobs: j!, pendingApprovals: a!.n, errors24h: e!.n, recentErrors,
    socialAccounts: s!,
    finance: { grossCents: t!.gross, feeCents: t!.fee, netCents: t!.net, expensesCents: x!.total, transactions: t!.n, currency: "USD" },
    content: c!,
  };
}
