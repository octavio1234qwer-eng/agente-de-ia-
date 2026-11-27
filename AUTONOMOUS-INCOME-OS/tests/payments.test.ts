import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "./helpers/db";
import { createFakeMp } from "./helpers/fake-mp";
import { signForTests, verifyWebhookSignature } from "@/server/payments/mercadopago";
import {
  cancelSubscription, createCheckout, executeRefund, handleMercadoPagoWebhook, reconcilePayments, requestRefund, setMpClientForTests,
} from "@/server/payments/service";
import { findActiveLicense } from "@/server/licenses";
import { currentLicenseKey } from "@/server/delivery/service";
import { financeSummary } from "@/server/finance/ledger";
import { setKillSwitch } from "@/server/settings";
import type { Db } from "@/server/db";

const SECRET = "secreto-de-prueba";

async function publish(db: Db, slug: string) {
  await db.query("UPDATE products SET status = 'published' WHERE slug = $1", [slug]);
}

function webhook(db: Db, topic: string, id: string, requestId = crypto.randomUUID(), secret = SECRET, bodyOverride?: unknown) {
  const ts = String(Math.floor(Date.now() / 1000));
  return handleMercadoPagoWebhook(db, {
    query: new URLSearchParams({ "data.id": id, type: topic }),
    headers: { xSignature: signForTests(secret, id, requestId, ts), xRequestId: requestId },
    body: bodyOverride ?? { type: topic, action: `${topic}.updated`, data: { id } },
  });
}

async function count(db: Db, sql: string, params: unknown[] = []) {
  const { rows } = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM (${sql}) x`, params);
  return rows[0]!.n;
}

let fake: ReturnType<typeof createFakeMp>;
beforeEach(() => {
  process.env.MP_WEBHOOK_SECRET = SECRET;
  process.env.MP_ACCESS_TOKEN = "TEST-token";
  process.env.APP_URL = "https://cotiza.example";
  delete process.env.PAYMENTS_ALLOW_TEST;
  fake = createFakeMp();
  setMpClientForTests(fake.client);
});
afterEach(() => setMpClientForTests(null));

describe("firma de webhooks", () => {
  it("coincide con un vector calculado de forma independiente (HMAC-SHA256 en Python)", () => {
    const ok = verifyWebhookSignature({
      xSignature: "ts=1742505638,v1=0ac61d7460ad40b8274154d480447f0a28a04466d1f612d3a8ecbbae1fddbebb",
      xRequestId: "bb56a2f1-6aae-46ac-982e-9dcd3581d08e", dataId: "123456", secret: SECRET,
    });
    expect(ok).toEqual({ ok: true });
  });
  it("rechaza firmas alteradas, sin secreto o sin encabezado", () => {
    const base = { xRequestId: "r", dataId: "1", secret: SECRET };
    expect(verifyWebhookSignature({ ...base, xSignature: signForTests(SECRET, "2", "r", "1") })).toMatchObject({ ok: false, reason: "mismatch" });
    expect(verifyWebhookSignature({ ...base, xSignature: signForTests("otro", "1", "r", "1") })).toMatchObject({ ok: false, reason: "mismatch" });
    expect(verifyWebhookSignature({ ...base, xSignature: null })).toMatchObject({ ok: false, reason: "missing_header" });
    expect(verifyWebhookSignature({ ...base, xSignature: "v1=abc" })).toMatchObject({ ok: false, reason: "missing_ts" });
    expect(verifyWebhookSignature({ ...base, secret: "", xSignature: signForTests(SECRET, "1", "r", "1") })).toMatchObject({ ok: false, reason: "missing_secret" });
  });
});

describe("checkout", () => {
  it("no vende productos sin publicar (requieren aprobación)", async () => {
    const db = await createTestDb();
    await expect(createCheckout(db, { productSlug: "cotizafacil-pro", email: "a@b.mx", acceptTerms: true, marketingConsent: false })).rejects.toThrow(/todavía no está a la venta/);
  });

  it("usa el precio de la base de datos y el pedido como referencia externa", async () => {
    const db = await createTestDb();
    await publish(db, "cotizafacil-pro");
    const r = await createCheckout(db, { productSlug: "cotizafacil-pro", email: "Cliente@Ejemplo.mx", acceptTerms: true, marketingConsent: true });
    expect(r.redirectUrl).toMatch(/^https:\/\/www\.mercadopago\.com\.mx\//);
    const pref = fake.calls.find((c) => c.op === "createPreference")!.arg as { items: { unit_price: number }[]; external_reference: string; notification_url: string };
    expect(pref.items[0]!.unit_price).toBe(149);
    expect(pref.external_reference).toBe(r.orderId);
    expect(pref.notification_url).toBe("https://cotiza.example/api/webhooks/mercadopago?source_news=webhooks");
    const o = await db.query<{ status: string; buyer_email: string; checkout_token_hash: string }>("SELECT * FROM orders WHERE id = $1", [r.orderId]);
    expect(o.rows[0]).toMatchObject({ status: "pending", buyer_email: "cliente@ejemplo.mx" });
    expect(o.rows[0]!.checkout_token_hash).not.toBe(r.checkoutToken);
  });

  it("el interruptor general detiene las ventas", async () => {
    const db = await createTestDb();
    await publish(db, "cotizafacil-pro");
    await setKillSwitch(db, true, "prueba", { type: "user", id: "admin" });
    await expect(createCheckout(db, { productSlug: "cotizafacil-pro", email: "a@b.mx", acceptTerms: true, marketingConsent: false })).rejects.toThrow(/pausadas/);
  });
});

describe("pago único de punta a punta", () => {
  async function paidOrder() {
    const db = await createTestDb();
    await publish(db, "cotizafacil-pro");
    const r = await createCheckout(db, { productSlug: "cotizafacil-pro", email: "c@ejemplo.mx", acceptTerms: true, marketingConsent: false });
    return { db, orderId: r.orderId };
  }

  it("una firma inválida no cambia nada", async () => {
    const { db, orderId } = await paidOrder();
    fake.addPayment({ id: 555, external_reference: orderId, transaction_amount: 149 });
    const out = await webhook(db, "payment", "555", "req-1", "secreto-falso");
    expect(out).toMatchObject({ httpStatus: 401, status: "rejected" });
    expect(await count(db, "SELECT 1 FROM entitlements")).toBe(0);
    expect(fake.calls.some((c) => c.op === "getPayment")).toBe(false);
  });

  it("verifica con la API, entrega una sola vez y registra el libro sin duplicados", async () => {
    const { db, orderId } = await paidOrder();
    fake.addPayment({ id: 777, external_reference: orderId, transaction_amount: 149 });
    const first = await webhook(db, "payment", "777", "req-A");
    expect(first).toMatchObject({ httpStatus: 200, status: "processed" });
    const order = await db.query<{ status: string }>("SELECT status FROM orders WHERE id = $1", [orderId]);
    expect(order.rows[0]!.status).toBe("fulfilled");

    const ent = await db.query<{ id: string }>("SELECT id FROM entitlements WHERE order_id = $1", [orderId]);
    const key = await currentLicenseKey(db, ent.rows[0]!.id);
    expect(key).toMatch(/^CF-[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/);
    const lic = await findActiveLicense(db, key!.toLowerCase());
    expect(lic?.features).toEqual(["cotizafacil_pro"]);

    // Mismo aviso repetido y otro aviso distinto del mismo pago: sin efectos duplicados.
    expect(await webhook(db, "payment", "777", "req-A")).toMatchObject({ status: "duplicate" });
    await webhook(db, "payment", "777", "req-B");
    expect(await count(db, "SELECT 1 FROM entitlements")).toBe(1);
    expect(await count(db, "SELECT 1 FROM transactions WHERE kind = 'sale'")).toBe(1);
    expect(await count(db, "SELECT 1 FROM payments")).toBe(1);

    const now = new Date();
    const s = await financeSummary(db, new Date(now.getTime() - 86_400_000), new Date(now.getTime() + 86_400_000));
    expect(s.grossCollectedCents).toBe(14900);
    expect(s.feesCents).toBe(595);
    expect(s.netCents).toBe(14900 - 595);
    expect(s.settledCents).toBe(0);
    expect(s.taxReserveCents).toBe(Math.round((14900 * 1379) / 10000));
  });

  it("ignora lo que dice el aviso: si la API dice pendiente, no entrega", async () => {
    const { db, orderId } = await paidOrder();
    fake.addPayment({ id: 801, external_reference: orderId, transaction_amount: 149, status: "pending" });
    await webhook(db, "payment", "801", "r", SECRET, { type: "payment", action: "payment.updated", data: { id: "801" }, status: "approved" });
    const o = await db.query<{ status: string }>("SELECT status FROM orders WHERE id = $1", [orderId]);
    expect(o.rows[0]!.status).toBe("pending");
    expect(await count(db, "SELECT 1 FROM entitlements")).toBe(0);
  });

  it("monto distinto: pedido en revisión, sin entrega y alerta crítica", async () => {
    const { db, orderId } = await paidOrder();
    fake.addPayment({ id: 802, external_reference: orderId, transaction_amount: 1.49 });
    await webhook(db, "payment", "802");
    const o = await db.query<{ status: string }>("SELECT status FROM orders WHERE id = $1", [orderId]);
    expect(o.rows[0]!.status).toBe("in_review");
    expect(await count(db, "SELECT 1 FROM entitlements")).toBe(0);
    expect(await count(db, "SELECT 1 FROM notifications WHERE severity = 'critical'")).toBe(1);
    expect(await count(db, "SELECT 1 FROM transactions")).toBe(0);
  });

  it("un pago de prueba no se entrega en producción ni cuenta como venta", async () => {
    const { db, orderId } = await paidOrder();
    process.env.PAYMENTS_ALLOW_TEST = "false";
    fake.addPayment({ id: 803, external_reference: orderId, transaction_amount: 149, live_mode: false });
    await webhook(db, "payment", "803");
    expect(await count(db, "SELECT 1 FROM entitlements")).toBe(0);
    expect(await count(db, "SELECT 1 FROM deliveries WHERE status = 'failed'")).toBe(1);
    const s = await financeSummary(db, new Date(0), new Date(Date.now() + 86_400_000));
    expect(s.grossCollectedCents).toBe(0);
    expect(s.testPaymentsCount).toBe(1);
  });

  it("reembolso: requiere aprobación, revoca la licencia y registra la devolución", async () => {
    const { db, orderId } = await paidOrder();
    fake.addPayment({ id: 900, external_reference: orderId, transaction_amount: 149 });
    await webhook(db, "payment", "900");
    const approvalId = await requestRefund(db, orderId, "El cliente lo pidió", "user:admin");
    expect(fake.calls.some((c) => c.op === "refundPayment")).toBe(false);
    await executeRefund(db, { orderId, providerPaymentId: "900", amountCents: 14900 }, approvalId);
    const o = await db.query<{ status: string }>("SELECT status FROM orders WHERE id = $1", [orderId]);
    expect(o.rows[0]!.status).toBe("refunded");
    const e = await db.query<{ status: string }>("SELECT status FROM entitlements WHERE order_id = $1", [orderId]);
    expect(e.rows[0]!.status).toBe("revoked");
    const s = await financeSummary(db, new Date(0), new Date(Date.now() + 86_400_000));
    expect(s.refundsCents).toBe(14900);
  });

  it("la conciliación recupera un aviso perdido", async () => {
    const { db, orderId } = await paidOrder();
    fake.addPayment({ id: 950, external_reference: orderId, transaction_amount: 149 });
    const r = await reconcilePayments(db);
    expect(r.changed).toBe(1);
    const o = await db.query<{ status: string }>("SELECT status FROM orders WHERE id = $1", [orderId]);
    expect(o.rows[0]!.status).toBe("fulfilled");
  });
});

describe("suscripciones", () => {
  it("entrega con el primer cobro verificado, registra cobros sin duplicar y respeta la cancelación", async () => {
    const db = await createTestDb();
    await publish(db, "cotizafacil-nube");
    const r = await createCheckout(db, { productSlug: "cotizafacil-nube", email: "s@ejemplo.mx", acceptTerms: true, marketingConsent: false });
    const pre = [...fake.preapprovals.values()][0]!;
    expect(pre.external_reference).toBe(r.orderId);

    pre.status = "authorized";
    pre.next_payment_date = new Date(Date.now() + 30 * 86_400_000).toISOString();
    await webhook(db, "subscription_preapproval", pre.id);
    expect(await count(db, "SELECT 1 FROM entitlements")).toBe(0); // autorizado ≠ cobrado

    fake.addPayment({ id: 1, external_reference: r.orderId, transaction_amount: 49 });
    fake.authorized.set("ap1", { id: "ap1", preapproval_id: pre.id, payment: { id: 1, status: "approved" } });
    await webhook(db, "subscription_authorized_payment", "ap1");
    // Mercado Pago también avisa el mismo cobro como "payment": no debe duplicarse.
    await webhook(db, "payment", "1");
    const ent = await db.query<{ id: string; feature: string }>("SELECT id, feature FROM entitlements");
    expect(ent.rows).toHaveLength(1);
    expect(ent.rows[0]!.feature).toBe("cotizafacil_nube");
    expect(await count(db, "SELECT 1 FROM transactions WHERE kind IN ('sale','subscription_charge')")).toBe(1);

    fake.addPayment({ id: 2, external_reference: r.orderId, transaction_amount: 49 });
    fake.authorized.set("ap2", { id: "ap2", preapproval_id: pre.id, payment: { id: 2, status: "approved" } });
    await webhook(db, "subscription_authorized_payment", "ap2");
    expect(await count(db, "SELECT 1 FROM transactions WHERE kind = 'subscription_charge'")).toBe(2);

    const sub = await db.query<{ id: string; customer_id: string }>("SELECT id, customer_id FROM subscriptions");
    await cancelSubscription(db, sub.rows[0]!.id, sub.rows[0]!.customer_id);
    const after = await db.query<{ status: string; expires_at: Date | null }>("SELECT status, expires_at FROM entitlements");
    expect(after.rows[0]!.status).toBe("active");
    expect(after.rows[0]!.expires_at).not.toBeNull(); // conserva el periodo pagado
  });
});
