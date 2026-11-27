/** Procesa notificaciones de Mercado Pago: firma válida + consulta a la API ⇒ ingreso real verificado. */
import type { Db } from "../../core/db";
import { recordVerifiedIncome } from "../../finance/ledger";
import { getPayment, unitFromReference, verifyWebhookSignature, type MpPayment } from "../../infrastructure/integrations/mercadopago";
import { appendAudit } from "../../core/audit-log";

export async function handleMercadoPagoWebhook(
  db: Db,
  req: { xSignature: string | null; xRequestId: string | null; dataId: string | null; type: string | null },
  deps: { fetchPayment?: (id: string) => Promise<MpPayment>; secret?: string } = {},
): Promise<{ status: number; body: string }> {
  const secret = deps.secret ?? process.env.MP_WEBHOOK_SECRET ?? "";
  if (!secret) return { status: 503, body: "webhook no configurado" };
  if (!verifyWebhookSignature({ xSignature: req.xSignature, xRequestId: req.xRequestId, dataId: req.dataId, secret, toleranceSec: 600 })) {
    await db.transaction((tx) => appendAudit(tx, { actor: "public", action: "webhook.mercadopago", level: "blocked", target: req.dataId, result: "firma inválida" }));
    return { status: 401, body: "firma inválida" };
  }
  if (req.type !== "payment" || !req.dataId) return { status: 200, body: "ignorado" };
  const p = await (deps.fetchPayment ?? getPayment)(req.dataId);
  if (p.status !== "approved") return { status: 200, body: `estado ${p.status}` };
  const fee = Math.round((p.fee_details ?? []).reduce((s, f) => s + f.amount, 0) * 100);
  const r = await db.transaction((tx) => recordVerifiedIncome(tx, {
    source: "mercadopago", externalId: String(p.id), amountCents: Math.round(p.transaction_amount * 100), currency: p.currency_id,
    businessUnitId: unitFromReference(p.external_reference), occurredAt: new Date(p.date_approved ?? Date.now()),
    description: p.description ?? "Pago Mercado Pago", actor: "system:mercadopago", feeCents: fee,
  }));
  return { status: 200, body: r.inserted ? "registrado" : "duplicado" };
}
