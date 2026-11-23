import { integrations, requireEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMercadoPagoPayment, verifyMercadoPagoSignature } from "@/lib/payments/mercadopago";
import { decimalToCents } from "@/lib/payments/types";
import { claimPaymentEvent, completePaymentEvent, fulfillOrder, markOrderStatus, recordRefund } from "@/lib/commerce/fulfillment";
import { fail, isPermanentError, ok } from "@/lib/commerce/webhook-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!integrations.mercadopago()) return fail(503, "Mercado Pago no está configurado");
  const url = new URL(request.url);
  const raw = await request.text();
  let body: { type?: string; action?: string; data?: { id?: string | number } } = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return fail(400, "JSON inválido");
  }
  const dataId = url.searchParams.get("data.id") ?? (body.data?.id !== undefined ? String(body.data.id) : null);
  const type = url.searchParams.get("type") ?? body.type ?? url.searchParams.get("topic");
  const requestId = request.headers.get("x-request-id");

  const valid = verifyMercadoPagoSignature({
    xSignature: request.headers.get("x-signature"),
    xRequestId: requestId,
    dataId,
    secret: requireEnv("MERCADOPAGO_WEBHOOK_SECRET"),
    toleranceSeconds: 600,
  });
  if (!valid) return fail(401, "Firma inválida");
  if (type !== "payment" || !dataId) return ok({ received: true, ignored: true });

  const claim = await claimPaymentEvent("mercadopago", `${type}:${dataId}:${requestId ?? "sin-id"}`, `${type}.${body.action ?? "notification"}`, body);
  if (claim.alreadyProcessed) return ok({ received: true, duplicate: true });

  let orderId: string | null = null;
  try {
    // La notificación solo trae el ID: el estado real se consulta a la API.
    const payment = await getMercadoPagoPayment(dataId);
    orderId = payment.external_reference;
    if (orderId) {
      if (payment.status === "approved") {
        await fulfillOrder({ orderId, providerPaymentId: String(payment.id), amountCents: decimalToCents(payment.transaction_amount), currency: payment.currency_id });
      } else if (payment.status === "rejected" || payment.status === "cancelled") {
        await markOrderStatus(orderId, "failed", `Mercado Pago: ${payment.status_detail ?? payment.status}`);
      } else if (payment.status === "refunded" || payment.status === "charged_back" || (payment.refunds?.length ?? 0) > 0) {
        const { data: order } = await createAdminClient().from("orders").select("id, status").eq("id", orderId).maybeSingle();
        if (order && ["paid", "partially_refunded"].includes(order.status)) {
          for (const r of payment.refunds ?? []) {
            await recordRefund({ orderId, amountCents: decimalToCents(r.amount), providerRefundId: String(r.id), reason: "Reembolso registrado en Mercado Pago" });
          }
        }
      }
    }
    await completePaymentEvent(claim.id, { orderId });
    return ok();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await completePaymentEvent(claim.id, { orderId, error: message });
    if (isPermanentError(err)) return ok({ received: true, error: "requiere revisión" });
    return fail(500, "Error temporal; reintentar");
  }
}
