import { z } from "zod";
import { audit } from "../audit.ts";
import { randomToken, sha256 } from "../crypto.ts";
import type { Db, Queryable } from "../db/types.ts";
import { appUrl, paymentsConfigured, taxReserveBp } from "../env.ts";
import { recordEntry } from "../finance/ledger.ts";
import { notifyAdmin } from "../notifications.ts";
import { getKillSwitch } from "../settings.ts";
import { DeliveryBlockedError, fulfillOrder, recordDeliveryFailure } from "../delivery/service.ts";
import {
  createMercadoPagoClient, feeCents, toCents, verifyWebhookSignature,
  type MercadoPagoClient, type MpPayment,
} from "./mercadopago.ts";

// ───── Cliente (inyectable en pruebas) ─────
let testClient: MercadoPagoClient | null = null;
export function setMpClientForTests(c: MercadoPagoClient | null) {
  testClient = c;
}
export function mp(): MercadoPagoClient {
  if (testClient) return testClient;
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new PaymentsNotConfiguredError();
  return createMercadoPagoClient({ accessToken: token });
}

export class PaymentsNotConfiguredError extends Error {
  constructor() {
    super("Los pagos aún no están configurados (faltan credenciales de Mercado Pago).");
    this.name = "PaymentsNotConfiguredError";
  }
}

export class CheckoutError extends Error {
  constructor(message: string, public code: "product_unavailable" | "paused" | "invalid" = "invalid") {
    super(message);
    this.name = "CheckoutError";
  }
}

// ───── Checkout ─────
export const checkoutSchema = z.object({
  productSlug: z.string().regex(/^[a-z0-9-]{2,60}$/),
  email: z.string().trim().toLowerCase().email("Escribe un correo válido.").max(254),
  acceptTerms: z.literal(true, { message: "Debes aceptar los términos." }),
  marketingConsent: z.boolean().default(false),
});

export interface CheckoutResult {
  orderId: string;
  redirectUrl: string;
  /** Token que se guarda en una cookie httpOnly para mostrar el acceso al regresar. */
  checkoutToken: string;
}

/**
 * Crea un pedido y su preferencia (pago único) o preapproval (suscripción).
 * El precio sale SIEMPRE de la base de datos, nunca del navegador.
 */
export async function createCheckout(db: Db, rawInput: z.input<typeof checkoutSchema>): Promise<CheckoutResult> {
  const input = checkoutSchema.parse(rawInput);
  if (!paymentsConfigured() && !testClient) throw new PaymentsNotConfiguredError();
  const kill = await getKillSwitch(db);
  if (kill.active) throw new CheckoutError("Las ventas están pausadas temporalmente.", "paused");

  const { rows } = await db.query<{
    id: string; business_id: string; name: string; kind: string; status: string; price_cents: number; currency: string;
    billing_interval: string | null; current_version_id: string | null;
  }>("SELECT * FROM products WHERE slug = $1", [input.productSlug]);
  const product = rows[0];
  if (!product || product.status !== "published" || product.kind === "free_tool") {
    throw new CheckoutError("Este producto todavía no está a la venta.", "product_unavailable");
  }

  const checkoutToken = randomToken(24);
  const order = await db.tx(async (q) => {
    const o = await q.query<{ id: string }>(
      `INSERT INTO orders (business_id, product_id, product_version_id, buyer_email, amount_cents, currency, checkout_token_hash,
                           marketing_consent, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now() + interval '3 days') RETURNING id`,
      [product.business_id, product.id, product.current_version_id, input.email, product.price_cents, product.currency,
       sha256(checkoutToken), input.marketingConsent],
    );
    const orderId = o.rows[0]!.id;
    if (product.kind === "subscription") {
      await q.query(
        `INSERT INTO subscriptions (business_id, product_id, order_id, amount_cents, currency, billing_interval) VALUES ($1,$2,$3,$4,$5,$6)`,
        [product.business_id, product.id, orderId, product.price_cents, product.currency, product.billing_interval],
      );
    }
    await audit(q, { actorType: "customer", action: "checkout.created", targetType: "order", targetId: orderId, metadata: { product: input.productSlug } });
    return orderId;
  });

  const base = appUrl();
  const notificationUrl = `${base}/api/webhooks/mercadopago?source_news=webhooks`;
  let redirectUrl: string;
  let reference: string;
  try {
    if (product.kind === "subscription") {
      const pre = await mp().createPreapproval(
        {
          reason: product.name,
          external_reference: order,
          payer_email: input.email,
          back_url: `${base}/gracias?pedido=${order}`,
          notification_url: notificationUrl,
          status: "pending",
          auto_recurring: {
            frequency: 1,
            frequency_type: product.billing_interval === "year" ? "years" : "months",
            transaction_amount: product.price_cents / 100,
            currency_id: product.currency,
          },
        },
        `preapproval:${order}`,
      );
      redirectUrl = pre.init_point ?? "";
      reference = pre.id;
      await db.query("UPDATE subscriptions SET provider_subscription_id = $2 WHERE order_id = $1", [order, pre.id]);
    } else {
      const pref = await mp().createPreference(
        {
          items: [{ id: input.productSlug, title: product.name, quantity: 1, unit_price: product.price_cents / 100, currency_id: product.currency }],
          payer: { email: input.email },
          external_reference: order,
          metadata: { order_id: order },
          notification_url: notificationUrl,
          back_urls: {
            success: `${base}/gracias?pedido=${order}`,
            pending: `${base}/gracias?pedido=${order}`,
            failure: `${base}/precios?pago=fallido`,
          },
          auto_return: "approved",
          expires: true,
          expiration_date_to: new Date(Date.now() + 3 * 86_400_000).toISOString(),
          statement_descriptor: "COTIZAFACIL",
        },
        `preference:${order}`,
      );
      redirectUrl = pref.init_point;
      reference = pref.id;
    }
  } catch (err) {
    await db.query("UPDATE orders SET status = 'failed', updated_at = now() WHERE id = $1", [order]);
    throw err;
  }
  if (!/^https:\/\/([a-z0-9-]+\.)*mercadopago\.com(\.mx)?\//.test(redirectUrl)) {
    throw new Error("Mercado Pago devolvió una URL de pago inesperada.");
  }
  await db.query("UPDATE orders SET provider_reference = $2, checkout_url = $3, updated_at = now() WHERE id = $1", [order, reference, redirectUrl]);
  return { orderId: order, redirectUrl, checkoutToken };
}

// ───── Webhook ─────
export interface WebhookInput {
  query: URLSearchParams;
  headers: { xSignature: string | null; xRequestId: string | null };
  body: unknown;
}

export interface WebhookOutcome {
  httpStatus: 200 | 401 | 400 | 500;
  status: "processed" | "ignored" | "duplicate" | "rejected" | "failed";
  detail?: string;
}

const webhookBody = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  type: z.string().optional(),
  action: z.string().optional(),
  live_mode: z.boolean().optional(),
  data: z.object({ id: z.union([z.string(), z.number()]) }).optional(),
});

/**
 * 1) Verifica la firma. 2) Registra el evento una sola vez (idempotencia por x-request-id + recurso).
 * 3) Consulta el recurso real en la API de Mercado Pago. Nunca confía en el contenido del aviso.
 */
export async function handleMercadoPagoWebhook(db: Db, input: WebhookInput): Promise<WebhookOutcome> {
  const dataId = input.query.get("data.id") ?? undefined;
  const sig = verifyWebhookSignature({
    xSignature: input.headers.xSignature,
    xRequestId: input.headers.xRequestId,
    dataId,
    secret: process.env.MP_WEBHOOK_SECRET,
  });
  const parsed = webhookBody.safeParse(input.body);
  const topic = input.query.get("type") ?? (parsed.success ? parsed.data.type : undefined) ?? "unknown";
  const resourceId = dataId ?? (parsed.success ? String(parsed.data.data?.id ?? "") : "");

  if (!sig.ok) {
    await db.tx(async (q) => {
      await audit(q, { actorType: "webhook", actorId: "mercadopago", action: "webhook.rejected", severity: "warning", metadata: { reason: sig.reason, topic } });
    });
    return { httpStatus: 401, status: "rejected", detail: sig.reason };
  }
  if (!resourceId || !/^[A-Za-z0-9_-]{1,64}$/.test(resourceId)) return { httpStatus: 400, status: "ignored", detail: "sin data.id" };

  const eventKey = `${topic}:${resourceId}:${input.headers.xRequestId ?? sha256(JSON.stringify(input.body)).slice(0, 16)}`;
  const ins = await db.query<{ id: string }>(
    `INSERT INTO webhook_events (provider, event_key, topic, resource_id, signature_valid, payload)
     VALUES ('mercadopago', $1, $2, $3, true, $4)
     ON CONFLICT (provider, event_key) DO UPDATE SET attempts = webhook_events.attempts + 1
     RETURNING id, (xmax = 0) AS inserted, status`,
    [eventKey, topic, resourceId, JSON.stringify(parsed.success ? parsed.data : {})],
  );
  const event = ins.rows[0] as unknown as { id: string; inserted: boolean; status: string };
  if (!event.inserted && event.status === "processed") return { httpStatus: 200, status: "duplicate" };

  try {
    let detail: string;
    if (topic === "payment") detail = await syncPayment(db, resourceId);
    else if (topic === "subscription_preapproval") detail = await syncPreapproval(db, resourceId);
    else if (topic === "subscription_authorized_payment") detail = await syncAuthorizedPayment(db, resourceId);
    else {
      await db.query("UPDATE webhook_events SET status = 'ignored', processed_at = now() WHERE id = $1", [event.id]);
      return { httpStatus: 200, status: "ignored", detail: topic };
    }
    await db.query("UPDATE webhook_events SET status = 'processed', processed_at = now(), error = NULL WHERE id = $1", [event.id]);
    return { httpStatus: 200, status: "processed", detail };
  } catch (err) {
    const message = (err as Error).message.slice(0, 500);
    await db.query("UPDATE webhook_events SET status = 'failed', error = $2 WHERE id = $1", [event.id, message]);
    // 500 hace que Mercado Pago reintente; la conciliación también lo recupera.
    return { httpStatus: 500, status: "failed", detail: message };
  }
}

// ───── Sincronización contra la API (fuente de verdad) ─────
interface OrderRow {
  id: string; business_id: string; status: string; amount_cents: number; currency: string; product_id: string;
}

function mapOrderStatus(current: string, p: MpPayment, amountOk: boolean): string {
  const refunded = toCents(p.transaction_amount_refunded ?? 0);
  if (p.status === "refunded" || p.status === "charged_back") return "refunded";
  if (p.status === "approved") {
    if (!amountOk) return "in_review";
    if (refunded > 0) return "partially_refunded";
    return current === "fulfilled" ? "fulfilled" : "paid";
  }
  if (["fulfilled", "paid", "refunded", "partially_refunded"].includes(current)) return current;
  if (p.status === "rejected" || p.status === "cancelled") return "failed";
  return "pending";
}

async function upsertPayment(q: Queryable, p: MpPayment, link: { orderId: string | null; subscriptionId: string | null }): Promise<string> {
  const net = p.transaction_details?.net_received_amount;
  const { rows } = await q.query<{ id: string }>(
    `INSERT INTO payments (order_id, subscription_id, provider, provider_payment_id, status, status_detail, amount_cents, currency,
       fee_cents, net_cents, refunded_cents, money_release_date, money_release_status, payment_method, live_mode, approved_at, verified_at)
     VALUES ($1,$2,'mercadopago',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, now())
     ON CONFLICT (provider, provider_payment_id) DO UPDATE SET
       status = EXCLUDED.status, status_detail = EXCLUDED.status_detail, fee_cents = EXCLUDED.fee_cents,
       net_cents = EXCLUDED.net_cents, refunded_cents = EXCLUDED.refunded_cents, money_release_date = EXCLUDED.money_release_date,
       money_release_status = EXCLUDED.money_release_status, approved_at = COALESCE(payments.approved_at, EXCLUDED.approved_at),
       order_id = COALESCE(payments.order_id, EXCLUDED.order_id), subscription_id = COALESCE(payments.subscription_id, EXCLUDED.subscription_id),
       verified_at = now(), updated_at = now()
     RETURNING id`,
    [link.orderId, link.subscriptionId, String(p.id), p.status, p.status_detail ?? null, toCents(p.transaction_amount), p.currency_id,
     feeCents(p), net === undefined ? null : toCents(net), toCents(p.transaction_amount_refunded ?? 0),
     p.money_release_date ?? null, p.money_release_status ?? null, p.payment_method_id ?? null, !!p.live_mode, p.date_approved ?? null],
  );
  return rows[0]!.id;
}

async function recordPaymentLedger(q: Queryable, businessId: string, paymentRowId: string, orderId: string | null, p: MpPayment, kind: "sale" | "subscription_charge") {
  const amount = toCents(p.transaction_amount);
  const live = !!p.live_mode;
  const occurred = p.date_approved ?? new Date().toISOString();
  if (p.status === "approved" || p.status === "refunded" || p.status === "charged_back") {
    const settled = p.money_release_status === "released";
    const inserted = await recordEntry(q, {
      businessId, kind, direction: "in", amountCents: amount, currency: p.currency_id, state: settled ? "settled" : "collected",
      orderId, paymentId: paymentRowId, liveMode: live, description: `Pago Mercado Pago ${p.id}`, occurredAt: occurred, dedupeKey: `pay:${p.id}:${kind}`,
    });
    if (!inserted && settled) {
      await q.query("UPDATE transactions SET state = 'settled' WHERE dedupe_key = $1 AND state = 'collected'", [`pay:${p.id}:${kind}`]);
    }
    await recordEntry(q, {
      businessId, kind: "provider_fee", direction: "out", amountCents: feeCents(p), currency: p.currency_id, state: "collected",
      orderId, paymentId: paymentRowId, liveMode: live, description: `Comisión Mercado Pago ${p.id}`, occurredAt: occurred, dedupeKey: `pay:${p.id}:fee`,
    });
    await recordEntry(q, {
      businessId, kind: "tax_reserve", direction: "out", amountCents: Math.round((amount * taxReserveBp()) / 10_000), currency: p.currency_id,
      state: "reserved", orderId, paymentId: paymentRowId, liveMode: live,
      description: "Reserva estimada de impuestos (pendiente de determinar con contador)", occurredAt: occurred, dedupeKey: `pay:${p.id}:tax`,
    });
  }
  const refunded = toCents(p.transaction_amount_refunded ?? 0) || (p.status === "refunded" || p.status === "charged_back" ? amount : 0);
  if (refunded > 0) {
    const prev = await q.query<{ total: number }>(
      "SELECT COALESCE(sum(amount_cents),0)::bigint AS total FROM transactions WHERE payment_id = $1 AND kind IN ('refund','chargeback')",
      [paymentRowId],
    );
    const delta = refunded - Number(prev.rows[0]?.total ?? 0);
    await recordEntry(q, {
      businessId, kind: p.status === "charged_back" ? "chargeback" : "refund", direction: "out", amountCents: delta, currency: p.currency_id,
      state: "collected", orderId, paymentId: paymentRowId, liveMode: live, description: `Devolución del pago ${p.id}`,
      occurredAt: new Date().toISOString(), dedupeKey: `pay:${p.id}:refund:${refunded}`,
    });
  }
}

/** Consulta un pago en Mercado Pago y actualiza pedido, pago, libro y entrega. Idempotente. */
export async function syncPayment(db: Db, providerPaymentId: string): Promise<string> {
  const p = await mp().getPayment(providerPaymentId);
  const orderId = typeof p.external_reference === "string" && /^[0-9a-f-]{36}$/.test(p.external_reference) ? p.external_reference : null;

  const outcome = await db.tx(async (q) => {
    const o = orderId ? await q.query<OrderRow>("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [orderId]) : { rows: [] as OrderRow[] };
    const order = o.rows[0];
    if (!order) {
      await audit(q, { actorType: "webhook", actorId: "mercadopago", action: "payment.unmatched", severity: "warning", metadata: { paymentId: String(p.id), status: p.status } });
      return { action: "unmatched" as const, orderId: null };
    }
    const amountOk = toCents(p.transaction_amount) === order.amount_cents && p.currency_id === order.currency;
    const sub = await q.query<{ id: string }>("SELECT id FROM subscriptions WHERE order_id = $1", [order.id]);
    const subscriptionId = sub.rows[0]?.id ?? null;
    const paymentRowId = await upsertPayment(q, p, { orderId: order.id, subscriptionId });
    // En suscripciones, el pedido solo pasa de pendiente a pagado; los cobros posteriores
    // (y sus devoluciones) se registran en el libro sin cambiar el pedido de alta.
    let next = mapOrderStatus(order.status, p, amountOk);
    if (subscriptionId && !(order.status === "pending" && ["paid", "in_review", "failed"].includes(next))) next = order.status;
    if (subscriptionId && next === "paid") {
      await q.query("UPDATE subscriptions SET status = 'authorized', live_mode = $2, updated_at = now() WHERE id = $1 AND status = 'pending'", [subscriptionId, !!p.live_mode]);
    }
    if (next !== order.status) {
      await q.query(
        `UPDATE orders SET status = $2, live_mode = $3, updated_at = now(),
           paid_at = CASE WHEN $2 IN ('paid','in_review') AND paid_at IS NULL THEN now() ELSE paid_at END WHERE id = $1`,
        [order.id, next, !!p.live_mode],
      );
      await audit(q, { actorType: "webhook", actorId: "mercadopago", action: "order.status_changed", targetType: "order", targetId: order.id,
        severity: next === "in_review" ? "critical" : "info", metadata: { from: order.status, to: next, paymentStatus: p.status, liveMode: !!p.live_mode } });
    }
    if (!amountOk && p.status === "approved") {
      await notifyAdmin(q, {
        subject: "Pago con monto distinto al pedido",
        body: `El pago ${p.id} (${p.transaction_amount} ${p.currency_id}) no coincide con el pedido ${order.id.slice(0, 8)} (${order.amount_cents / 100} ${order.currency}). No se entregó nada.`,
        severity: "critical", dedupeKey: `amount-mismatch:${p.id}`, relatedType: "order", relatedId: order.id,
      });
    } else {
      await recordPaymentLedger(q, order.business_id, paymentRowId, order.id, p, subscriptionId ? "subscription_charge" : "sale");
    }
    if (next === "refunded" && !subscriptionId) {
      await q.query("UPDATE entitlements SET status = 'revoked', updated_at = now() WHERE order_id = $1 AND status = 'active'", [order.id]);
    }
    return { action: next, orderId: order.id };
  });

  if (outcome.action === "paid" && outcome.orderId) {
    try {
      await fulfillOrder(db, outcome.orderId);
    } catch (err) {
      if (!(err instanceof DeliveryBlockedError)) throw err;
      await recordDeliveryFailure(db, outcome.orderId, err.message);
    }
  }
  return `pago ${p.id}: ${p.status} → pedido ${outcome.action}`;
}

/** Suscripción: refleja el estado real del preapproval. */
export async function syncPreapproval(db: Db, preapprovalId: string): Promise<string> {
  const pre = await mp().getPreapproval(preapprovalId);
  return db.tx(async (q) => {
    const { rows } = await q.query<{ id: string; status: string; order_id: string }>(
      `SELECT id, status, order_id FROM subscriptions WHERE provider_subscription_id = $1 OR order_id::text = $2 FOR UPDATE`,
      [pre.id, pre.external_reference ?? ""],
    );
    const sub = rows[0];
    if (!sub) return `preapproval ${pre.id} sin suscripción local`;
    const status = ["pending", "authorized", "paused", "cancelled"].includes(pre.status) ? pre.status : sub.status;
    await q.query(
      `UPDATE subscriptions SET status = $2, provider_subscription_id = $3, next_payment_at = $4, updated_at = now(),
         cancelled_at = CASE WHEN $2 = 'cancelled' AND cancelled_at IS NULL THEN now() ELSE cancelled_at END WHERE id = $1`,
      [sub.id, status, pre.id, pre.next_payment_date ?? null],
    );
    if (status === "cancelled" || status === "paused") {
      // Se respeta el periodo pagado: la licencia vence en la fecha del siguiente cobro.
      await q.query(
        `UPDATE entitlements SET expires_at = COALESCE($2::timestamptz, now()), updated_at = now() WHERE subscription_id = $1 AND status = 'active' AND expires_at IS NULL`,
        [sub.id, pre.next_payment_date ?? null],
      );
    }
    if (status === "authorized") {
      await q.query("UPDATE entitlements SET expires_at = NULL, status = 'active', updated_at = now() WHERE subscription_id = $1 AND status IN ('active','expired')", [sub.id]);
    }
    if (status !== sub.status) {
      await audit(q, { actorType: "webhook", actorId: "mercadopago", action: "subscription.status_changed", targetType: "subscription", targetId: sub.id, metadata: { from: sub.status, to: status } });
    }
    return `preapproval ${pre.id}: ${status}`;
  });
}

/** Cobro recurrente de una suscripción: se verifica el pago real y se entrega en el primer cobro. */
export async function syncAuthorizedPayment(db: Db, authorizedPaymentId: string): Promise<string> {
  const ap = await mp().getAuthorizedPayment(authorizedPaymentId);
  if (!ap.payment?.id) return `cobro ${authorizedPaymentId} sin pago todavía`;
  const p = await mp().getPayment(ap.payment.id);
  const outcome = await db.tx(async (q) => {
    const { rows } = await q.query<{ id: string; order_id: string; business_id: string; amount_cents: number; currency: string }>(
      "SELECT id, order_id, business_id, amount_cents, currency FROM subscriptions WHERE provider_subscription_id = $1 FOR UPDATE",
      [ap.preapproval_id],
    );
    const sub = rows[0];
    if (!sub) return { first: false, orderId: null as string | null, msg: `preapproval ${ap.preapproval_id} desconocido` };
    const amountOk = toCents(p.transaction_amount) === sub.amount_cents && p.currency_id === sub.currency;
    const order = await q.query<{ status: string }>("SELECT status FROM orders WHERE id = $1 FOR UPDATE", [sub.order_id]);
    const firstPayment = order.rows[0]?.status === "pending" && p.status === "approved" && amountOk;
    const paymentRowId = await upsertPayment(q, p, { orderId: firstPayment ? sub.order_id : null, subscriptionId: sub.id });
    if (!amountOk && p.status === "approved") {
      await notifyAdmin(q, { subject: "Cobro de suscripción con monto distinto", body: `Pago ${p.id} no coincide con la suscripción ${sub.id.slice(0, 8)}.`, severity: "critical", dedupeKey: `sub-mismatch:${p.id}` });
      return { first: false, orderId: null, msg: "monto distinto" };
    }
    await recordPaymentLedger(q, sub.business_id, paymentRowId, sub.order_id, p, "subscription_charge");
    if (firstPayment) {
      await q.query("UPDATE orders SET status = 'paid', paid_at = now(), live_mode = $2, updated_at = now() WHERE id = $1", [sub.order_id, !!p.live_mode]);
      await q.query("UPDATE subscriptions SET status = 'authorized', live_mode = $2, updated_at = now() WHERE id = $1", [sub.id, !!p.live_mode]);
    }
    if (p.status === "approved") {
      await q.query("UPDATE entitlements SET status = 'active', expires_at = NULL, updated_at = now() WHERE subscription_id = $1 AND status IN ('active','expired')", [sub.id]);
    }
    return { first: firstPayment, orderId: sub.order_id, msg: `cobro ${p.id}: ${p.status}` };
  });
  if (outcome.first && outcome.orderId) {
    try {
      await fulfillOrder(db, outcome.orderId);
    } catch (err) {
      if (!(err instanceof DeliveryBlockedError)) throw err;
      await recordDeliveryFailure(db, outcome.orderId, err.message);
    }
  }
  return outcome.msg;
}

/**
 * Conciliación: para pedidos pendientes o en revisión, busca pagos por referencia externa
 * (recupera avisos perdidos) y vuelve a verificar pagos pagados recientes. Expira pedidos viejos.
 */
export async function reconcilePayments(db: Db, limit = 25): Promise<{ checked: number; changed: number; expired: number }> {
  const expired = await db.query(
    "UPDATE orders SET status = 'expired', updated_at = now() WHERE status = 'pending' AND expires_at < now() - interval '1 day' RETURNING id",
  );
  const { rows } = await db.query<{ id: string; status: string }>(
    `SELECT id, status FROM orders WHERE status IN ('pending','in_review') AND created_at > now() - interval '7 days'
     ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  let changed = 0;
  for (const o of rows) {
    const found = await mp().searchPaymentsByReference(o.id);
    for (const p of found.results ?? []) {
      const before = o.status;
      await syncPayment(db, String(p.id));
      const after = await db.query<{ status: string }>("SELECT status FROM orders WHERE id = $1", [o.id]);
      if (after.rows[0]?.status !== before) changed++;
    }
  }
  // Pagos cobrados aún no liberados: se vuelve a consultar su estado de liberación.
  const unsettled = await db.query<{ provider_payment_id: string }>(
    `SELECT provider_payment_id FROM payments WHERE status = 'approved' AND COALESCE(money_release_status,'') <> 'released'
       AND order_id IS NOT NULL AND updated_at < now() - interval '6 hours' LIMIT 10`,
  );
  for (const p of unsettled.rows) await syncPayment(db, p.provider_payment_id);
  return { checked: rows.length + unsettled.rows.length, changed, expired: expired.rowCount };
}

// ───── Reembolsos (siempre con aprobación humana) ─────
export async function requestRefund(db: Db, orderId: string, reason: string, requestedBy: string): Promise<string> {
  return db.tx(async (q) => {
    const { rows } = await q.query<{ provider_payment_id: string; amount_cents: number; currency: string }>(
      "SELECT provider_payment_id, amount_cents, currency FROM payments WHERE order_id = $1 AND status = 'approved' ORDER BY created_at LIMIT 1",
      [orderId],
    );
    const pay = rows[0];
    if (!pay) throw new Error("El pedido no tiene un pago aprobado para reembolsar.");
    const a = await q.query<{ id: string }>(
      `INSERT INTO approvals (kind, title, summary, payload, risk, requested_by, dedupe_key, expires_at)
       VALUES ('payment.refund', $1, $2, $3, 'high', $4, $5, now() + interval '14 days')
       ON CONFLICT (dedupe_key) DO UPDATE SET summary = EXCLUDED.summary RETURNING id`,
      [`Reembolsar ${(pay.amount_cents / 100).toFixed(2)} ${pay.currency}`, reason.slice(0, 500),
       JSON.stringify({ orderId, providerPaymentId: pay.provider_payment_id, amountCents: pay.amount_cents }), requestedBy, `refund:${orderId}`],
    );
    await audit(q, { actorType: requestedBy.startsWith("agent:") ? "agent" : "user", actorId: requestedBy, action: "refund.requested", targetType: "order", targetId: orderId, metadata: { reason } });
    return a.rows[0]!.id;
  });
}

/** Lo ejecuta el registro de aprobaciones después de que una persona aprueba. */
export async function executeRefund(db: Db, payload: { orderId: string; providerPaymentId: string; amountCents: number }, approvalId: string): Promise<string> {
  const r = await mp().refundPayment(payload.providerPaymentId, payload.amountCents / 100, `refund:${approvalId}`);
  await syncPayment(db, payload.providerPaymentId);
  return `Reembolso ${r.id} (${r.status})`;
}

/** El cliente puede cancelar su suscripción en cualquier momento desde su portal. */
export async function cancelSubscription(db: Db, subscriptionId: string, customerId: string): Promise<void> {
  const { rows } = await db.query<{ provider_subscription_id: string | null; status: string }>(
    "SELECT provider_subscription_id, status FROM subscriptions WHERE id = $1 AND customer_id = $2",
    [subscriptionId, customerId],
  );
  const sub = rows[0];
  if (!sub) throw new Error("Suscripción no encontrada");
  if (sub.status === "cancelled") return;
  if (sub.provider_subscription_id) {
    await mp().cancelPreapproval(sub.provider_subscription_id);
    await syncPreapproval(db, sub.provider_subscription_id);
  }
  await db.tx((q) => audit(q, { actorType: "customer", actorId: customerId, action: "subscription.cancelled_by_customer", targetType: "subscription", targetId: subscriptionId }));
}

export async function notifyIfPaymentsMissing(q: Queryable): Promise<void> {
  if (!paymentsConfigured()) {
    await notifyAdmin(q, { subject: "Pagos sin configurar", body: "Faltan MP_ACCESS_TOKEN y MP_WEBHOOK_SECRET. Nadie puede comprar todavía.", severity: "warning", dedupeKey: `payments-missing:${new Date().toISOString().slice(0, 10)}` });
  }
}
