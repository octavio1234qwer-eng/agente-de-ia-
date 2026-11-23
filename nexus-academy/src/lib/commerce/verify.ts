import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { integrations } from "@/lib/env";
import { getStripe } from "@/lib/payments/stripe";
import { getMercadoPagoPayment } from "@/lib/payments/mercadopago";
import { decimalToCents } from "@/lib/payments/types";
import { fulfillOrder } from "./fulfillment";

/**
 * Verificación activa al volver del proveedor: si el webhook aún no llegó,
 * consultamos directamente la API del proveedor (fuente de verdad). Nunca se
 * confía en parámetros de la URL por sí solos.
 */
export async function verifyReturn(orderId: string, params: { sessionId?: string | null; paymentId?: string | null }) {
  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("id, status, provider, provider_session_id").eq("id", orderId).maybeSingle();
  if (!order || order.status !== "pending") return;

  try {
    if (order.provider === "stripe" && integrations.stripe() && params.sessionId && params.sessionId === order.provider_session_id) {
      const session = await getStripe().checkout.sessions.retrieve(params.sessionId);
      if (session.payment_status === "paid" && session.amount_total !== null) {
        const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
        await fulfillOrder({ orderId, providerPaymentId: pi ?? session.id, amountCents: session.amount_total, currency: session.currency ?? "" });
      }
    }
    if (order.provider === "mercadopago" && integrations.mercadopago() && params.paymentId && /^\d+$/.test(params.paymentId)) {
      const payment = await getMercadoPagoPayment(params.paymentId);
      if (payment.external_reference === orderId && payment.status === "approved") {
        await fulfillOrder({ orderId, providerPaymentId: String(payment.id), amountCents: decimalToCents(payment.transaction_amount), currency: payment.currency_id });
      }
    }
  } catch (err) {
    console.error("[verifyReturn]", err);
  }
}
