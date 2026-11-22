import "server-only";
import { config, requireEnv } from "@/lib/env";
import { centsToDecimal, type CheckoutRedirect, type CheckoutRequest } from "./types";

let token: { value: string; expiresAt: number } | null = null;

async function getAccessToken() {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;
  const credentials = Buffer.from(`${requireEnv("PAYPAL_CLIENT_ID")}:${requireEnv("PAYPAL_CLIENT_SECRET")}`).toString("base64");
  const res = await fetch(`${config.paypalBaseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`PayPal OAuth ${res.status}`);
  token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return token.value;
}

async function ppFetch<T>(path: string, init: RequestInit & { requestId?: string } = {}): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await getAccessToken()}`,
    "Content-Type": "application/json",
  };
  if (init.requestId) headers["PayPal-Request-Id"] = init.requestId;
  const res = await fetch(`${config.paypalBaseUrl}${path}`, { ...init, headers, cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`PayPal ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body as T;
}

type PayPalOrder = {
  id: string;
  status: string;
  links: { rel: string; href: string }[];
  purchase_units?: {
    custom_id?: string;
    payments?: { captures?: PayPalCapture[] };
  }[];
};

export type PayPalCapture = {
  id: string;
  status: string;
  custom_id?: string;
  amount: { currency_code: string; value: string };
};

export async function createPayPalCheckout(req: CheckoutRequest): Promise<CheckoutRedirect> {
  const order = await ppFetch<PayPalOrder>("/v2/checkout/orders", {
    method: "POST",
    requestId: `order-${req.orderId}`,
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: req.orderId,
          custom_id: req.orderId,
          invoice_id: req.orderNumber,
          description: `NEXUS ACADEMY · ${req.orderNumber}`.slice(0, 127),
          amount: { currency_code: req.currency.toUpperCase(), value: centsToDecimal(req.totalCents) },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "NEXUS ACADEMY",
            locale: "es-MX",
            user_action: "PAY_NOW",
            shipping_preference: "NO_SHIPPING",
            return_url: req.successUrl,
            cancel_url: req.cancelUrl,
          },
        },
      },
    }),
  });
  const approve = order.links.find((l) => l.rel === "payer-action" || l.rel === "approve");
  if (!approve) throw new Error("PayPal no devolvió el enlace de aprobación.");
  return { url: approve.href, providerSessionId: order.id };
}

/** Captura el pago tras la aprobación del comprador (lado servidor). */
export async function capturePayPalOrder(paypalOrderId: string): Promise<PayPalCapture | null> {
  if (!/^[A-Z0-9]+$/.test(paypalOrderId)) throw new Error("ID de orden PayPal inválido");
  const order = await ppFetch<PayPalOrder>(`/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: "POST",
    requestId: `capture-${paypalOrderId}`,
  });
  const capture = order.purchase_units?.[0]?.payments?.captures?.[0] ?? null;
  return capture ? { ...capture, custom_id: capture.custom_id ?? order.purchase_units?.[0]?.custom_id } : null;
}

export async function refundPayPalCapture(captureId: string, amountCents: number, currency: string, orderId: string) {
  const refund = await ppFetch<{ id: string; status: string }>(`/v2/payments/captures/${captureId}/refund`, {
    method: "POST",
    requestId: `refund-${orderId}-${amountCents}-${Date.now()}`,
    body: JSON.stringify({ amount: { value: centsToDecimal(amountCents), currency_code: currency.toUpperCase() } }),
  });
  return { id: refund.id, status: refund.status };
}

/** Verifica la firma del webhook con la API oficial de PayPal. */
export async function verifyPayPalWebhook(headers: Headers, event: unknown): Promise<boolean> {
  const required = ["paypal-auth-algo", "paypal-cert-url", "paypal-transmission-id", "paypal-transmission-sig", "paypal-transmission-time"];
  if (required.some((h) => !headers.get(h))) return false;
  const result = await ppFetch<{ verification_status: string }>("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify({
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: requireEnv("PAYPAL_WEBHOOK_ID"),
      webhook_event: event,
    }),
  });
  return result.verification_status === "SUCCESS";
}
