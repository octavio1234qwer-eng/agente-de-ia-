/** Mapa de rutinas: nombre → periodo y acción. Documentado en AUTOMATION_MAP.md. */
import type { Db } from "../core/db";
import { runAgentTask } from "../core/orchestrator";
import { periodKey, runJob, type JobResult } from "../core/scheduler";
import { seed } from "../infrastructure/database/seed";
import { syncGumroad } from "../businesses/digital-products/sync";
import { sendApprovedEmails } from "../infrastructure/integrations/email";

type Kind = "hourly" | "daily" | "weekly" | "monthly";
export interface Routine { kind: Kind; description: string; run: (db: Db, period: string) => Promise<unknown> }

const agentRoutine = (agent: string, task: string, input?: Record<string, unknown>) => async (db: Db, period: string) => {
  const r = await runAgentTask(db, agent, task, input, { idempotencyKey: `${agent}.${task}@${period}` });
  if (r.status !== "succeeded") throw new Error(r.error ?? r.status);
  return r.output;
};

export const ROUTINES: Record<string, Routine> = {
  "hourly.gumroad-sync": { kind: "hourly", description: "Conciliar ventas de Gumroad con el libro", run: async (db) => (process.env.GUMROAD_ACCESS_TOKEN || process.env.GUMROAD_VIA_PROXY) ? syncGumroad(db) : { skipped: "GUMROAD_ACCESS_TOKEN no configurado" } },
  "hourly.email-outbox": { kind: "hourly", description: "Enviar correos aprobados (con consentimiento y tope diario)", run: (db) => sendApprovedEmails(db) },
  "daily.ceo-cycle": { kind: "daily", description: "Ciclo diario del EMPIRE CEO (salud, leads, contenido, cumplimiento, finanzas, embudo, validación, informe)", run: agentRoutine("empire-ceo", "daily_cycle") },
  "weekly.ceo-cycle": { kind: "weekly", description: "Rentabilidad, comparación entre unidades, enlaces, oportunidades e informe semanal", run: agentRoutine("empire-ceo", "weekly_cycle") },
  "monthly.ceo-cycle": { kind: "monthly", description: "Evaluación estratégica mensual", run: agentRoutine("empire-ceo", "monthly_cycle") },
};

export async function runRoutine(db: Db, name: string, opts: { force?: boolean; now?: Date } = {}): Promise<JobResult> {
  const r = ROUTINES[name];
  if (!r) throw new Error(`Rutina desconocida: ${name}. Disponibles: ${Object.keys(ROUTINES).join(", ")}`);
  await seed(db);
  const period = periodKey(r.kind, opts.now);
  return runJob(db, name, period, () => r.run(db, period), { force: opts.force, timeoutMs: 240_000 });
}

export const routinesOfKind = (k: Kind) => Object.keys(ROUTINES).filter((n) => ROUTINES[n]!.kind === k);
