import type { MercadoPagoClient, MpAuthorizedPayment, MpPayment, MpPreapproval } from "@/server/payments/mercadopago";
import { MercadoPagoError } from "@/server/payments/mercadopago";

/** Mercado Pago simulado en memoria: solo para pruebas, nunca para ventas reales. */
export function createFakeMp() {
  const payments = new Map<string, MpPayment>();
  const preapprovals = new Map<string, MpPreapproval>();
  const authorized = new Map<string, MpAuthorizedPayment>();
  const calls: { op: string; arg: unknown }[] = [];
  let seq = 1000;

  const client: MercadoPagoClient = {
    async createPreference(pref) {
      calls.push({ op: "createPreference", arg: pref });
      const id = `pref-${++seq}`;
      return { id, init_point: `https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=${id}` };
    },
    async getPayment(id) {
      calls.push({ op: "getPayment", arg: id });
      const p = payments.get(String(id));
      if (!p) throw new MercadoPagoError("not found", 404);
      return structuredClone(p);
    },
    async searchPaymentsByReference(ref) {
      return { results: [...payments.values()].filter((p) => p.external_reference === ref) };
    },
    async refundPayment(id, amount) {
      calls.push({ op: "refundPayment", arg: { id, amount } });
      const p = payments.get(String(id))!;
      p.status = "refunded";
      p.transaction_amount_refunded = amount ?? p.transaction_amount;
      return { id: ++seq, amount: amount ?? p.transaction_amount, status: "approved" };
    },
    async createPreapproval(body) {
      calls.push({ op: "createPreapproval", arg: body });
      const id = `pre-${++seq}`;
      const pre: MpPreapproval = { id, status: "pending", external_reference: body.external_reference as string, init_point: `https://www.mercadopago.com.mx/subscriptions/checkout?preapproval_id=${id}` };
      preapprovals.set(id, pre);
      return pre;
    },
    async getPreapproval(id) {
      const p = preapprovals.get(id);
      if (!p) throw new MercadoPagoError("not found", 404);
      return structuredClone(p);
    },
    async cancelPreapproval(id) {
      const p = preapprovals.get(id)!;
      p.status = "cancelled";
      return p;
    },
    async getAuthorizedPayment(id) {
      const a = authorized.get(String(id));
      if (!a) throw new MercadoPagoError("not found", 404);
      return a;
    },
  };

  function addPayment(p: Partial<MpPayment> & { id: number; external_reference: string | null; transaction_amount: number }): MpPayment {
    const full: MpPayment = {
      status: "approved", currency_id: "MXN", live_mode: true, date_approved: new Date().toISOString(),
      fee_details: [{ type: "mercadopago_fee", amount: Math.round(p.transaction_amount * 0.0399 * 100) / 100, fee_payer: "collector" }],
      money_release_status: "pending", ...p,
    };
    payments.set(String(p.id), full);
    return full;
  }

  return { client, payments, preapprovals, authorized, calls, addPayment };
}
