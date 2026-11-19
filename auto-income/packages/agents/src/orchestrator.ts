/**
 * Orquestador de tareas persistente (SQLite).
 *
 * - Cola con prioridades (mayor primero), dependencias y run_after (backoff).
 * - Estados: PENDING → QUEUED → RUNNING → COMPLETED | FAILED; WAITING_APPROVAL; CANCELLED.
 * - Idempotencia: idempotency_key única + detección de duplicados activos con la misma entrada.
 * - Reintentos con backoff exponencial hasta max_attempts.
 * - Límite de ejecuciones por agente y hora; timeout por tarea.
 * - Recuperación: tareas RUNNING con lease vencido se reencolan solo si su handler es idempotente;
 *   si no, pasan a WAITING_APPROVAL para que una persona decida (nunca se repite una operación peligrosa).
 * - Política de autonomía aplicada en cada encolado según el nivel del negocio.
 */
import { randomUUID } from 'node:crypto';
import { all, get, run, transaction, parseJson, notify, audit, type DB } from '../../database/src/index.ts';
import { decideAutonomy, DEFAULT_AUTONOMY_LEVEL, type AutonomyLevel, type RiskClass } from '../../core/src/autonomy.ts';
import type { AgentDefinition, AgentId, EnqueueSpec, KnowledgeEntry, Task, TaskContext, TaskStatus } from './types.ts';

export interface OrchestratorOptions {
  clock?: () => number;
  env?: Record<string, string | undefined>;
  baseBackoffMs?: number;
  maxResultBytes?: number;
}

type TaskRow = Record<string, unknown>;

function rowToTask(r: TaskRow): Task {
  return {
    id: r.id as string,
    businessId: (r.business_id as string | null) ?? null,
    agentId: r.agent_id as AgentId,
    type: r.type as string,
    objective: r.objective as string,
    input: parseJson(r.input, {}),
    priority: r.priority as number,
    status: r.status as TaskStatus,
    risk: r.risk as RiskClass,
    dependsOn: parseJson(r.depends_on, []),
    idempotencyKey: (r.idempotency_key as string | null) ?? null,
    attempts: r.attempts as number,
    maxAttempts: r.max_attempts as number,
    approvalReason: (r.approval_reason as string | null) ?? null,
    approvedBy: (r.approved_by as string | null) ?? null,
    result: parseJson(r.result, null),
    error: (r.error as string | null) ?? null,
    estimatedCostCents: r.estimated_cost_cents as number,
    actualCostCents: (r.actual_cost_cents as number | null) ?? null,
    parentTaskId: (r.parent_task_id as string | null) ?? null,
    createdBy: r.created_by as string,
    createdAt: r.created_at as string,
    runAfter: r.run_after as string,
    startedAt: (r.started_at as string | null) ?? null,
    finishedAt: (r.finished_at as string | null) ?? null,
  };
}

export class TaskError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export class Orchestrator {
  readonly db: DB;
  readonly agents: Map<AgentId, AgentDefinition>;
  private clock: () => number;
  private env: Record<string, string | undefined>;
  private baseBackoffMs: number;
  private maxResultBytes: number;
  private ticking = false;

  constructor(db: DB, agents: AgentDefinition[], opts: OrchestratorOptions = {}) {
    this.db = db;
    this.agents = new Map(agents.map((a) => [a.id, a]));
    this.clock = opts.clock ?? Date.now;
    this.env = opts.env ?? {};
    this.baseBackoffMs = opts.baseBackoffMs ?? 30_000;
    this.maxResultBytes = opts.maxResultBytes ?? 200_000;
  }

  private iso(offsetMs = 0): string {
    return new Date(this.clock() + offsetMs).toISOString();
  }

  private event(taskId: string, from: TaskStatus | null, to: TaskStatus, message: string, actor = 'system'): void {
    run(this.db, 'INSERT INTO task_events (task_id, from_status, to_status, message, actor, created_at) VALUES (?, ?, ?, ?, ?, ?)', taskId, from, to, message, actor, this.iso());
  }

  private setStatus(task: Task, to: TaskStatus, message: string, actor = 'system', extra: Record<string, string | number | null> = {}): void {
    const cols = Object.keys(extra);
    const sets = ['status = ?', ...cols.map((c) => `${c} = ?`)].join(', ');
    run(this.db, `UPDATE tasks SET ${sets} WHERE id = ?`, to, ...cols.map((c) => extra[c]), task.id);
    this.event(task.id, task.status, to, message, actor);
    task.status = to;
  }

  getTask(id: string): Task | undefined {
    const r = get<TaskRow>(this.db, 'SELECT * FROM tasks WHERE id = ?', id);
    return r ? rowToTask(r) : undefined;
  }

  listTasks(filter: { businessId?: string; status?: TaskStatus; agentId?: string; limit?: number } = {}): Task[] {
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (filter.businessId) { where.push('business_id = ?'); params.push(filter.businessId); }
    if (filter.status) { where.push('status = ?'); params.push(filter.status); }
    if (filter.agentId) { where.push('agent_id = ?'); params.push(filter.agentId); }
    const sql = `SELECT * FROM tasks ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT ?`;
    return all<TaskRow>(this.db, sql, ...params, Math.min(filter.limit ?? 100, 500)).map(rowToTask);
  }

  taskHistory(id: string): { fromStatus: string | null; toStatus: string; message: string; actor: string; createdAt: string }[] {
    return all<TaskRow>(this.db, 'SELECT * FROM task_events WHERE task_id = ? ORDER BY id', id).map((r) => ({
      fromStatus: (r.from_status as string | null) ?? null,
      toStatus: r.to_status as string,
      message: r.message as string,
      actor: r.actor as string,
      createdAt: r.created_at as string,
    }));
  }

  private autonomyLevel(businessId: string | null): AutonomyLevel {
    if (businessId) {
      const b = get<{ autonomy_level: number }>(this.db, 'SELECT autonomy_level FROM businesses WHERE id = ?', businessId);
      if (!b) throw new TaskError('negocio no encontrado', 404);
      return b.autonomy_level as AutonomyLevel;
    }
    const lvl = Number(this.env.DEFAULT_AUTONOMY_LEVEL ?? DEFAULT_AUTONOMY_LEVEL);
    return ([0, 1, 2, 3, 4].includes(lvl) ? lvl : DEFAULT_AUTONOMY_LEVEL) as AutonomyLevel;
  }

  isAgentEnabled(agentId: string): boolean {
    const s = get<{ enabled: number }>(this.db, 'SELECT enabled FROM agent_settings WHERE agent_id = ?', agentId);
    return s ? s.enabled === 1 : true;
  }

  setAgentEnabled(agentId: AgentId, enabled: boolean, actor: string): void {
    if (!this.agents.has(agentId)) throw new TaskError('agente desconocido', 404);
    run(this.db, 'INSERT INTO agent_settings (agent_id, enabled) VALUES (?, ?) ON CONFLICT(agent_id) DO UPDATE SET enabled = excluded.enabled', agentId, enabled ? 1 : 0);
    audit(this.db, { actor, action: enabled ? 'agent.enable' : 'agent.disable', entity: 'agent', entityId: agentId });
  }

  enqueue(spec: EnqueueSpec): Task & { deduplicated?: boolean } {
    const agent = this.agents.get(spec.agentId);
    if (!agent) throw new TaskError(`agente desconocido: ${spec.agentId}`, 404);
    const handler = agent.handlers[spec.type];
    if (!handler) throw new TaskError(`el agente ${agent.name} no tiene la tarea ${spec.type}`, 400);
    if (!this.isAgentEnabled(agent.id)) throw new TaskError(`el agente ${agent.name} está desactivado`, 409);
    const businessId = spec.businessId ?? null;
    const input = spec.input ?? {};
    const inputJson = JSON.stringify(input);
    if (inputJson.length > 50_000) throw new TaskError('entrada demasiado grande');
    const priority = Math.max(0, Math.min(100, Math.round(spec.priority ?? 50)));
    const dependsOn = [...new Set(spec.dependsOn ?? [])];

    return transaction(this.db, () => {
      if (spec.idempotencyKey) {
        const existing = get<TaskRow>(this.db, 'SELECT * FROM tasks WHERE idempotency_key = ?', spec.idempotencyKey);
        if (existing) return { ...rowToTask(existing), deduplicated: true };
      }
      // Prevención de duplicados: misma tarea activa con la misma entrada.
      const dup = get<TaskRow>(
        this.db,
        `SELECT * FROM tasks WHERE agent_id = ? AND type = ? AND IFNULL(business_id,'') = ? AND input = ? AND status IN ('PENDING','QUEUED','RUNNING','WAITING_APPROVAL') LIMIT 1`,
        agent.id, spec.type, businessId ?? '', inputJson,
      );
      if (dup) return { ...rowToTask(dup), deduplicated: true };

      for (const dep of dependsOn) {
        if (!get(this.db, 'SELECT id FROM tasks WHERE id = ?', dep)) throw new TaskError(`dependencia inexistente: ${dep}`);
      }

      const level = this.autonomyLevel(businessId);
      const decision = decideAutonomy(level, handler.risk);
      let status: TaskStatus;
      let approvalReason: string | null = null;
      if (decision === 'require_approval') {
        status = 'WAITING_APPROVAL';
        approvalReason = `Riesgo "${handler.risk}" con autonomía nivel ${level}: requiere aprobación del propietario.`;
      } else {
        status = dependsOn.length ? 'PENDING' : 'QUEUED';
      }
      const id = `tsk_${randomUUID().replace(/-/g, '')}`;
      const now = this.iso();
      run(
        this.db,
        `INSERT INTO tasks (id, business_id, agent_id, type, objective, input, priority, status, risk, depends_on, idempotency_key,
          attempts, max_attempts, approval_reason, estimated_cost_cents, parent_task_id, created_by, created_at, run_after)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`,
        id, businessId, agent.id, spec.type, spec.objective ?? handler.description, inputJson, priority, status, handler.risk,
        JSON.stringify(dependsOn), spec.idempotencyKey ?? null, agent.limits.maxAttempts, approvalReason,
        handler.estimatedCostCents ?? 0, spec.parentTaskId ?? null, spec.createdBy ?? 'system', now, now,
      );
      this.event(id, null, status, approvalReason ?? 'tarea creada', spec.createdBy ?? 'system');
      if (status === 'WAITING_APPROVAL') {
        notify(this.db, { businessId, level: 'approval', title: `Aprobación requerida: ${spec.objective ?? handler.description}`, body: approvalReason ?? '', link: `/tasks/${id}` });
      }
      return this.getTask(id)!;
    });
  }

  approve(id: string, actor: string): Task {
    const task = this.getTask(id);
    if (!task) throw new TaskError('tarea no encontrada', 404);
    if (task.status !== 'WAITING_APPROVAL') throw new TaskError(`solo se aprueban tareas en espera (estado actual ${task.status})`, 409);
    const next: TaskStatus = task.dependsOn.length ? 'PENDING' : 'QUEUED';
    this.setStatus(task, next, 'aprobada', actor, { approved_by: actor, run_after: this.iso() });
    audit(this.db, { actor, action: 'task.approve', entity: 'task', entityId: id, businessId: task.businessId });
    return task;
  }

  cancel(id: string, actor: string, reason = 'cancelada'): Task {
    const task = this.getTask(id);
    if (!task) throw new TaskError('tarea no encontrada', 404);
    if (task.status === 'RUNNING') throw new TaskError('la tarea está en ejecución; espera a que termine o expire', 409);
    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(task.status)) throw new TaskError(`la tarea ya terminó (${task.status})`, 409);
    this.setStatus(task, 'CANCELLED', reason, actor, { finished_at: this.iso() });
    audit(this.db, { actor, action: 'task.cancel', entity: 'task', entityId: id, businessId: task.businessId, details: { reason } });
    return task;
  }

  retry(id: string, actor: string): Task {
    const task = this.getTask(id);
    if (!task) throw new TaskError('tarea no encontrada', 404);
    if (task.status !== 'FAILED') throw new TaskError('solo se reintentan tareas fallidas', 409);
    this.setStatus(task, 'QUEUED', 'reintento manual', actor, { attempts: 0, error: null, run_after: this.iso(), finished_at: null });
    return task;
  }

  /** Promueve PENDING→QUEUED cuando sus dependencias terminaron; cancela si una dependencia falló. */
  resolveDependencies(): number {
    let changed = 0;
    for (const r of all<TaskRow>(this.db, "SELECT * FROM tasks WHERE status = 'PENDING'")) {
      const task = rowToTask(r);
      const deps = task.dependsOn.map((d) => get<{ status: string }>(this.db, 'SELECT status FROM tasks WHERE id = ?', d)?.status ?? 'CANCELLED');
      if (deps.some((s) => s === 'FAILED' || s === 'CANCELLED')) {
        this.setStatus(task, 'CANCELLED', 'una dependencia falló o fue cancelada', 'system', { finished_at: this.iso() });
        changed++;
      } else if (deps.every((s) => s === 'COMPLETED')) {
        this.setStatus(task, 'QUEUED', 'dependencias completadas', 'system', { run_after: this.iso() });
        changed++;
      }
    }
    return changed;
  }

  /** Recupera tareas interrumpidas (lease vencido). */
  recover(): number {
    let changed = 0;
    for (const r of all<TaskRow>(this.db, "SELECT * FROM tasks WHERE status = 'RUNNING' AND lease_until < ?", this.iso())) {
      const task = rowToTask(r);
      const handler = this.agents.get(task.agentId)?.handlers[task.type];
      if (handler?.idempotent && task.attempts < task.maxAttempts) {
        this.setStatus(task, 'QUEUED', 'recuperada tras interrupción (operación idempotente)', 'system', { lease_until: null, run_after: this.iso() });
      } else {
        this.setStatus(task, 'WAITING_APPROVAL', 'interrumpida: requiere revisión humana para no repetir una operación no idempotente', 'system', {
          lease_until: null,
          approval_reason: 'La tarea se interrumpió durante su ejecución. Revisa si se completó antes de aprobar un nuevo intento.',
        });
        notify(this.db, { businessId: task.businessId, level: 'warning', title: `Tarea interrumpida: ${task.objective}`, link: `/tasks/${task.id}` });
      }
      changed++;
    }
    return changed;
  }

  private startedLastHour(agentId: string): number {
    const row = get<{ n: number }>(this.db, 'SELECT COUNT(*) AS n FROM task_events e JOIN tasks t ON t.id = e.task_id WHERE t.agent_id = ? AND e.to_status = ? AND e.created_at >= ?', agentId, 'RUNNING', this.iso(-3_600_000));
    return row?.n ?? 0;
  }

  private agentHourlyLimit(agent: AgentDefinition): number {
    const s = get<{ max_tasks_per_hour: number | null }>(this.db, 'SELECT max_tasks_per_hour FROM agent_settings WHERE agent_id = ?', agent.id);
    return s?.max_tasks_per_hour ?? agent.limits.maxTasksPerHour;
  }

  /** Un ciclo del motor: dependencias, recuperación y ejecución de hasta `maxTasks` tareas. */
  async tick(maxTasks = 5): Promise<{ executed: string[] }> {
    if (this.ticking) return { executed: [] };
    this.ticking = true;
    const executed: string[] = [];
    try {
      this.recover();
      this.resolveDependencies();
      const skipped = new Set<string>();
      while (executed.length < maxTasks) {
        const candidates = all<TaskRow>(
          this.db,
          "SELECT * FROM tasks WHERE status = 'QUEUED' AND run_after <= ? ORDER BY priority DESC, created_at ASC LIMIT 20",
          this.iso(),
        ).map(rowToTask).filter((t) => !skipped.has(t.id));
        const next = candidates.find((t) => {
          const agent = this.agents.get(t.agentId);
          if (!agent || !this.isAgentEnabled(agent.id)) { skipped.add(t.id); return false; }
          if (this.startedLastHour(agent.id) >= this.agentHourlyLimit(agent)) { skipped.add(t.id); return false; }
          return true;
        });
        if (!next) break;
        await this.execute(next);
        executed.push(next.id);
        this.resolveDependencies();
      }
    } finally {
      this.ticking = false;
    }
    return { executed };
  }

  private async execute(task: Task): Promise<void> {
    const agent = this.agents.get(task.agentId)!;
    const handler = agent.handlers[task.type];
    if (!handler) {
      this.setStatus(task, 'FAILED', 'handler inexistente', 'system', { error: 'handler inexistente', finished_at: this.iso() });
      return;
    }
    const claimed = run(this.db, "UPDATE tasks SET status = 'RUNNING', attempts = attempts + 1, started_at = ?, lease_until = ? WHERE id = ? AND status = 'QUEUED'", this.iso(), this.iso(agent.limits.timeoutMs + 5_000), task.id);
    if (claimed.changes === 0) return; // otro proceso la tomó
    this.event(task.id, 'QUEUED', 'RUNNING', `intento ${task.attempts + 1}`);
    task.status = 'RUNNING';
    task.attempts += 1;

    const controller = new AbortController();
    const logs: string[] = [];
    const ctx: TaskContext = {
      db: this.db,
      task,
      input: task.input,
      businessId: task.businessId,
      now: () => new Date(this.clock()),
      log: (m) => { if (logs.length < 100) logs.push(String(m).slice(0, 500)); },
      enqueue: (spec) => this.enqueue({ businessId: task.businessId, createdBy: `agent:${agent.id}`, parentTaskId: task.id, ...spec }),
      knowledge: {
        search: (q, kinds) => searchKnowledge(this.db, agent.id, task.businessId, q, kinds),
        add: (e) => addKnowledge(this.db, agent.id, task.businessId, e),
      },
      env: this.env,
      signal: controller.signal,
    };
    let timer: NodeJS.Timeout | undefined;
    try {
      const result = await Promise.race([
        Promise.resolve().then(() => handler.run(ctx)),
        new Promise((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new Error(`tiempo agotado (${agent.limits.timeoutMs} ms)`)); }, agent.limits.timeoutMs);
        }),
      ]);
      let json = JSON.stringify({ output: result ?? null, logs });
      if (json.length > this.maxResultBytes) json = JSON.stringify({ output: '[resultado truncado: excede el límite]', logs });
      this.setStatus(task, 'COMPLETED', 'completada', `agent:${agent.id}`, { result: json, error: null, finished_at: this.iso(), lease_until: null, actual_cost_cents: 0 });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (task.attempts < task.maxAttempts && !(err instanceof TaskError)) {
        const delay = this.baseBackoffMs * 2 ** (task.attempts - 1);
        this.setStatus(task, 'QUEUED', `error: ${message}; reintento en ${Math.round(delay / 1000)} s`, 'system', { error: message, run_after: this.iso(delay), lease_until: null });
      } else {
        this.setStatus(task, 'FAILED', `falló: ${message}`, 'system', { error: message, finished_at: this.iso(), lease_until: null, result: JSON.stringify({ output: null, logs }) });
        notify(this.db, { businessId: task.businessId, level: 'error', title: `Tarea fallida: ${task.objective}`, body: message, link: `/tasks/${task.id}` });
      }
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

export function searchKnowledge(db: DB, agentId: string, businessId: string | null, query: string, kinds?: string[]): KnowledgeEntry[] {
  const rows = all<TaskRow>(
    db,
    'SELECT * FROM knowledge WHERE (business_id IS NULL OR business_id = ?) ORDER BY updated_at DESC LIMIT 500',
    businessId ?? '',
  );
  const terms = tokenize(query);
  return rows
    .filter((r) => {
      const allowed = parseJson<string[]>(r.allowed_agents, ['*']);
      return allowed.includes('*') || allowed.includes(agentId);
    })
    .filter((r) => !kinds || kinds.includes(r.kind as string))
    .map((r) => {
      const hay = tokenize(`${r.title} ${r.body} ${(parseJson<string[]>(r.tags, [])).join(' ')}`);
      const score = terms.length ? terms.filter((t) => hay.includes(t)).length / terms.length : 1;
      return { r, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(({ r }) => ({
      id: r.id as string,
      businessId: (r.business_id as string | null) ?? null,
      kind: r.kind as string,
      title: r.title as string,
      body: r.body as string,
      tags: parseJson<string[]>(r.tags, []),
    }));
}

export function addKnowledge(db: DB, author: string, businessId: string | null, e: { kind: string; title: string; body: string; tags?: string[]; allowedAgents?: string[]; locked?: boolean }): string {
  const id = `kb_${randomUUID().replace(/-/g, '')}`;
  const now = new Date().toISOString();
  run(
    db,
    'INSERT INTO knowledge (id, business_id, kind, title, body, tags, allowed_agents, locked, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    id, businessId, e.kind, e.title.slice(0, 200), e.body.slice(0, 20_000), JSON.stringify(e.tags ?? []),
    JSON.stringify(e.allowedAgents ?? ['*']), e.locked ? 1 : 0, author, now, now,
  );
  return id;
}

const STOP = new Set(['de', 'la', 'el', 'los', 'las', 'un', 'una', 'y', 'o', 'que', 'en', 'para', 'por', 'con', 'mi', 'es', 'se', 'a', 'al', 'del', 'como', 'cual', 'cuál', 'qué']);
export function tokenize(text: string): string[] {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().split(/[^a-z0-9ñ]+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}
