import type { Db, Queryable } from "../db/types.ts";
import { notifyAdmin } from "../notifications.ts";

export const MAX_DEPTH = 3;

export interface TaskInput {
  type: string;
  agent?: string | null;
  payload?: Record<string, unknown>;
  idempotencyKey?: string;
  priority?: number;
  runAfter?: Date;
  maxAttempts?: number;
  depth?: number;
  parentTaskId?: string | null;
}

export interface TaskRow {
  id: string;
  type: string;
  agent: string | null;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  depth: number;
}

/** Encola una tarea. Con la misma clave de idempotencia no se duplica. */
export async function enqueue(q: Queryable, t: TaskInput): Promise<{ id: string | null; created: boolean }> {
  const depth = t.depth ?? 0;
  if (depth > MAX_DEPTH) throw new Error(`Profundidad máxima (${MAX_DEPTH}) superada: se evita un ciclo de agentes.`);
  const { rows } = await q.query<{ id: string }>(
    `INSERT INTO tasks (type, agent, payload, idempotency_key, priority, run_after, max_attempts, depth, parent_task_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
    [t.type, t.agent ?? null, JSON.stringify(t.payload ?? {}), t.idempotencyKey ?? null, t.priority ?? 100,
     (t.runAfter ?? new Date()).toISOString(), t.maxAttempts ?? 3, depth, t.parentTaskId ?? null],
  );
  return { id: rows[0]?.id ?? null, created: rows.length > 0 };
}

/** Toma la siguiente tarea lista. SKIP LOCKED permite varios procesos sin tomar la misma. */
export async function claimNext(db: Db, worker: string): Promise<TaskRow | null> {
  const { rows } = await db.query<TaskRow>(
    `UPDATE tasks SET status = 'running', locked_at = now(), locked_by = $1, attempts = attempts + 1, started_at = now()
     WHERE id = (SELECT id FROM tasks WHERE status = 'queued' AND run_after <= now()
                 ORDER BY priority, run_after LIMIT 1 FOR UPDATE SKIP LOCKED)
     RETURNING id, type, agent, payload, attempts, max_attempts, depth`,
    [worker],
  );
  return rows[0] ?? null;
}

export async function completeTask(db: Db, id: string, result: unknown): Promise<void> {
  await db.query("UPDATE tasks SET status = 'succeeded', finished_at = now(), locked_at = NULL, result = $2, last_error = NULL WHERE id = $1", [id, JSON.stringify(result ?? null)]);
}

/** Reintento con espera exponencial (2, 4, 8… min). Al agotar intentos queda 'dead' y se avisa. */
export async function failTask(db: Db, task: TaskRow, error: string): Promise<"retry" | "dead"> {
  if (task.attempts >= task.max_attempts) {
    await db.tx(async (q) => {
      await q.query("UPDATE tasks SET status = 'dead', finished_at = now(), locked_at = NULL, last_error = $2 WHERE id = $1", [task.id, error.slice(0, 1000)]);
      await notifyAdmin(q, {
        subject: `Tarea fallida: ${task.type}${task.agent ? ` (${task.agent})` : ""}`,
        body: `Agotó ${task.max_attempts} intentos. Último error: ${error.slice(0, 500)}`,
        severity: "warning",
        dedupeKey: `task-dead:${task.id}`,
        relatedType: "task",
        relatedId: task.id,
      });
    });
    return "dead";
  }
  const backoffMin = 2 ** task.attempts;
  await db.query(
    "UPDATE tasks SET status = 'queued', locked_at = NULL, locked_by = NULL, last_error = $2, run_after = now() + make_interval(mins => $3::int) WHERE id = $1",
    [task.id, error.slice(0, 1000), backoffMin],
  );
  return "retry";
}

export async function cancelTask(db: Db, id: string, reason: string): Promise<void> {
  await db.query("UPDATE tasks SET status = 'cancelled', finished_at = now(), locked_at = NULL, last_error = $2 WHERE id = $1", [id, reason]);
}

/** Recuperación: tareas que quedaron 'running' por un proceso caído vuelven a la cola. */
export async function recoverStaleTasks(db: Db, olderThanMinutes = 10): Promise<number> {
  const r = await db.query(
    `UPDATE tasks SET status = CASE WHEN attempts >= max_attempts THEN 'dead' ELSE 'queued' END,
       locked_at = NULL, locked_by = NULL, last_error = 'Recuperada: el proceso se detuvo a mitad de la ejecución'
     WHERE status = 'running' AND locked_at < now() - make_interval(mins => $1::int)`,
    [olderThanMinutes],
  );
  return r.rowCount;
}
