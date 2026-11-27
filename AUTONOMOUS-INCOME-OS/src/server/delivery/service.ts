import { audit } from "../audit.ts";
import { randomToken, sha256 } from "../crypto.ts";
import type { Db, Queryable } from "../db/types.ts";
import { appUrl, allowTestPayments } from "../env.ts";
import { deriveLicenseKey, hashLicenseKey } from "../licenses.ts";
import { notifyAdmin, sendEmail } from "../notifications.ts";

export const PORTAL_LINK_DAYS = 30;

export class DeliveryBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeliveryBlockedError";
  }
}

export async function upsertCustomer(q: Queryable, email: string, consent: { marketing: boolean; source: string }): Promise<string> {
  const { rows } = await q.query<{ id: string }>(
    `INSERT INTO customers (email, marketing_consent, consent_at, consent_source)
     VALUES (lower($1), $2, CASE WHEN $2 THEN now() END, CASE WHEN $2 THEN $3 END)
     ON CONFLICT ((lower(email))) DO UPDATE SET
       marketing_consent = customers.marketing_consent OR EXCLUDED.marketing_consent,
       consent_at = COALESCE(customers.consent_at, EXCLUDED.consent_at),
       consent_source = COALESCE(customers.consent_source, EXCLUDED.consent_source)
     RETURNING id`,
    [email, consent.marketing, consent.source],
  );
  return rows[0]!.id;
}

/** Crea un enlace de acceso al portal (válido 30 días). Solo se guarda el hash. */
export async function createPortalLink(q: Queryable, customerId: string): Promise<string> {
  const token = randomToken(32);
  await q.query(
    `INSERT INTO access_tokens (customer_id, token_hash, purpose, expires_at) VALUES ($1, $2, 'portal_link', now() + make_interval(days => $3::int))`,
    [customerId, sha256(token), PORTAL_LINK_DAYS],
  );
  return `${appUrl()}/cuenta/acceso?t=${token}`;
}

export interface FulfillResult {
  status: "delivered" | "already_delivered";
  entitlementId: string;
  customerId: string;
  licenseKey: string;
  portalUrl: string | null;
  emailSent: boolean;
}

/**
 * Entrega un pedido. Exige (en la misma transacción, con bloqueo del pedido):
 *  1. pedido en estado 'paid' o 'fulfilled';
 *  2. un pago APROBADO, VERIFICADO con la API del proveedor, ligado al pedido, por el monto y moneda exactos;
 *  3. que el pago sea real o que el modo de prueba esté permitido.
 * Un aviso de webhook por sí solo nunca llega aquí: primero pasa por syncPayment.
 */
export async function fulfillOrder(db: Db, orderId: string, opts: { sendEmail?: boolean } = {}): Promise<FulfillResult> {
  const result = await db.tx(async (q) => {
    const o = await q.query<{
      id: string; status: string; product_id: string; buyer_email: string; amount_cents: number; currency: string;
      marketing_consent: boolean; customer_id: string | null; feature: string | null; product_name: string; kind: string;
    }>(
      `SELECT o.*, p.feature, p.name AS product_name, p.kind FROM orders o JOIN products p ON p.id = o.product_id
       WHERE o.id = $1 FOR UPDATE OF o`,
      [orderId],
    );
    const order = o.rows[0];
    if (!order) throw new DeliveryBlockedError("Pedido no encontrado");

    const existing = await q.query<{ id: string; customer_id: string; key_version: number }>(
      "SELECT e.id, e.customer_id, e.key_version FROM entitlements e WHERE e.order_id = $1",
      [orderId],
    );
    if (order.status === "fulfilled" && existing.rows[0]) {
      const e = existing.rows[0];
      return { status: "already_delivered" as const, entitlementId: e.id, customerId: e.customer_id, licenseKey: deriveLicenseKey(e.id, e.key_version), productName: order.product_name, email: order.buyer_email };
    }
    if (order.status !== "paid") throw new DeliveryBlockedError(`El pedido está en estado ${order.status}, no se entrega.`);
    if (!order.feature) throw new DeliveryBlockedError("El producto no tiene un permiso que entregar.");

    const pay = await q.query<{ id: string; live_mode: boolean }>(
      `SELECT id, live_mode FROM payments WHERE order_id = $1 AND status = 'approved' AND verified_at IS NOT NULL
         AND amount_cents = $2 AND currency = $3 ORDER BY verified_at DESC LIMIT 1`,
      [orderId, order.amount_cents, order.currency],
    );
    const payment = pay.rows[0];
    if (!payment) throw new DeliveryBlockedError("No hay un pago aprobado y verificado por el monto exacto.");
    if (!payment.live_mode && !allowTestPayments()) throw new DeliveryBlockedError("Pago de prueba: la entrega está desactivada en producción.");

    const customerId = order.customer_id ?? (await upsertCustomer(q, order.buyer_email, { marketing: order.marketing_consent, source: "checkout" }));
    const sub = await q.query<{ id: string }>("SELECT id FROM subscriptions WHERE order_id = $1", [orderId]);
    const subscriptionId = sub.rows[0]?.id ?? null;

    const ent = await q.query<{ id: string }>(
      `INSERT INTO entitlements (customer_id, product_id, feature, order_id, subscription_id, license_key_hash, license_key_hint)
       VALUES ($1,$2,$3,$4,$5,'pending-' || gen_random_uuid(),'') RETURNING id`,
      [customerId, order.product_id, order.feature, orderId, subscriptionId],
    );
    const entitlementId = ent.rows[0]!.id;
    const licenseKey = deriveLicenseKey(entitlementId, 1);
    await q.query("UPDATE entitlements SET license_key_hash = $2, license_key_hint = $3 WHERE id = $1",
      [entitlementId, hashLicenseKey(licenseKey), licenseKey.slice(-4)]);
    await q.query("UPDATE orders SET status = 'fulfilled', fulfilled_at = now(), customer_id = $2, updated_at = now() WHERE id = $1", [orderId, customerId]);
    if (subscriptionId) await q.query("UPDATE subscriptions SET customer_id = $2 WHERE id = $1", [subscriptionId, customerId]);
    await q.query(
      `INSERT INTO deliveries (order_id, entitlement_id, status, channel, attempts, delivered_at) VALUES ($1,$2,'delivered','portal',1,now())
       ON CONFLICT (order_id) DO UPDATE SET entitlement_id = EXCLUDED.entitlement_id, status = 'delivered', attempts = deliveries.attempts + 1, delivered_at = now(), last_error = NULL`,
      [orderId, entitlementId],
    );
    await audit(q, { actorType: "system", action: "order.fulfilled", targetType: "order", targetId: orderId, metadata: { entitlementId, feature: order.feature, liveMode: payment.live_mode } });
    await notifyAdmin(q, {
      subject: payment.live_mode ? "Venta entregada" : "Pedido de prueba entregado",
      body: `${order.product_name} · ${(order.amount_cents / 100).toFixed(2)} ${order.currency} · pedido ${orderId.slice(0, 8)}`,
      severity: payment.live_mode ? "warning" : "info",
      dedupeKey: `fulfilled:${orderId}`,
      relatedType: "order",
      relatedId: orderId,
    });
    return { status: "delivered" as const, entitlementId, customerId, licenseKey, productName: order.product_name, email: order.buyer_email };
  });

  let portalUrl: string | null = null;
  let emailSent = false;
  if (result.status === "delivered" && opts.sendEmail !== false) {
    portalUrl = await db.tx((q) => createPortalLink(q, result.customerId));
    const r = await sendEmail({
      to: result.email,
      subject: `Tu acceso a ${result.productName}`,
      text: [
        "¡Gracias por tu compra!",
        "",
        `Tu clave de licencia: ${result.licenseKey}`,
        "",
        "Para activarla, abre CotizaFácil MX, entra a Ajustes > Activar Pro y pega la clave.",
        `Tu cuenta (descargas, suscripción y facturas de tu compra): ${portalUrl}`,
        "",
        "Guarda este correo. Si necesitas ayuda, responde a este mensaje.",
      ].join("\n"),
    });
    emailSent = r.sent;
    // El cuerpo con la clave no se guarda: solo el resultado del envío.
    await db.query(
      `INSERT INTO notifications (channel, audience, recipient, subject, body, status, attempts, last_error, related_type, related_id, sent_at)
       VALUES ('email','customer',$1,$2,'(correo de entrega con clave de licencia; contenido no almacenado)',$3,1,$4,'order',$5, CASE WHEN $3 = 'sent' THEN now() END)`,
      [result.email, `Tu acceso a ${result.productName}`, r.sent ? "sent" : r.skipped ? "skipped" : "failed", r.error ?? null, orderId],
    );
  }
  return { status: result.status, entitlementId: result.entitlementId, customerId: result.customerId, licenseKey: result.licenseKey, portalUrl, emailSent };
}

/** Reemplaza la clave de un cliente (p. ej. si la compartió). La anterior deja de funcionar. */
export async function rotateLicenseKey(db: Db, entitlementId: string, actor: string): Promise<string> {
  return db.tx(async (q) => {
    const { rows } = await q.query<{ key_version: number }>(
      "UPDATE entitlements SET key_version = key_version + 1, updated_at = now() WHERE id = $1 RETURNING key_version",
      [entitlementId],
    );
    if (!rows[0]) throw new Error("Licencia no encontrada");
    const key = deriveLicenseKey(entitlementId, rows[0].key_version);
    await q.query("UPDATE entitlements SET license_key_hash = $2, license_key_hint = $3 WHERE id = $1", [entitlementId, hashLicenseKey(key), key.slice(-4)]);
    await audit(q, { actorType: "user", actorId: actor, action: "license.rotated", targetType: "entitlement", targetId: entitlementId, severity: "warning" });
    return key;
  });
}

/** Clave actual de una licencia (solo para su dueño autenticado o la página de confirmación). */
export async function currentLicenseKey(q: Queryable, entitlementId: string): Promise<string | null> {
  const { rows } = await q.query<{ key_version: number }>("SELECT key_version FROM entitlements WHERE id = $1", [entitlementId]);
  return rows[0] ? deriveLicenseKey(entitlementId, rows[0].key_version) : null;
}

/** Pedidos pagados sin entregar (los reintenta el agente de entrega). */
export async function pendingDeliveries(q: Queryable, limit = 20): Promise<string[]> {
  const { rows } = await q.query<{ id: string }>(
    "SELECT id FROM orders WHERE status = 'paid' ORDER BY paid_at LIMIT $1",
    [limit],
  );
  return rows.map((r) => r.id);
}

export async function recordDeliveryFailure(db: Db, orderId: string, error: string): Promise<void> {
  await db.tx(async (q) => {
    const { rows } = await q.query<{ attempts: number }>(
      `INSERT INTO deliveries (order_id, status, attempts, last_error) VALUES ($1, 'failed', 1, $2)
       ON CONFLICT (order_id) DO UPDATE SET status = 'failed', attempts = deliveries.attempts + 1, last_error = EXCLUDED.last_error
       RETURNING attempts`,
      [orderId, error.slice(0, 500)],
    );
    if ((rows[0]?.attempts ?? 0) >= 3) {
      await notifyAdmin(q, { subject: "Entrega fallida", body: `El pedido ${orderId.slice(0, 8)} no se pudo entregar: ${error}`, severity: "critical", dedupeKey: `delivery-failed:${orderId}`, relatedType: "order", relatedId: orderId });
    }
  });
}
