// Adaptador de Mercado Pago (API REST oficial, https://api.mercadopago.com).
// Endpoints y formato de firma verificados contra el código del SDK oficial
// `mercadopago` 3.6.2 (utils/webhook/index.js y clients/*), consultado el 26-nov-2026.

import { randomUUID } from "node:crypto";
import { hmacSha256Hex, safeEqual } from "../crypto.ts";

export const MP_BASE_URL = "https://api.mercadopago.com";

export class MercadoPagoError extends Error {
  constructor(message: string, public status: number, public body?: unknown) {
    super(message);
    this.name = "MercadoPagoError";
  }
}

export interface MpPayment {
  id: number;
  status: string; // approved | pending | in_process | authorized | rejected | cancelled | refunded | charged_back
  status_detail?: string;
  external_reference?: string | null;
  transaction_amount: number;
  transaction_amount_refunded?: number;
  currency_id: string;
  live_mode: boolean;
  date_approved?: string | null;
  date_created?: string;
  money_release_date?: string | null;
  money_release_status?: string | null;
  payment_method_id?: string;
  payment_type_id?: string;
  fee_details?: { type: string; amount: number; fee_payer?: string }[];
  transaction_details?: { net_received_amount?: number };
  metadata?: Record<string, unknown>;
  payer?: { email?: string | null };
}

export interface MpPreapproval {
  id: string;
  status: string; // pending | authorized | paused | cancelled
  external_reference?: string | null;
  payer_email?: string | null;
  init_point?: string;
  next_payment_date?: string | null;
  auto_recurring?: { transaction_amount: number; currency_id: string; frequency: number; frequency_type: string };
}

export interface MpAuthorizedPayment {
  id: number | string;
  preapproval_id: string;
  status?: string;
  transaction_amount?: number;
  currency_id?: string;
  payment?: { id: number; status: string; status_detail?: string };
}

export interface MpClientOptions {
  accessToken: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
}

export function createMercadoPagoClient(opts: MpClientOptions) {
  const f = opts.fetchImpl ?? fetch;
  const base = opts.baseUrl ?? MP_BASE_URL;

  async function call<T>(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${opts.accessToken}`,
      Accept: "application/json",
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (method !== "GET") headers["X-Idempotency-Key"] = idempotencyKey ?? randomUUID();
    const res = await f(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 12_000),
    });
    const text = await res.text();
    let json: unknown = undefined;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = text;
    }
    if (!res.ok) {
      const msg = (json as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`;
      throw new MercadoPagoError(`Mercado Pago ${method} ${path.split("?")[0]}: ${msg}`, res.status, json);
    }
    return json as T;
  }

  const enc = encodeURIComponent;
  return {
    createPreference: (pref: Record<string, unknown>, idempotencyKey?: string) =>
      call<{ id: string; init_point: string; sandbox_init_point?: string }>("POST", "/checkout/preferences", pref, idempotencyKey),
    getPayment: (id: string | number) => call<MpPayment>("GET", `/v1/payments/${enc(String(id))}`),
    searchPaymentsByReference: (externalReference: string) =>
      call<{ results: MpPayment[] }>("GET", `/v1/payments/search?external_reference=${enc(externalReference)}&sort=date_created&criteria=desc&limit=20`),
    refundPayment: (id: string | number, amount: number | undefined, idempotencyKey: string) =>
      call<{ id: number; amount: number; status: string }>("POST", `/v1/payments/${enc(String(id))}/refunds`, amount === undefined ? {} : { amount }, idempotencyKey),
    createPreapproval: (body: Record<string, unknown>, idempotencyKey?: string) =>
      call<MpPreapproval>("POST", "/preapproval", body, idempotencyKey),
    getPreapproval: (id: string) => call<MpPreapproval>("GET", `/preapproval/${enc(id)}`),
    cancelPreapproval: (id: string) => call<MpPreapproval>("PUT", `/preapproval/${enc(id)}`, { status: "cancelled" }),
    getAuthorizedPayment: (id: string | number) => call<MpAuthorizedPayment>("GET", `/authorized_payments/${enc(String(id))}`),
  };
}

export type MercadoPagoClient = ReturnType<typeof createMercadoPagoClient>;

// ───── Firma de webhooks ─────

export type SignatureFailure = "missing_header" | "malformed" | "missing_ts" | "missing_hash" | "mismatch" | "missing_secret";

/**
 * Reproduce exactamente WebhookSignatureValidator del SDK oficial:
 * manifest = "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" (se omiten los pares sin valor),
 * HMAC-SHA256 en hexadecimal con la clave secreta de la aplicación, comparado en tiempo constante.
 * No se aplica tolerancia de tiempo: Mercado Pago reintenta durante días y, de todos modos,
 * el pago se consulta siempre en la API antes de actuar, así que repetir un aviso no tiene efecto.
 */
export function verifyWebhookSignature(input: {
  xSignature: string | null | undefined;
  xRequestId: string | null | undefined;
  dataId: string | null | undefined;
  secret: string | null | undefined;
}): { ok: true } | { ok: false; reason: SignatureFailure } {
  if (!input.secret) return { ok: false, reason: "missing_secret" };
  const header = input.xSignature?.trim();
  if (!header) return { ok: false, reason: "missing_header" };
  let ts: string | undefined;
  let v1: string | undefined;
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    const value = part.slice(eq + 1).trim();
    if (key === "ts") ts = value;
    if (key === "v1") v1 = value;
  }
  if (!ts && !v1) return { ok: false, reason: "malformed" };
  if (!ts) return { ok: false, reason: "missing_ts" };
  if (!/^\d+$/.test(ts)) return { ok: false, reason: "malformed" };
  if (!v1) return { ok: false, reason: "missing_hash" };
  const dataId = input.dataId?.trim();
  const requestId = input.xRequestId?.trim();
  const parts: string[] = [];
  if (dataId) parts.push(`id:${dataId}`);
  if (requestId) parts.push(`request-id:${requestId}`);
  parts.push(`ts:${ts}`);
  const manifest = parts.join(";") + ";";
  return safeEqual(hmacSha256Hex(input.secret, manifest), v1) ? { ok: true } : { ok: false, reason: "mismatch" };
}

/** Solo pruebas: firma un aviso igual que Mercado Pago. */
export function signForTests(secret: string, dataId: string, requestId: string, ts: string): string {
  return `ts=${ts},v1=${hmacSha256Hex(secret, `id:${dataId};request-id:${requestId};ts:${ts};`)}`;
}

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function feeCents(p: MpPayment): number {
  return toCents((p.fee_details ?? []).filter((f) => !f.fee_payer || f.fee_payer === "collector").reduce((s, f) => s + (f.amount ?? 0), 0));
}
