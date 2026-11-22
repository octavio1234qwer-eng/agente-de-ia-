import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { requireEnv, siteUrl } from "@/lib/env";
import { centsToDecimal, type CheckoutRedirect, type CheckoutRequest } from "./types";

const API = "https://api.mercadopago.com";

async function mpFetch<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${requireEnv("MERCADOPAGO_ACCESS_TOKEN")}`,
    "Content-Type": "application/json",
  };
  if (init.idempotencyKey) headers["X-Idempotency-Key"] = init.idempotencyKey;
  const res = await fetch(`${API}${path}`, { ...init, headers, cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Mercado Pago ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  }
  return body as T;
}

type Preference = { id: string; init_point: string; sandbox_init_point?: string };

/** Checkout Pro: el alumno paga en la página de Mercado Pago. */
export async function createMercadoPagoCheckout(req: CheckoutRequest): Promise<CheckoutRedirect> {
  const pref = await mpFetch<Preference>("/checkout/preferences", {
    method: "POST",
    idempotencyKey: `pref-${req.orderId}`,
    body: JSON.stringify({
      items: req.lines
        .filter((l) => l.amountCents > 0)
        .map((l) => ({
          id: l.id,
          title: l.title.slice(0, 250),
          quantity: 1,
          unit_price: Number(centsToDecimal(l.amountCents)),
          currency_id: req.currency.toUpperCase(),
        })),
      payer: { email: req.customerEmail },
      external_reference: req.orderId,
      metadata: { order_id: req.orderId, order_number: req.orderNumber },
      back_urls: { success: req.successUrl, failure: req.cancelUrl, pending: req.successUrl },
      auto_return: "approved",
      notification_url: `${siteUrl}/api/webhooks/mercadopago`,
      statement_descriptor: "NEXUSACADEMY",
      binary_mode: false,
    }),
  });
  return { url: pref.init_point, providerSessionId: pref.id };
}

export type MercadoPagoPayment = {
  id: number;
  status: "pending" | "approved" | "authorized" | "in_process" | "in_mediation" | "rejected" | "cancelled" | "refunded" | "charged_back";
  status_detail?: string;
  external_reference: string | null;
  transaction_amount: number;
  transaction_amount_refunded?: number;
  currency_id: string;
  refunds?: { id: number; amount: number; status: string }[];
};

/** Consulta el pago directamente a la API (fuente de verdad, no el webhook). */
export function getMercadoPagoPayment(paymentId: string) {
  if (!/^\d+$/.test(paymentId)) throw new Error("ID de pago inválido");
  return mpFetch<MercadoPagoPayment>(`/v1/payments/${paymentId}`);
}

export async function refundMercadoPagoPayment(paymentId: string, amountCents: number, orderId: string) {
  const refund = await mpFetch<{ id: number; status: string }>(`/v1/payments/${paymentId}/refunds`, {
    method: "POST",
    idempotencyKey: `refund-${orderId}-${amountCents}-${Date.now()}`,
    body: JSON.stringify({ amount: Number(centsToDecimal(amountCents)) }),
  });
  return { id: String(refund.id), status: refund.status };
}

/**
 * Valida la firma `x-signature` de Mercado Pago.
 * Manifiesto: `id:{data.id};request-id:{x-request-id};ts:{ts};` firmado con
 * HMAC-SHA256 usando la clave secreta del webhook.
 */
export function verifyMercadoPagoSignature(params: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secret: string;
  toleranceSeconds?: number;
  now?: number;
}): boolean {
  const { xSignature, xRequestId, dataId, secret } = params;
  if (!xSignature) return false;
  const parts = Object.fromEntries(
    xSignature.split(",").map((p) => {
      const [k, ...v] = p.trim().split("=");
      return [k, v.join("=")];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  if (params.toleranceSeconds) {
    const tsNum = Number(ts);
    const tsSeconds = tsNum > 1e12 ? tsNum / 1000 : tsNum;
    const now = (params.now ?? Date.now()) / 1000;
    if (!Number.isFinite(tsSeconds) || Math.abs(now - tsSeconds) > params.toleranceSeconds) return false;
  }

  let manifest = "";
  if (dataId) manifest += `id:${/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId};`;
  if (xRequestId) manifest += `request-id:${xRequestId};`;
  manifest += `ts:${ts};`;

  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(v1, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
