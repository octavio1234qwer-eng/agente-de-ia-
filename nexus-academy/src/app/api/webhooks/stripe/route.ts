import type Stripe from "stripe";
import { integrations } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { constructStripeEvent, listStripeRefundsForPaymentIntent } from "@/lib/payments/stripe";
import { claimPaymentEvent, completePaymentEvent, fulfillOrder, markOrderStatus, recordRefund } from "@/lib/commerce/fulfillment";
import { fail, isPermanentError, ok } from "@/lib/commerce/webhook-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function orderIdOf(session: Stripe.Checkout.Session) {
  return session.metadata?.order_id ?? session.client_reference_id ?? null;
}

export async function POST(request: Request) {
  if (!integrations.stripe()) return fail(503, "Stripe no está configurado");
  const signature = request.headers.get("stripe-signature");
  if (!signature) return fail(400, "Falta la firma");
  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = constructStripeEvent(raw, signature);
  } catch {
    return fail(400, "Firma inválida");
  }

  const claim = await claimPaymentEvent("stripe", event.id, event.type, event);
  if (claim.alreadyProcessed) return ok({ received: true, duplicate: true });

  let orderId: string | null = null;
  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        orderId = orderIdOf(session);
        if (orderId && session.payment_status === "paid" && session.amount_total !== null) {
          const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
          await fulfillOrder({ orderId, providerPaymentId: pi ?? session.id, amountCents: session.amount_total, currency: session.currency ?? "" });
        }
        break;
      }
      case "checkout.session.async_payment_failed": {
        orderId = orderIdOf(event.data.object);
        if (orderId) await markOrderStatus(orderId, "failed", "Pago asíncrono rechazado");
        break;
      }
      case "checkout.session.expired": {
        orderId = orderIdOf(event.data.object);
        if (orderId) await markOrderStatus(orderId, "expired", "Sesión de pago expirada");
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object;
        const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
        if (!pi) break;
        const { data: order } = await createAdminClient().from("orders").select("id").eq("provider", "stripe").eq("provider_payment_id", pi).maybeSingle();
        if (!order) break;
        orderId = order.id;
        for (const refund of await listStripeRefundsForPaymentIntent(pi)) {
          if (refund.status === "succeeded") {
            await recordRefund({ orderId, amountCents: refund.amount, providerRefundId: refund.id, reason: "Reembolso registrado en Stripe" });
          }
        }
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
