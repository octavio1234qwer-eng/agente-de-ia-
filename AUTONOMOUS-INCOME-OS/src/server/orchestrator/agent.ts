import { audit } from "../audit.ts";
import type { Db } from "../db/types.ts";
import { createApproval } from "../approvals.ts";
import { decide } from "../security/permissions.ts";
import { enqueue, MAX_DEPTH } from "./queue.ts";

export interface ActionRecord {
  action: string;
  decision: "allow" | "approval" | "deny";
  summary: string;
  approvalId?: string;
  error?: string;
}

export type PerformResult<T> =
  | { status: "done"; result: T }
  | { status: "approval_requested"; approvalId: string }
  | { status: "denied"; reason: string };

export interface AgentContext {
  readonly db: Db;
  readonly agent: string;
  readonly taskId: string | null;
  readonly depth: number;
  readonly now: Date;
  /**
   * Única puerta para actuar. Consulta la política (no la puede cambiar el agente):
   * permitido → ejecuta `fn`; requiere aprobación → crea la solicitud; no permitido → bloquea y lo registra.
   */
  perform<T>(
    action: string,
    meta: { summary: string; approval?: { title: string; payload?: Record<string, unknown>; risk?: "low" | "medium" | "high" | "critical"; dedupeKey?: string } },
    fn?: () => Promise<T>,
  ): Promise<PerformResult<T>>;
  /** Encola una subtarea (profundidad máxima 3). */
  enqueueChild(type: string, agent: string | null, payload: Record<string, unknown>, idempotencyKey: string): Promise<void>;
  readonly actions: ActionRecord[];
}

export interface AgentOutput {
  summary: string;
  data?: Record<string, unknown>;
}

export interface AgentDefinition {
  name: string;
  title: string;
  mission: string;
  run(ctx: AgentContext): Promise<AgentOutput>;
}

export function createAgentContext(db: Db, agent: string, taskId: string | null, depth: number): AgentContext {
  const actions: ActionRecord[] = [];
  const ctx: AgentContext = {
    db,
    agent,
    taskId,
    depth,
    now: new Date(),
    actions,
    async perform(action, meta, fn) {
      const { decision, reason } = decide(agent, action);
      if (decision === "deny") {
        actions.push({ action, decision, summary: meta.summary, error: reason });
        await db.tx((q) => audit(q, { actorType: "agent", actorId: agent, action: "agent.action_denied", severity: "warning", metadata: { action, reason } }));
        return { status: "denied", reason };
      }
      if (decision === "approval") {
        const a = meta.approval ?? { title: meta.summary };
        const approvalId = await db.tx(async (q) => {
          const id = await createApproval(q, {
            kind: action, title: a.title, summary: meta.summary, payload: a.payload, risk: a.risk ?? "medium",
            requestedBy: `agent:${agent}`, dedupeKey: a.dedupeKey,
          });
          await audit(q, { actorType: "agent", actorId: agent, action: "agent.approval_requested", targetType: "approval", targetId: id, metadata: { action } });
          return id;
        });
        actions.push({ action, decision, summary: meta.summary, approvalId });
        return { status: "approval_requested", approvalId };
      }
      try {
        const result = fn ? await fn() : (undefined as never);
        actions.push({ action, decision, summary: meta.summary });
        return { status: "done", result };
      } catch (err) {
        actions.push({ action, decision, summary: meta.summary, error: (err as Error).message });
        throw err;
      }
    },
    async enqueueChild(type, childAgent, payload, idempotencyKey) {
      if (depth + 1 > MAX_DEPTH) throw new Error("Profundidad máxima de subtareas alcanzada");
      const r = await ctx.perform("task.enqueue", { summary: `Encolar ${type}` }, () =>
        enqueue(db, { type, agent: childAgent, payload, idempotencyKey, depth: depth + 1, parentTaskId: taskId }),
      );
      if (r.status === "denied") throw new Error(r.reason);
    },
  };
  return ctx;
}

/** Ejecuta un agente y deja registro completo en agent_runs. */
export async function runAgent(db: Db, def: AgentDefinition, opts: { taskId?: string | null; depth?: number } = {}): Promise<{ runId: string; output: AgentOutput }> {
  const run = await db.query<{ id: string }>("INSERT INTO agent_runs (agent, task_id, status) VALUES ($1, $2, 'running') RETURNING id", [def.name, opts.taskId ?? null]);
  const runId = run.rows[0]!.id;
  const ctx = createAgentContext(db, def.name, opts.taskId ?? null, opts.depth ?? 0);
  try {
    const output = await def.run(ctx);
    await db.query(
      "UPDATE agent_runs SET status = 'succeeded', summary = $2, output = $3, actions = $4, finished_at = now() WHERE id = $1",
      [runId, output.summary.slice(0, 2000), JSON.stringify(output.data ?? {}), JSON.stringify(ctx.actions)],
    );
    return { runId, output };
  } catch (err) {
    await db.query(
      "UPDATE agent_runs SET status = 'failed', error = $2, actions = $3, finished_at = now() WHERE id = $1",
      [runId, (err as Error).message.slice(0, 2000), JSON.stringify(ctx.actions)],
    );
    throw err;
  }
}
