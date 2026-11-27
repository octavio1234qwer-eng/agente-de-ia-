/** Orquestador: ejecuta tareas de agentes con permisos, idempotencia, reintentos y auditoría. */
import type { Db, Queryable } from "../db";
import { appendAudit } from "../audit-log";
import { authorize, type Actor } from "../permissions";
import { getAgent, syncAgents } from "../agent-registry";
import type { AgentContext } from "../agent-registry/types";

export class PermissionDeniedError extends Error {
  constructor(public action: string, public reason: string) { super(`Acción ${action} denegada: ${reason}`); }
}

export interface RunOptions { idempotencyKey?: string; parentDepth?: number; now?: Date }

let synced = new WeakSet<Db>();

export async function runAgentTask(
  db: Db, agentId: string, taskType: string, input: Record<string, unknown> = {}, opts: RunOptions = {},
): Promise<{ taskId: string; status: string; output?: unknown; error?: string; reused?: boolean }> {
  if (!synced.has(db)) { await syncAgents(db); synced.add(db); }
  const { def, handlers } = getAgent(agentId);
  const handler = handlers[taskType];
  if (!handler) throw new Error(`El agente ${agentId} no tiene la tarea ${taskType}`);
  if ((opts.parentDepth ?? 0) > 3) throw new Error("Profundidad de delegación excedida");

  const st = await db.query<{ status: string }>("select status from agents where id=$1", [agentId]);
  if (st.rows[0]?.status === "disabled") return { taskId: "", status: "blocked", error: "agente deshabilitado" };

  // Idempotencia: si ya existe la tarea con esa clave y terminó bien, devolverla.
  if (opts.idempotencyKey) {
    const ex = await db.query<{ id: string; status: string; output: unknown }>(
      "select id, status, output from tasks where idempotency_key=$1", [opts.idempotencyKey],
    );
    const row = ex.rows[0];
    if (row && (row.status === "succeeded" || row.status === "running"))
      return { taskId: row.id, status: row.status, output: row.output, reused: true };
    if (row) await db.query("delete from tasks where id=$1 and status in ('failed','blocked')", [row.id]);
  }

  const ins = await db.query<{ id: string }>(
    `insert into tasks(agent_id, type, status, input, idempotency_key, attempts, started_at)
     values ($1,$2,'running',$3,$4,1,now()) returning id`,
    [agentId, taskType, JSON.stringify(input), opts.idempotencyKey ?? null],
  );
  const taskId = ins.rows[0]!.id;
  await db.query("update agents set status='running', last_run_at=now() where id=$1", [agentId]);

  const actor: Actor = { id: `agent:${agentId}`, role: "agent", allowedActions: def.allowedActions };
  const ctx: AgentContext = {
    db, actor, agentId, now: opts.now ?? new Date(),
    async require(action, target, tx?: Queryable) {
      const run = async (q: Queryable) => {
        const d = await authorize(q, actor, action, { target });
        if (!d.allowed) throw new PermissionDeniedError(action, d.reason);
      };
      if (tx) await run(tx); else await db.transaction(run);
    },
    async delegate(otherId, task, inp = {}) {
      const r = await runAgentTask(db, otherId, task, inp, { ...opts, idempotencyKey: opts.idempotencyKey ? `${opts.idempotencyKey}>${otherId}.${task}` : undefined, parentDepth: (opts.parentDepth ?? 0) + 1 });
      if (r.status === "failed" || r.status === "blocked") throw new Error(`${otherId}.${task}: ${r.error}`);
      return r.output;
    },
  };

  try {
    const output = await handler(ctx, input);
    await db.query("update tasks set status='succeeded', output=$2, finished_at=now() where id=$1", [taskId, JSON.stringify(output ?? null)]);
    await db.query("update agents set status='idle' where id=$1", [agentId]);
    await db.transaction((tx) => appendAudit(tx, { actor: actor.id, action: `task:${taskType}`, level: "green", target: taskId, result: "succeeded" }));
    return { taskId, status: "succeeded", output };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    const status = e instanceof PermissionDeniedError ? "blocked" : "failed";
    await db.query("update tasks set status=$2, error=$3, finished_at=now() where id=$1", [taskId, status, error]);
    await db.query("update agents set status=$2 where id=$1", [agentId, status === "failed" ? "error" : "idle"]);
    await db.transaction((tx) => appendAudit(tx, { actor: actor.id, action: `task:${taskType}`, level: status === "blocked" ? "blocked" : "system", target: taskId, result: status, detail: { error } }));
    return { taskId, status, error };
  }
}

export function resetSyncCache() { synced = new WeakSet(); }
