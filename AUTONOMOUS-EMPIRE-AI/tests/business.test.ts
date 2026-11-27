import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import type { Db } from "../core/db";
import { freshDb, owner } from "./helpers";
import { captureLead } from "../businesses/cotizafacil-mx/leads";
import { handleMercadoPagoWebhook } from "../businesses/cotizafacil-mx/payments";
import { verifyWebhookSignature } from "../infrastructure/integrations/mercadopago";
import { createLink, importCommissionsCsv, resolveAndRecordClick } from "../businesses/affiliate-engine/links";
import { syncGumroad } from "../businesses/digital-products/sync";
import { sendApprovedEmails } from "../infrastructure/integrations/email";

let db: Db;
beforeEach(async () => { db = await freshDb(); });
afterEach(async () => { await db.close(); });

const lead = { name: "Ana Pérez", email: "Ana@Example.com", phone: "+52 55 1234 5678", trade: "plomería", quotesPerMonth: 20, willingnessToPayMxn: 199, need: "Hago cotizaciones a mano en libreta y las mando por foto en WhatsApp", consentContact: true };

describe("CotizaFácil MX — captación", () => {
  it("guarda un lead válido con consentimiento y puntuación", async () => {
    const r = await captureLead(db, lead);
    expect(r.ok).toBe(true);
    const row = (await db.query<{ email: string; score: number; willingness_to_pay_cents: string }>("select email, score, willingness_to_pay_cents from leads")).rows[0]!;
    expect(row.email).toBe("ana@example.com");
    expect(Number(row.willingness_to_pay_cents)).toBe(19900);
    expect(row.score).toBeGreaterThan(50);
  });
  it("rechaza sin consentimiento, honeypot y datos inválidos", async () => {
    expect((await captureLead(db, { ...lead, consentContact: false })).ok).toBe(false);
    expect((await captureLead(db, { ...lead, website: "spam" })).ok).toBe(false);
    expect((await captureLead(db, { ...lead, email: "no-es-correo" })).ok).toBe(false);
  });
  it("no duplica leads por correo", async () => {
    await captureLead(db, lead);
    const r = await captureLead(db, { ...lead, email: "ana@example.com" });
    expect(r.ok && r.duplicate).toBe(true);
    expect((await db.query("select * from leads")).rows.length).toBe(1);
  });
  it("limita la tasa por visitante", async () => {
    const results = [];
    for (let i = 0; i < 6; i++) results.push(await captureLead(db, { ...lead, email: `u${i}@example.com` }, { visitorHash: "v1" }));
    expect(results.slice(0, 5).every((r) => r.ok)).toBe(true);
    expect(results[5]).toMatchObject({ ok: false, status: 429 });
  });
});

function sign(secret: string, dataId: string, reqId: string, ts: string) {
  const v1 = createHmac("sha256", secret).update(`id:${dataId};request-id:${reqId};ts:${ts};`).digest("hex");
  return `ts=${ts},v1=${v1}`;
}

describe("Mercado Pago", () => {
  const secret = "test-secret";
  it("verifica firma", () => {
    const ts = String(Date.now());
    expect(verifyWebhookSignature({ xSignature: sign(secret, "123", "r1", ts), xRequestId: "r1", dataId: "123", secret })).toBe(true);
    expect(verifyWebhookSignature({ xSignature: sign("otro", "123", "r1", ts), xRequestId: "r1", dataId: "123", secret })).toBe(false);
    expect(verifyWebhookSignature({ xSignature: sign(secret, "123", "r1", ts), xRequestId: "r1", dataId: "124", secret })).toBe(false);
  });
  it("registra solo pagos aprobados verificados vía API, una vez", async () => {
    const ts = String(Date.now());
    const req = { xSignature: sign(secret, "987", "r2", ts), xRequestId: "r2", dataId: "987", type: "payment" };
    const fetchPayment = async () => ({ id: 987, status: "approved", transaction_amount: 149, currency_id: "MXN", date_approved: new Date().toISOString(), external_reference: "cotizafacil-mx:lead1", description: "Piloto", fee_details: [{ amount: 6.5 }] });
    expect((await handleMercadoPagoWebhook(db, req, { secret, fetchPayment })).body).toBe("registrado");
    expect((await handleMercadoPagoWebhook(db, req, { secret, fetchPayment })).body).toBe("duplicado");
    const pending = async () => ({ ...(await fetchPayment()), id: 988, status: "pending" });
    const req2 = { ...req, dataId: "988", xSignature: sign(secret, "988", "r2", ts) };
    expect((await handleMercadoPagoWebhook(db, req2, { secret, fetchPayment: pending })).body).toBe("estado pending");
    const bad = await handleMercadoPagoWebhook(db, { ...req, xSignature: "ts=1,v1=" + "0".repeat(64) }, { secret, fetchPayment });
    expect(bad.status).toBe(401);
    const rows = (await db.query<{ kind: string; amount_cents: string }>("select kind, amount_cents from ledger_entries order by kind")).rows;
    expect(rows.map((r) => [r.kind, Number(r.amount_cents)])).toEqual([["fee", 650], ["income", 14900]]);
  });
});

describe("Affiliate Engine", () => {
  it("solo acepta dominios oficiales, redirige y cuenta clics", async () => {
    await expect(createLink(db, owner, { slug: "x-1", title: "Prueba", destinationUrl: "https://evil.example.com/a" })).rejects.toThrow();
    await createLink(db, owner, { slug: "taladro-1", title: "Taladro", destinationUrl: "https://www.mercadolibre.com.mx/p/MLM123" });
    expect(await resolveAndRecordClick(db, "taladro-1", { visitorHash: "h" })).toContain("mercadolibre.com.mx");
    expect(await resolveAndRecordClick(db, "no-existe", {})).toBeNull();
    expect((await db.query("select * from affiliate_clicks")).rows.length).toBe(1);
  });
  it("un viewer no puede crear enlaces", async () => {
    await expect(createLink(db, { id: "user:v", role: "viewer" }, { slug: "abc", title: "abc", destinationUrl: "https://meli.la/abc" })).rejects.toThrow();
  });
  it("importa comisiones como estimadas, nunca reales", async () => {
    const r = await importCommissionsCsv(db, "order_id,date,commission_mxn,status\nA1,2026-11-01,35.50,pendiente\nA2,2026-11-02,10,cancelada", "t");
    expect(r.imported).toBe(1);
    const row = (await db.query<{ nature: string }>("select nature from ledger_entries")).rows[0]!;
    expect(row.nature).toBe("estimated");
  });
});

describe("Digital Products — Gumroad", () => {
  it("concilia ventas sin duplicar y excluye reembolsos", async () => {
    const fakeFetch = (async (url: string) => {
      const body = url.includes("/products")
        ? { success: true, products: [{ id: "p1", name: "Plantilla", price: 700, currency: "usd", published: true, short_url: "https://x.gumroad.com/l/a" }] }
        : { success: true, sales: [
            { id: "s1", created_at: "2026-11-20T10:00:00Z", product_name: "Plantilla", product_id: "p1", price: 700, gumroad_fee: 105 },
            { id: "s2", created_at: "2026-11-21T10:00:00Z", product_name: "Plantilla", product_id: "p1", price: 700, refunded: true },
          ] };
      return new Response(JSON.stringify(body), { status: 200 });
    }) as unknown as typeof fetch;
    const r1 = await syncGumroad(db, { fetchFn: fakeFetch });
    const r2 = await syncGumroad(db, { fetchFn: fakeFetch });
    expect(r1.inserted).toBe(1);
    expect(r2.inserted).toBe(0);
    const inc = (await db.query<{ currency: string }>("select currency from ledger_entries where kind='income'")).rows;
    expect(inc).toEqual([{ currency: "USD" }]);
    expect((await db.query("select * from products")).rows.length).toBe(1);
  });
});

describe("Correo", () => {
  it("solo envía aprobados, con consentimiento y respetando el tope", async () => {
    await captureLead(db, lead);
    const l = (await db.query<{ id: string }>("select id from leads")).rows[0]!;
    for (let i = 0; i < 3; i++) await db.query("insert into email_outbox(lead_id, to_email, subject, body, status, created_by) values ($1,'ana@example.com','s','b',$2,'t')", [l.id, i === 2 ? "draft" : "approved"]);
    process.env.EMAIL_DAILY_CAP = "1";
    const sent: string[] = [];
    const r = await sendApprovedEmails(db, async (m) => { sent.push(m.to); });
    expect(r.sent).toBe(1);
    expect(sent.length).toBe(1);
    delete process.env.EMAIL_DAILY_CAP;
  });
});
