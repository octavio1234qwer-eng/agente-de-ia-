/**
 * Política de autonomía: VERDE (autónomo), AMARILLO (con límites), ROJO (requiere autorización),
 * PROHIBIDO (siempre bloqueado). Toda decisión queda en el registro de auditoría.
 */
import type { Queryable } from "../db";
import { appendAudit } from "../audit-log";
import { budgetStatus } from "../../finance/budget";

export type Level = "green" | "yellow" | "red" | "prohibited";
export type Role = "owner" | "operator" | "viewer" | "agent" | "system" | "public";

export const ACTIONS = {
  // VERDE
  "research.run": "green",
  "analysis.run": "green",
  "draft.create": "green",
  "report.generate": "green",
  "metrics.update": "green",
  "data.organize": "green",
  "tests.run": "green",
  "content.optimize_unpublished": "green",
  "lead.capture": "green", // formulario público con consentimiento
  "lead.score": "green",
  "affiliate.click.record": "green",
  "affiliate.link.check": "green",
  "income.record_verified": "green", // solo con verificación contra la fuente (webhook/API)
  "alert.raise": "green",
  // AMARILLO
  "content.publish": "yellow",
  "email.send_commercial": "yellow",
  "campaign.update": "yellow",
  "lead.manage": "yellow",
  "config.update_reversible": "yellow",
  "affiliate.link.manage": "yellow",
  "content.approve": "yellow",
  // ROJO
  "money.spend": "red",
  "subscription.create": "red",
  "ads.buy": "red",
  "funds.withdraw": "red",
  "funds.transfer": "red",
  "bank.change": "red",
  "credentials.modify": "red",
  "data.delete_important": "red",
  "claims.publish_unverified": "red",
  "legal.accept": "red",
  "budget.change": "red",
  // PROHIBIDO
  "spam.send": "prohibited",
  "accounts.fake_create": "prohibited",
  "followers.buy": "prohibited",
  "metrics.fabricate": "prohibited",
  "content.copy_unlicensed": "prohibited",
  "data.publish_private": "prohibited",
} as const satisfies Record<string, Level>;

export type Action = keyof typeof ACTIONS;
export const levelOf = (a: Action): Level => ACTIONS[a];
export const isAction = (a: string): a is Action => a in ACTIONS;

export interface Actor {
  id: string; // "user:<uuid>", "agent:<id>", "system", "public"
  role: Role;
  /** Para agentes: lista blanca declarada en su agent.json */
  allowedActions?: readonly string[];
}

export type Decision =
  | { allowed: true; level: Level; approvalId?: string }
  | { allowed: false; level: Level; reason: string; needsApproval?: boolean };

/** Roles humanos que pueden ejecutar acciones de cada nivel (sin contar aprobación). */
const ROLE_LEVELS: Record<Role, Level[]> = {
  owner: ["green", "yellow", "red"],
  operator: ["green", "yellow"],
  viewer: ["green"],
  agent: ["green", "yellow"],
  system: ["green", "yellow"],
  public: [],
};

const PUBLIC_ACTIONS: Action[] = ["lead.capture", "affiliate.click.record"];

export async function authorize(
  q: Queryable,
  actor: Actor,
  action: string,
  opts: { approvalId?: string; target?: string; detail?: Record<string, unknown> } = {},
): Promise<Decision> {
  const record = async (d: Decision) => {
    await appendAudit(q, {
      actor: actor.id,
      action: `authorize:${action}`,
      level: d.allowed ? (d.level === "prohibited" ? "blocked" : (d.level as "green")) : "blocked",
      target: opts.target ?? null,
      result: d.allowed ? "allowed" : `denied: ${d.reason}`,
      detail: { ...(opts.detail ?? {}), approvalId: opts.approvalId ?? null },
    });
    return d;
  };

  if (!isAction(action)) return record({ allowed: false, level: "prohibited", reason: "acción desconocida" });
  const level = levelOf(action);
  if (level === "prohibited") return record({ allowed: false, level, reason: "acción prohibida por política" });

  if (actor.role === "public") {
    return PUBLIC_ACTIONS.includes(action)
      ? record({ allowed: true, level })
      : record({ allowed: false, level, reason: "no permitido para visitantes" });
  }
  if (actor.role === "agent" && !actor.allowedActions?.includes(action))
    return record({ allowed: false, level, reason: "fuera de las herramientas permitidas del agente" });

  if (level === "red") {
    if (!opts.approvalId)
      return record({ allowed: false, level, reason: "requiere autorización registrada", needsApproval: true });
    const a = await q.query<{ action: string; status: string }>(
      "select action, status from approvals where id = $1 for update",
      [opts.approvalId],
    );
    const row = a.rows[0];
    if (!row || row.action !== action || row.status !== "approved")
      return record({ allowed: false, level, reason: "autorización inexistente, de otra acción o no aprobada", needsApproval: true });
    return record({ allowed: true, level, approvalId: opts.approvalId });
  }

  if (!ROLE_LEVELS[actor.role].includes(level))
    return record({ allowed: false, level, reason: `el rol ${actor.role} no puede ejecutar acciones de nivel ${level}` });
  return record({ allowed: true, level });
}

// ── Autorizaciones (NIVEL ROJO) ────────────────────────────────────
export async function requestApproval(
  q: Queryable,
  input: { action: Action; requestedBy: string; reason: string; payload?: Record<string, unknown>; amountCents?: number },
): Promise<string> {
  if (levelOf(input.action) !== "red") throw new Error("Solo las acciones rojas requieren autorización");
  const r = await q.query<{ id: string }>(
    `insert into approvals(action, requested_by, reason, payload, amount_cents) values ($1,$2,$3,$4,$5) returning id`,
    [input.action, input.requestedBy, input.reason, JSON.stringify(input.payload ?? {}), input.amountCents ?? null],
  );
  const id = r.rows[0]!.id;
  await appendAudit(q, {
    actor: input.requestedBy, action: "approval.request", level: "red", target: id, result: "pending",
    detail: { action: input.action, reason: input.reason, amountCents: input.amountCents ?? null },
  });
  return id;
}

export async function decideApproval(
  q: Queryable,
  input: { approvalId: string; decidedBy: Actor; approve: boolean; note?: string },
): Promise<void> {
  if (input.decidedBy.role !== "owner") throw new Error("Solo el propietario puede autorizar acciones rojas");
  const r = await q.query<{ status: string; requested_by: string; action: string; amount_cents: string | null }>(
    "select status, requested_by, action, amount_cents from approvals where id=$1 for update",
    [input.approvalId],
  );
  const row = r.rows[0];
  if (!row) throw new Error("Autorización no encontrada");
  if (row.status !== "pending") throw new Error(`La autorización ya está en estado ${row.status}`);
  if (input.approve && row.action === "money.spend") {
    const st = await budgetStatus(q);
    if (Number(row.amount_cents ?? 0) > st.remainingCents)
      throw new Error("No se puede aprobar: el monto supera el presupuesto disponible");
  }
  const status = input.approve ? "approved" : "rejected";
  await q.query("update approvals set status=$2, decided_by=$3, decided_at=now(), result=$4 where id=$1", [
    input.approvalId, status, input.decidedBy.id, input.note ?? null,
  ]);
  await appendAudit(q, {
    actor: input.decidedBy.id, action: "approval.decide", level: "red", target: input.approvalId, result: status,
    detail: { note: input.note ?? null },
  });
}

export async function markApprovalExecuted(q: Queryable, approvalId: string, result: string) {
  await q.query("update approvals set status='executed', executed_at=now(), result=$2 where id=$1 and status='approved'", [
    approvalId, result,
  ]);
}
