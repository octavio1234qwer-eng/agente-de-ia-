import { audit } from "./audit.ts";
import type { Db, Queryable } from "./db/types.ts";
import { checkSpend, type SpendCategory } from "./security/spending.ts";
import { executeRefund } from "./payments/service.ts";

export interface ApprovalRequest {
  kind: string;
  title: string;
  summary?: string;
  payload?: Record<string, unknown>;
  risk?: "low" | "medium" | "high" | "critical";
  requestedBy: string;
  dedupeKey?: string;
  expiresInDays?: number;
}

export async function createApproval(q: Queryable, a: ApprovalRequest): Promise<string> {
  const { rows } = await q.query<{ id: string }>(
    `INSERT INTO approvals (kind, title, summary, payload, risk, requested_by, dedupe_key, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7, now() + make_interval(days => $8::int))
     ON CONFLICT (dedupe_key) DO UPDATE SET dedupe_key = EXCLUDED.dedupe_key RETURNING id`,
    [a.kind, a.title.slice(0, 200), a.summary?.slice(0, 2000) ?? null, JSON.stringify(a.payload ?? {}), a.risk ?? "medium",
     a.requestedBy, a.dedupeKey ?? null, a.expiresInDays ?? 14],
  );
  return rows[0]!.id;
}

type Executor = (db: Db, payload: Record<string, unknown>, approvalId: string, userId: string) => Promise<string>;

/** Lo que pasa al aprobar cada tipo de solicitud. Tipos sin ejecutor no se pueden aprobar. */
const EXECUTORS: Record<string, Executor> = {
  "payment.refund": (db, p, id) => executeRefund(db, p as { orderId: string; providerPaymentId: string; amountCents: number }, id),

  "product.publish": async (db, p, _id, userId) => {
    return db.tx(async (q) => {
      const { rows } = await q.query<{ version_id: string; qa_status: string }>(
        `SELECT v.id AS version_id, v.qa_status FROM products pr JOIN product_versions v ON v.id = pr.current_version_id WHERE pr.id = $1`,
        [p.productId],
      );
      const v = rows[0];
      if (!v) throw new Error("Producto sin versión");
      if (v.qa_status !== "passed") throw new Error("La versión no pasó el control de calidad.");
      await q.query("UPDATE product_versions SET approved_by = $2, approved_at = now() WHERE id = $1", [v.version_id, userId]);
      await q.query("UPDATE products SET status = 'published', updated_at = now() WHERE id = $1", [p.productId]);
      return "Producto publicado";
    });
  },

  "product.change_price": async (db, p) => {
    const cents = Number(p.newPriceCents);
    if (!Number.isInteger(cents) || cents <= 0) throw new Error("Precio inválido");
    await db.query("UPDATE products SET price_cents = $2, updated_at = now() WHERE id = $1", [p.productId, cents]);
    return `Precio actualizado a ${(cents / 100).toFixed(2)}`;
  },

  "content.publish": async (db, p, _id, userId) => {
    await db.query("UPDATE content SET status = 'approved', approved_by = $2, updated_at = now() WHERE id = $1 AND status = 'draft'", [p.contentId, userId]);
    return "Contenido aprobado. Publícalo copiando el texto desde el panel (no hay canal conectado por API).";
  },

  "campaign.activate": async (db, p, approvalId) => {
    await db.query("UPDATE campaigns SET status = 'active', approval_id = $2, updated_at = now() WHERE id = $1", [p.campaignId, approvalId]);
    return "Campaña activada";
  },

  "business.launch": async (db, p) => {
    await db.query("UPDATE businesses SET status = 'active', updated_at = now() WHERE id = $1", [p.businessId]);
    return "Negocio activo";
  },

  "expense.create": async (db, p, approvalId) => {
    const amount = Number(p.amountCents ?? 0);
    const check = await checkSpend(db, (p.category as SpendCategory) ?? "other", amount);
    if (!check.allowed) {
      throw new Error(`${check.reason}. Para autorizarlo sube el límite en security/spending-limits/limits.json (requiere un commit).`);
    }
    await db.query(
      `INSERT INTO expenses (vendor, description, category, amount_cents, status, approval_id) VALUES ($1,$2,$3,$4,'approved',$5)`,
      [p.vendor, p.description, p.category, amount, approvalId],
    );
    return "Gasto aprobado";
  },
};

export function approvableKinds(): string[] {
  return Object.keys(EXECUTORS);
}

/** Decisión humana. Al aprobar se ejecuta la acción y se registra el resultado. */
export async function decideApproval(db: Db, approvalId: string, userId: string, decision: "approved" | "rejected", note?: string): Promise<{ status: string; result?: string }> {
  const claimed = await db.tx(async (q) => {
    const { rows } = await q.query<{ id: string; kind: string; status: string; payload: Record<string, unknown>; expires_at: Date | null }>(
      "SELECT * FROM approvals WHERE id = $1 FOR UPDATE",
      [approvalId],
    );
    const a = rows[0];
    if (!a) throw new Error("Solicitud no encontrada");
    if (a.status !== "pending") throw new Error(`La solicitud ya está ${a.status}`);
    if (a.expires_at && new Date(a.expires_at).getTime() < Date.now()) {
      await q.query("UPDATE approvals SET status = 'expired' WHERE id = $1", [approvalId]);
      throw new Error("La solicitud venció");
    }
    if (decision === "approved" && !EXECUTORS[a.kind]) throw new Error(`No hay un ejecutor para ${a.kind}`);
    await q.query("UPDATE approvals SET status = $2, decided_by = $3, decided_at = now(), decision_note = $4 WHERE id = $1", [approvalId, decision, userId, note ?? null]);
    await audit(q, { actorType: "user", actorId: userId, action: `approval.${decision}`, targetType: "approval", targetId: approvalId, severity: "warning", metadata: { kind: a.kind } });
    return a;
  });
  if (decision === "rejected") return { status: "rejected" };

  try {
    const result = await EXECUTORS[claimed.kind]!(db, claimed.payload, approvalId, userId);
    await db.tx(async (q) => {
      await q.query("UPDATE approvals SET status = 'executed', executed_at = now(), execution_result = $2 WHERE id = $1", [approvalId, JSON.stringify({ result })]);
      await audit(q, { actorType: "user", actorId: userId, action: "approval.executed", targetType: "approval", targetId: approvalId, metadata: { kind: claimed.kind } });
    });
    return { status: "executed", result };
  } catch (err) {
    const message = (err as Error).message;
    await db.query("UPDATE approvals SET status = 'failed', execution_result = $2 WHERE id = $1", [approvalId, JSON.stringify({ error: message })]);
    return { status: "failed", result: message };
  }
}
