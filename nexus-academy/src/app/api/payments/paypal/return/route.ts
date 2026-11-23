import { NextResponse, type NextRequest } from "next/server";
import { integrations, siteUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { capturePayPalOrder } from "@/lib/payments/paypal";
import { decimalToCents } from "@/lib/payments/types";
import { fulfillOrder } from "@/lib/commerce/fulfillment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PayPal redirige aquí tras la aprobación; la captura se hace en el servidor. */
export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get("order") ?? "";
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const success = new URL(`/checkout/exito?order=${encodeURIComponent(orderId)}`, siteUrl);
  if (!integrations.paypal() || !/^[0-9a-f-]{36}$/i.test(orderId) || !/^[A-Z0-9]+$/.test(token)) {
    return NextResponse.redirect(success);
  }
  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("id, status, provider, provider_session_id").eq("id", orderId).maybeSingle();
  if (!order || order.provider !== "paypal" || order.provider_session_id !== token || order.status !== "pending") {
    return NextResponse.redirect(success);
  }
  try {
    const capture = await capturePayPalOrder(token);
    if (capture?.status === "COMPLETED" && capture.custom_id === order.id) {
      await fulfillOrder({ orderId: order.id, providerPaymentId: capture.id, amountCents: decimalToCents(capture.amount.value), currency: capture.amount.currency_code });
    }
  } catch (err) {
    console.error("[paypal return]", err);
    success.searchParams.set("error", "capture");
  }
  return NextResponse.redirect(success);
}
