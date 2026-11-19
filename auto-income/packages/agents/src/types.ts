import type { DB } from '../../database/src/index.ts';
import type { RiskClass } from '../../core/src/autonomy.ts';

export const TASK_STATUSES = ['PENDING', 'QUEUED', 'RUNNING', 'WAITING_APPROVAL', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const ACTIVE_STATUSES: readonly TaskStatus[] = ['PENDING', 'QUEUED', 'RUNNING', 'WAITING_APPROVAL'];
export const FINAL_STATUSES: readonly TaskStatus[] = ['COMPLETED', 'FAILED', 'CANCELLED'];

export type AgentId =
  | 'ceo'
  | 'market_research'
  | 'product_creation'
  | 'software_engineering'
  | 'seo'
  | 'marketing'
  | 'sales'
  | 'customer_support'
  | 'financial'
  | 'qa_security';

export interface Task {
  id: string;
  businessId: string | null;
  agentId: AgentId;
  type: string;
  objective: string;
  input: Record<string, unknown>;
  priority: number;
  status: TaskStatus;
  risk: RiskClass;
  dependsOn: string[];
  idempotencyKey: string | null;
  attempts: number;
  maxAttempts: number;
  approvalReason: string | null;
  approvedBy: string | null;
  result: unknown;
  error: string | null;
  estimatedCostCents: number;
  actualCostCents: number | null;
  parentTaskId: string | null;
  createdBy: string;
  createdAt: string;
  runAfter: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface EnqueueSpec {
  agentId: AgentId;
  type: string;
  objective?: string;
  input?: Record<string, unknown>;
  businessId?: string | null;
  priority?: number;
  dependsOn?: string[];
  idempotencyKey?: string;
  createdBy?: string;
  parentTaskId?: string;
}

export interface KnowledgeEntry {
  id: string;
  businessId: string | null;
  kind: string;
  title: string;
  body: string;
  tags: string[];
}

export interface TaskContext {
  db: DB;
  task: Task;
  input: Record<string, unknown>;
  businessId: string | null;
  now: () => Date;
  log: (message: string) => void;
  /** Crea subtareas (pasan por la misma política de autonomía). */
  enqueue: (spec: EnqueueSpec) => Task;
  knowledge: {
    search: (query: string, kinds?: string[]) => KnowledgeEntry[];
    add: (entry: { kind: string; title: string; body: string; tags?: string[] }) => string;
  };
  env: Record<string, string | undefined>;
  signal: AbortSignal;
}

export interface TaskHandler {
  description: string;
  risk: RiskClass;
  /** true si repetir la tarea tras una interrupción no causa efectos dañinos/duplicados. */
  idempotent: boolean;
  estimatedCostCents?: number;
  run: (ctx: TaskContext) => unknown | Promise<unknown>;
}

export interface AgentDefinition {
  id: AgentId;
  name: string;
  objective: string;
  instructions: string[];
  tools: string[];
  limits: { maxTasksPerHour: number; maxAttempts: number; timeoutMs: number };
  /** Lo que el agente nunca puede hacer (documentado y aplicado por la política de riesgo). */
  forbidden: string[];
  handlers: Record<string, TaskHandler>;
}
