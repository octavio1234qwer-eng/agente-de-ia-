/**
 * Mercado Pago (Checkout Pro). Requiere MP_ACCESS_TOKEN y MP_WEBHOOK_SECRET del panel de desarrolladores.
 * Un pago solo cuenta como ingreso real si: (1) la firma del webhook es válida y (2) la consulta a la API
 * confirma status=approved. Nunca se confía en el cuerpo del webhook.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.mercadopago.com";
export const mercadoPagoConfigured = () => !!process.env.MP_ACCESS_TOKEN;

/** Verifica x-signature ("ts=...,v1=...") según la documentación oficial de notificaciones. */
export function verifyWebhookSignature(opts: { xSignature: string | null; xRequestId: string | null; dataId: string | null; secret: string; toleranceSec?: number; nowMs?: number }): boolean {
  if (!opts.xSignature || !opts.secret) return false;
  const parts = Object.fromEntries(opts.xSignature.split(",").map((p) => p.trim().split("=", 2) as [string, string]));
  const ts = parts.ts, v1 = parts.v1;
  if (!ts || !v1 || !/^[0-9a-f]{64}$/i.test(v1)) return false;
  const tsMs = ts.length > 11 ? Number(ts) : Number(ts) * 1000;
  if (opts.toleranceSec && Math.abs((opts.nowMs ?? Date.now()) - tsMs) > opts.toleranceSec * 1000) return false;
  let manifest = "";
  if (opts.dataId) manifest += `id:${/^[a-z0-9]+$/i.test(opts.dataId) ? opts.dataId.toLowerCase() : opts.dataId};`;
  if (opts.xRequestId) manifest += `request-id:${opts.xRequestId};`;
  manifest += `ts:${ts};`;
  const expected = createHmac("sha256", opts.secret).update(manifest).digest();
  return timingSafeEqual(expected, Buffer.from(v1, "hex"));
}

export interface MpPayment {
  id: number; status: string; transaction_amount: number; currency_id: string; date_approved: string | null;
  external_reference: string | null; description: string | null;
  fee_details?: { amount: number }[];
}

async function mp<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error("MP_ACCESS_TOKEN no configurado");
  const res = await fetch(`${API}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Mercado Pago ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

export const getPayment = (id: string) => mp<MpPayment>(`/v1/payments/${encodeURIComponent(id)}`);

/** Crea una preferencia de pago (link de cobro). Los precios los fija el propietario, no los agentes. */
export async function createPreference(input: { title: string; unitPriceMxn: number; quantity?: number; externalReference: string; payerEmail?: string }) {
  const base = process.env.PUBLIC_BASE_URL;
  return mp<{ id: string; init_point: string }>("/checkout/preferences", {
    method: "POST",
    headers: { "x-idempotency-key": input.externalReference },
    body: JSON.stringify({
      items: [{ title: input.title, quantity: input.quantity ?? 1, unit_price: input.unitPriceMxn, currency_id: "MXN" }],
      external_reference: input.externalReference,
      payer: input.payerEmail ? { email: input.payerEmail } : undefined,
      notification_url: base ? `${base}/api/webhooks/mercadopago` : undefined,
      back_urls: base ? { success: `${base}/cotizafacil/gracias`, failure: `${base}/cotizafacil`, pending: `${base}/cotizafacil` } : undefined,
    }),
  });
}

/** external_reference con formato "<unidad>:<id>" para atribuir el ingreso a la unidad correcta. */
export function unitFromReference(ref: string | null): string {
  const unit = ref?.split(":")[0];
  return unit && /^[a-z0-9-]+$/.test(unit) ? unit : "cotizafacil-mx";
}
