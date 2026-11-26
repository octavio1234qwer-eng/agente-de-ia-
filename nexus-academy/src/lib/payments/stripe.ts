import "server-only";
import Stripe from "stripe";
import { requireEnv } from "@/lib/env";
import type { CheckoutRedirect, CheckoutRequest } from "./types";
import { BRAND } from "@/lib/brand";

let client: Stripe | null = null;

export function getStripe() {
  if (!client) {
    client = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
      appInfo: { name: BRAND.name },
      maxNetworkRetries: 2,
    });
  }
  return client;
}

/** Crea una sesión de Stripe Checkout. La página de pago la aloja Stripe: los
 *  datos de tarjeta nunca pasan por nuestros servidores. */
export async function createStripeCheckout(req: CheckoutRequest): Promise<CheckoutRedirect> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      locale: "es-419",
      customer_email: req.customerEmail,
      client_reference_id: req.orderId,
      metadata: { order_id: req.orderId, order_number: req.orderNumber },
      payment_intent_data: { metadata: { order_id: req.orderId, order_number: req.orderNumber } },
      line_items: req.lines
        .filter((l) => l.amountCents > 0)
        .map((l) => ({
          quantity: 1,
          price_data: {
            currency: req.currency.toLowerCase(),
            unit_amount: l.amountCents,
            product_data: { name: l.title, metadata: { item_id: l.id } },
          },
        })),
      success_url: `${req.successUrl}${req.successUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: req.cancelUrl,
    },
    { idempotencyKey: `checkout-session-${req.orderId}` },
  );
  if (!session.url) throw new Error("Stripe no devolvió la URL de pago.");
  return { url: session.url, providerSessionId: session.id };
}

export function constructStripeEvent(rawBody: string, signature: string) {
  return getStripe().webhooks.constructEvent(rawBody, signature, requireEnv("STRIPE_WEBHOOK_SECRET"));
}

export async function refundStripePayment(paymentIntentId: string, amountCents: number, orderId: string) {
  const refund = await getStripe().refunds.create(
    { payment_intent: paymentIntentId, amount: amountCents, metadata: { order_id: orderId } },
    { idempotencyKey: `refund-${orderId}-${amountCents}-${Date.now()}` },
  );
  return { id: refund.id, status: refund.status ?? "pending" };
}

export async function listStripeRefundsForPaymentIntent(paymentIntentId: string) {
  const refunds = await getStripe().refunds.list({ payment_intent: paymentIntentId, limit: 100 });
  return refunds.data.filter((r) => r.status === "succeeded" || r.status === "pending");
}
