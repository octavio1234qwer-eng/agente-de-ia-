import { integrations } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { capturePayPalOrder, verifyPayPalWebhook } from "@/lib/payments/paypal";
import { decimalToCents } from "@/lib/payments/types";
import { claimPaymentEvent, completePaymentEvent, fulfillOrder, markOrderStatus, recordRefund } from "@/lib/commerce/fulfillment";
import { fail, isPermanentError, ok } from "@/lib/commerce/webhook-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PayPalEvent = {
  id: string;
  event_type: string;
  resource: {
    id: string;
    status?: string;
    custom_id?: string;
    amount?: { value: string; currency_code: string };
    links?: { rel: string; href: string }[];
    purchase_units?: { custom_id?: string; reference_id?: string }[];
  };
};

export async function POST(request: Request) {
  if (!integrations.paypal()) return fail(503, "PayPal no está configurado");
  let event: PayPalEvent;
  try {
    event = await request.json();
  } catch {
    return fail(400, "JSON inválido");
  }
  let verified = false;
  try {
    verified = await verifyPayPalWebhook(request.headers, event);
  } catch {
    return fail(500, "No se pudo verificar la firma; reintentar");
  }
  if (!verified) return fail(401, "Firma inválida");

  const claim = await claimPaymentEvent("paypal", event.id, event.event_type, event);
  if (claim.alreadyProcessed) return ok({ received: true, duplicate: true });

  const admin = createAdminClient();
  let orderId: string | null = null;
  try {
    const r = event.resource;
    switch (event.event_type) {
      case "CHECKOUT.ORDER.APPROVED": {
        // El comprador aprobó pero quizá cerró la ventana antes de volver: capturamos aquí.
        orderId = r.purchase_units?.[0]?.custom_id ?? null;
        const { data: order } = orderId
          ? await admin.from("orders").select("id, status, provider_session_id").eq("id", orderId).maybeSingle()
          : { data: null };
        if (order && order.status === "pending" && order.provider_session_id === r.id) {
          const capture = await capturePayPalOrder(r.id);
          if (capture?.status === "COMPLETED" && capture.custom_id === order.id) {
            await fulfillOrder({ orderId: order.id, providerPaymentId: capture.id, amountCents: decimalToCents(capture.amount.value), currency: capture.amount.currency_code });
          }
        }
        break;
      }
      case "PAYMENT.CAPTURE.COMPLETED": {
        orderId = r.custom_id ?? null;
        if (orderId && r.amount) {
          await fulfillOrder({ orderId, providerPaymentId: r.id, amountCents: decimalToCents(r.amount.value), currency: r.amount.currency_code });
        }
        break;
      }
      case "PAYMENT.CAPTURE.DENIED":
      case "PAYMENT.CAPTURE.DECLINED": {
        orderId = r.custom_id ?? null;
        if (orderId) await markOrderStatus(orderId, "failed", `PayPal: ${event.event_type}`);
        break;
      }
      case "PAYMENT.CAPTURE.REFUNDED": {
        const captureId = r.links?.find((l) => l.rel === "up")?.href.split("/").pop();
        if (!captureId || !r.amount) break;
        const { data: order } = await admin.from("orders").select("id").eq("provider", "paypal").eq("provider_payment_id", captureId).maybeSingle();
        if (!order) break;
        orderId = order.id;
        await recordRefund({ orderId, amountCents: decimalToCents(r.amount.value), providerRefundId: r.id, reason: "Reembolso registrado en PayPal" });
        break;
      }
      default:
        break;
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
