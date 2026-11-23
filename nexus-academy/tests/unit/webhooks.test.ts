import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import Stripe from "stripe";
import { verifyMercadoPagoSignature } from "@/lib/payments/mercadopago";

describe("Mercado Pago x-signature", () => {
  const secret = "secreto-de-prueba";
  const sign = (manifest: string) => createHmac("sha256", secret).update(manifest).digest("hex");

  it("acepta una firma válida (id en minúsculas)", () => {
    const ts = "1704908010";
    const v1 = sign("id:12345abc;request-id:req-1;ts:1704908010;");
    expect(verifyMercadoPagoSignature({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: "req-1", dataId: "12345ABC", secret })).toBe(true);
  });

  it("rechaza firmas alteradas, ausentes o de otro pago", () => {
    const v1 = sign("id:999;request-id:req-1;ts:1;");
    expect(verifyMercadoPagoSignature({ xSignature: `ts=1,v1=${v1}`, xRequestId: "req-1", dataId: "998", secret })).toBe(false);
    expect(verifyMercadoPagoSignature({ xSignature: null, xRequestId: "req-1", dataId: "999", secret })).toBe(false);
    expect(verifyMercadoPagoSignature({ xSignature: `ts=1,v1=${"0".repeat(64)}`, xRequestId: "req-1", dataId: "999", secret })).toBe(false);
  });

  it("rechaza notificaciones antiguas (anti-replay)", () => {
    const v1 = sign("id:1;request-id:r;ts:1000;");
    expect(verifyMercadoPagoSignature({ xSignature: `ts=1000,v1=${v1}`, xRequestId: "r", dataId: "1", secret, toleranceSeconds: 600, now: 5_000_000 })).toBe(false);
  });
});

describe("Stripe webhook signature", () => {
  const stripe = new Stripe("sk_test_dummy");
  const secret = "whsec_test_local";
  const payload = JSON.stringify({ id: "evt_1", object: "event", type: "checkout.session.completed", data: { object: {} } });

  it("verifica una firma válida", () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    expect(stripe.webhooks.constructEvent(payload, header, secret).id).toBe("evt_1");
  });

  it("rechaza un cuerpo modificado", () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    expect(() => stripe.webhooks.constructEvent(payload.replace("evt_1", "evt_2"), header, secret)).toThrow();
  });
});
