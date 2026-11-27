import type { Db, Queryable } from "../db";
import type { Actor } from "../permissions";

export interface AgentDefinition {
  id: string; name: string; mission: string; objectives: string[];
  allowedActions: string[]; limits: string[]; tasks: string[];
}
export interface AgentContext {
  db: Db;
  actor: Actor;
  agentId: string;
  now: Date;
  /** Lanza si la acción no está autorizada para este agente (y la registra en auditoría). */
  require(action: string, target?: string, tx?: Queryable): Promise<void>;
  /** Ejecuta otra tarea de agente a través del orquestador (con su propio registro). */
  delegate(agentId: string, task: string, input?: Record<string, unknown>): Promise<unknown>;
}
export type TaskHandler = (ctx: AgentContext, input: Record<string, unknown>) => Promise<unknown>;
export type AgentHandlers = Record<string, TaskHandler>;
