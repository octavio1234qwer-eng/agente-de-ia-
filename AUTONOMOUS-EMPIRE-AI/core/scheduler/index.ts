/**
 * Ejecución de rutinas con: prevención de duplicados (job_name + period_key único),
 * reintentos con backoff, límite de tiempo, registro y alertas.
 */
import type { Db } from "../db";
import { appendAudit } from "../audit-log";
import { raiseAlert } from "../event-bus";

export interface JobOptions { maxAttempts?: number; timeoutMs?: number; backoffMs?: number; force?: boolean }
export type JobResult = { status: "succeeded" | "failed" | "skipped"; summary?: unknown; error?: string; attempts: number };

export function periodKey(kind: "hourly" | "daily" | "weekly" | "monthly", d = new Date()): string {
  const iso = d.toISOString();
  if (kind === "hourly") return iso.slice(0, 13);
  if (kind === "daily") return iso.slice(0, 10);
  if (kind === "monthly") return iso.slice(0, 7);
  // Semana ISO
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const w = Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(w).padStart(2, "0")}`;
}

const withTimeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`Tiempo límite excedido (${ms} ms)`)), ms).unref?.())]);

export async function runJob(
  db: Db, jobName: string, period: string, fn: () => Promise<unknown>, opts: JobOptions = {},
): Promise<JobResult> {
  const maxAttempts = opts.maxAttempts ?? 3, timeoutMs = opts.timeoutMs ?? 120_000, backoffMs = opts.backoffMs ?? 2_000;

  // Reclamar la ejecución de forma atómica. Una ejecución "running" de hace > 2×timeout se considera colgada.
  const claim = await db.transaction(async (tx) => {
    const ins = await tx.query<{ id: string }>(
      `insert into job_runs(job_name, period_key, status) values ($1,$2,'running') on conflict (job_name, period_key) do nothing returning id`,
      [jobName, period],
    );
    if (ins.rows[0]) return { id: ins.rows[0].id, attempts: 1 };
    const ex = await tx.query<{ id: string; status: string; attempts: number; started_at: string }>(
      "select id, status, attempts, started_at from job_runs where job_name=$1 and period_key=$2 for update",
      [jobName, period],
    );
    const row = ex.rows[0]!;
    const stale = row.status === "running" && Date.now() - new Date(row.started_at).getTime() > 2 * timeoutMs;
    if (row.status === "succeeded" && !opts.force) return null;
    if (row.status === "running" && !stale) return null;
    await tx.query("update job_runs set status='running', attempts=attempts+1, started_at=now(), error=null where id=$1", [row.id]);
    return { id: row.id, attempts: Number(row.attempts) + 1 };
  });
  if (!claim) return { status: "skipped", attempts: 0 };

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const summary = await withTimeout(fn(), timeoutMs);
      await db.query("update job_runs set status='succeeded', finished_at=now(), summary=$2, attempts=$3 where id=$1", [
        claim.id, JSON.stringify(summary ?? null), claim.attempts + attempt - 1,
      ]);
      await db.transaction((tx) => appendAudit(tx, { actor: "system:scheduler", action: `job:${jobName}`, level: "system", target: period, result: "succeeded", detail: { attempt } }));
      return { status: "succeeded", summary, attempts: attempt };
    } catch (e) {
      lastErr = e;
      if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, backoffMs * 2 ** (attempt - 1)));
    }
  }
  const error = lastErr instanceof Error ? lastErr.message : String(lastErr);
  await db.query("update job_runs set status='failed', finished_at=now(), error=$2 where id=$1", [claim.id, error]);
  await db.transaction(async (tx) => {
    await appendAudit(tx, { actor: "system:scheduler", action: `job:${jobName}`, level: "system", target: period, result: "failed", detail: { error } });
    await raiseAlert(tx, { severity: "critical", source: `job:${jobName}`, message: `La rutina ${jobName} (${period}) falló: ${error}`, dedupeKey: `job:${jobName}:${period}` });
  });
  return { status: "failed", error, attempts: maxAttempts };
}
