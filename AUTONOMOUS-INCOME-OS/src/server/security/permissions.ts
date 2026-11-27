import policy from "@root/security/permissions/policy.json";

export type ActionMode = "auto" | "approval" | "forbidden";
export type Decision = "allow" | "approval" | "deny";

interface Policy {
  version: number;
  actions: Record<string, { mode: ActionMode; description: string }>;
  agents: Record<string, string[]>;
}

// Copia congelada: el código no puede modificar la política en memoria.
const POLICY: Readonly<Policy> = deepFreeze(structuredClone(policy) as Policy);

function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === "object") {
    for (const v of Object.values(obj as Record<string, unknown>)) deepFreeze(v);
    Object.freeze(obj);
  }
  return obj;
}

export function knownAgents(): string[] {
  return Object.keys(POLICY.agents);
}

export function actionInfo(action: string) {
  return POLICY.actions[action];
}

/**
 * Decide si un agente puede ejecutar una acción.
 * - Acción desconocida o no asignada al agente: deny (mínimo privilegio).
 * - Acción "forbidden": deny para todos los agentes.
 * - Acción "approval": se crea una solicitud para el administrador.
 */
export function decide(agent: string, action: string): { decision: Decision; reason: string } {
  const info = POLICY.actions[action];
  if (!info) return { decision: "deny", reason: `Acción desconocida: ${action}` };
  if (info.mode === "forbidden") return { decision: "deny", reason: `Acción prohibida para agentes: ${action}` };
  const allowed = POLICY.agents[agent];
  if (!allowed) return { decision: "deny", reason: `Agente desconocido: ${agent}` };
  if (!allowed.includes(action)) return { decision: "deny", reason: `El agente ${agent} no tiene permiso para ${action}` };
  return info.mode === "approval"
    ? { decision: "approval", reason: `${action} requiere aprobación humana` }
    : { decision: "allow", reason: "Permitido por la política" };
}

export function policySnapshot(): Readonly<Policy> {
  return POLICY;
}
