import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPurchaseEmail } from "@/lib/email/automations";
import type { Database } from "@/lib/database.types";

type PaymentProvider = Database["public"]["Enums"]["payment_provider"];

/**
 * Confirma una orden pagada (idempotente). Solo se llama desde webhooks con
 * firma verificada o tras una captura confirmada por la API del proveedor.
 * El importe recibido se compara con el total de la orden en la base de datos.
 */
export async function fulfillOrder(p: { orderId: string; providerPaymentId: string; amountCents: number; currency: string }) {
  const admin = createAdminClient();
  const { data: newlyPaid, error } = await admin.rpc("fulfill_order", {
    p_order_id: p.orderId,
    p_provider_payment_id: p.providerPaymentId,
    p_amount_cents: p.amountCents,
    p_currency: p.currency,
  });
  if (error) {
    if (/amount_mismatch/.test(error.message)) {
      await admin
        .from("orders")
        .update({ failure_reason: `amount_mismatch: recibido ${p.amountCents} ${p.currency.toUpperCase()} (pago ${p.providerPaymentId})` })
        .eq("id", p.orderId)
        .eq("status", "pending");
    }
    throw new Error(`fulfill_order: ${error.message}`);
  }
  if (newlyPaid) {
    // El correo no debe bloquear ni revertir la confirmación del pago.
    await sendPurchaseEmail(p.orderId).catch((e) => console.error("[fulfillment] correo de compra", e));
  }
  return { newlyPaid: Boolean(newlyPaid) };
}

export async function markOrderStatus(orderId: string, status: "failed" | "expired" | "cancelled", reason?: string) {
  const admin = createAdminClient();
  await admin
    .from("orders")
    .update({ status, failure_reason: reason ?? null })
    .eq("id", orderId)
    .eq("status", "pending");
}

export async function recordRefund(p: { orderId: string; amountCents: number; providerRefundId: string | null; reason?: string; actorId?: string | null }) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("record_refund", {
    p_order_id: p.orderId,
    p_amount_cents: p.amountCents,
    p_provider_refund_id: p.providerRefundId as string,
    p_reason: p.reason ?? (null as unknown as string),
    p_actor: p.actorId ?? (null as unknown as string),
  });
  if (error) throw new Error(`record_refund: ${error.message}`);
  return data;
}

/**
 * Registra el evento del webhook. Devuelve false si ya se procesó antes
 * (protección contra reenvíos y ataques de repetición).
 */
export async function claimPaymentEvent(provider: PaymentProvider, eventId: string, eventType: string, payload: unknown) {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("payment_events")
    .select("id, processed_at")
    .eq("provider", provider)
    .eq("event_id", eventId)
    .maybeSingle();
  if (existing?.processed_at) return { alreadyProcessed: true, id: existing.id };
  if (existing) return { alreadyProcessed: false, id: existing.id };
  const { data, error } = await admin
    .from("payment_events")
    .insert({ provider, event_id: eventId, event_type: eventType, payload: payload as Database["public"]["Tables"]["payment_events"]["Insert"]["payload"] })
    .select("id")
    .single();
  if (error) {
    // Carrera con otra entrega simultánea del mismo evento.
    return { alreadyProcessed: true, id: null };
  }
  return { alreadyProcessed: false, id: data.id };
}

export async function completePaymentEvent(id: string | null, result: { orderId?: string | null; error?: string | null }) {
  if (!id) return;
  const admin = createAdminClient();
  await admin
    .from("payment_events")
    .update({
      processed_at: result.error ? null : new Date().toISOString(),
      error: result.error ?? null,
      order_id: result.orderId ?? null,
    })
    .eq("id", id);
}
