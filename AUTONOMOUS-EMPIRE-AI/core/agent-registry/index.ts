/** Registro de agentes: definición (agent.json) + manejadores (handler.ts). Importación estática para empaquetado. */
import type { AgentDefinition, AgentHandlers } from "./types";
import type { Queryable } from "../db";

import ceoDef from "../../agents/empire-ceo/agent.json";
import miDef from "../../agents/market-intelligence/agent.json";
import pmDef from "../../agents/product-manager/agent.json";
import cfDef from "../../agents/content-factory/agent.json";
import gmDef from "../../agents/growth-manager/agent.json";
import csDef from "../../agents/customer-success/agent.json";
import fcDef from "../../agents/finance-controller/agent.json";
import rcDef from "../../agents/risk-compliance/agent.json";
import enDef from "../../agents/engineering/agent.json";

import { handlers as ceo } from "../../agents/empire-ceo/handler";
import { handlers as mi } from "../../agents/market-intelligence/handler";
import { handlers as pm } from "../../agents/product-manager/handler";
import { handlers as cf } from "../../agents/content-factory/handler";
import { handlers as gm } from "../../agents/growth-manager/handler";
import { handlers as cs } from "../../agents/customer-success/handler";
import { handlers as fc } from "../../agents/finance-controller/handler";
import { handlers as rc } from "../../agents/risk-compliance/handler";
import { handlers as en } from "../../agents/engineering/handler";

export interface RegisteredAgent { def: AgentDefinition; handlers: AgentHandlers }

const list: RegisteredAgent[] = [
  { def: ceoDef, handlers: ceo }, { def: miDef, handlers: mi }, { def: pmDef, handlers: pm },
  { def: cfDef, handlers: cf }, { def: gmDef, handlers: gm }, { def: csDef, handlers: cs },
  { def: fcDef, handlers: fc }, { def: rcDef, handlers: rc }, { def: enDef, handlers: en },
];

export const AGENTS: ReadonlyMap<string, RegisteredAgent> = new Map(list.map((a) => [a.def.id, a]));

export function getAgent(id: string): RegisteredAgent {
  const a = AGENTS.get(id);
  if (!a) throw new Error(`Agente desconocido: ${id}`);
  return a;
}

/** Valida coherencia (cada tarea declarada tiene manejador y viceversa) y sincroniza la tabla agents. */
export function validateRegistry(): string[] {
  const problems: string[] = [];
  for (const { def, handlers } of AGENTS.values()) {
    for (const t of def.tasks) if (!handlers[t]) problems.push(`${def.id}: tarea ${t} sin manejador`);
    for (const t of Object.keys(handlers)) if (!def.tasks.includes(t)) problems.push(`${def.id}: manejador ${t} no declarado`);
  }
  return problems;
}

export async function syncAgents(q: Queryable) {
  for (const { def } of AGENTS.values()) {
    await q.query(
      `insert into agents(id, name, allowed_actions) values ($1,$2,$3)
       on conflict (id) do update set name=excluded.name, allowed_actions=excluded.allowed_actions, updated_at=now()`,
      [def.id, def.name, JSON.stringify(def.allowedActions)],
    );
  }
}
