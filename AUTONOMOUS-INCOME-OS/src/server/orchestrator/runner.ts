import { AGENTS } from "@root/agents/registry";
import type { Db } from "../db/types.ts";
import { dispatchNotifications } from "../notifications.ts";
import { getKillSwitch } from "../settings.ts";
import { runAgent } from "./agent.ts";
import { claimNext, completeTask, enqueue, failTask, cancelTask, recoverStaleTasks, type TaskRow } from "./queue.ts";

export interface TickReport {
  startedAt: string;
  killSwitch: boolean;
  enqueued: string[];
  recovered: number;
  processed: { id: string; type: string; agent: string | null; outcome: string }[];
  stoppedReason: "empty" | "time_budget" | "task_budget" | "kill_switch";
}

/** Encola las automatizaciones que tocan (una por ventana de tiempo: idempotente). */
export async function enqueueDueAutomations(db: Db, now = new Date()): Promise<string[]> {
  const { rows } = await db.query<{ key: string; task_type: string; agent: string | null; interval_minutes: number }>(
    `SELECT key, task_type, agent, interval_minutes FROM automations
     WHERE enabled = true AND (last_enqueued_at IS NULL OR last_enqueued_at <= $1::timestamptz - make_interval(mins => interval_minutes))`,
    [now.toISOString()],
  );
  const enqueued: string[] = [];
  for (const a of rows) {
    const windowIndex = Math.floor(now.getTime() / (a.interval_minutes * 60_000));
    const r = await enqueue(db, { type: a.task_type, agent: a.agent, idempotencyKey: `auto:${a.key}:${windowIndex}`, payload: { automation: a.key } });
    await db.query("UPDATE automations SET last_enqueued_at = $2 WHERE key = $1", [a.key, now.toISOString()]);
    if (r.created) enqueued.push(a.key);
  }
  return enqueued;
}

async function execute(db: Db, task: TaskRow): Promise<unknown> {
  switch (task.type) {
    case "agent.run": {
      const def = task.agent ? AGENTS[task.agent] : undefined;
      if (!def) throw new Error(`Agente desconocido: ${task.agent}`);
      const { runId, output } = await runAgent(db, def, { taskId: task.id, depth: task.depth });
      return { runId, summary: output.summary };
    }
    case "notifications.dispatch":
      return dispatchNotifications(db);
    case "maintenance.cleanup": {
      const a = await db.query("DELETE FROM rate_limits WHERE window_start < now() - interval '2 days'");
      const b = await db.query("DELETE FROM sessions WHERE expires_at < now() - interval '7 days'");
      const c = await db.query("DELETE FROM access_tokens WHERE expires_at < now() - interval '30 days'");
      const d = await db.query("DELETE FROM tasks WHERE status IN ('succeeded','cancelled') AND finished_at < now() - interval '30 days' AND id NOT IN (SELECT task_id FROM agent_runs WHERE task_id IS NOT NULL) AND id NOT IN (SELECT parent_task_id FROM tasks WHERE parent_task_id IS NOT NULL)");
      return { rateLimits: a.rowCount, sessions: b.rowCount, tokens: c.rowCount, tasks: d.rowCount };
    }
    default:
      throw new Error(`Tipo de tarea desconocido: ${task.type}`);
  }
}

/**
 * Un "tick" del sistema (lo llama GitHub Actions cada 15 min).
 * Límites para que nunca corra sin fin: tiempo máximo y número máximo de tareas.
 */
export async function runTick(db: Db, opts: { timeBudgetMs?: number; maxTasks?: number; worker?: string; now?: Date } = {}): Promise<TickReport> {
  const start = Date.now();
  const budget = opts.timeBudgetMs ?? 45_000;
  const maxTasks = opts.maxTasks ?? 20;
  const worker = opts.worker ?? `tick-${start}`;
  const report: TickReport = { startedAt: new Date(start).toISOString(), killSwitch: false, enqueued: [], recovered: 0, processed: [], stoppedReason: "empty" };

  const kill = await getKillSwitch(db);
  if (kill.active) {
    report.killSwitch = true;
    report.stoppedReason = "kill_switch";
    return report;
  }
  report.recovered = await recoverStaleTasks(db);
  report.enqueued = await enqueueDueAutomations(db, opts.now);

  const { rows: controls } = await db.query<{ agent: string; enabled: boolean }>("SELECT agent, enabled FROM agent_controls");
  const disabled = new Set(controls.filter((c) => !c.enabled).map((c) => c.agent));

  while (true) {
    if (report.processed.length >= maxTasks) {
      report.stoppedReason = "task_budget";
      break;
    }
    if (Date.now() - start > budget) {
      report.stoppedReason = "time_budget";
      break;
    }
    // El interruptor se revisa antes de cada tarea: el auditor puede activarlo a mitad del tick.
    if ((await getKillSwitch(db)).active) {
      report.killSwitch = true;
      report.stoppedReason = "kill_switch";
      break;
    }
    const task = await claimNext(db, worker);
    if (!task) break;
    if (task.agent && disabled.has(task.agent)) {
      await cancelTask(db, task.id, "Agente pausado por el administrador o el auditor");
      report.processed.push({ id: task.id, type: task.type, agent: task.agent, outcome: "cancelled" });
      continue;
    }
    try {
      const result = await execute(db, task);
      await completeTask(db, task.id, result);
      report.processed.push({ id: task.id, type: task.type, agent: task.agent, outcome: "succeeded" });
    } catch (err) {
      const outcome = await failTask(db, task, (err as Error).message);
      report.processed.push({ id: task.id, type: task.type, agent: task.agent, outcome });
    }
    const automation = (task.payload as { automation?: string }).automation;
    if (automation) {
      const last = report.processed[report.processed.length - 1]!;
      await db.query("UPDATE automations SET last_run_at = now(), last_status = $2 WHERE key = $1", [automation, last.outcome]);
    }
  }
  return report;
}

/** Ejecución manual desde el panel ("ejecutar ahora"). */
export async function runAgentNow(db: Db, agent: string, requestedBy: string): Promise<string | null> {
  if (!AGENTS[agent]) throw new Error("Agente desconocido");
  const r = await enqueue(db, { type: "agent.run", agent, priority: 10, idempotencyKey: `manual:${agent}:${Math.floor(Date.now() / 60_000)}`, payload: { requestedBy } });
  return r.id;
}
