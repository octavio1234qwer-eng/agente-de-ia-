import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { enabledPaymentProviders, siteUrl, type PaymentProviderId } from "@/lib/env";
import type { Profile } from "@/lib/auth";
import { buildQuote, CouponError, type CouponRule, type PricedItem, type Quote } from "./pricing";
import { createStripeCheckout } from "@/lib/payments/stripe";
import { createMercadoPagoCheckout } from "@/lib/payments/mercadopago";
import { createPayPalCheckout } from "@/lib/payments/paypal";
import type { CheckoutRequest } from "@/lib/payments/types";
import { fulfillOrder } from "./fulfillment";

export type ItemRef = { type: "course" | "bundle"; id: string };

export class CheckoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutError";
  }
}

/** Lee precios y disponibilidad desde la base de datos (fuente de verdad). */
export async function loadPricedItems(userId: string, refs: ItemRef[]): Promise<PricedItem[]> {
  const admin = createAdminClient();
  const courseIds = [...new Set(refs.filter((r) => r.type === "course").map((r) => r.id))];
  const bundleIds = [...new Set(refs.filter((r) => r.type === "bundle").map((r) => r.id))];

  const [coursesRes, bundlesRes, enrollRes] = await Promise.all([
    courseIds.length
      ? admin.from("courses").select("id, title, price_cents, currency, status").in("id", courseIds)
      : Promise.resolve({ data: [] as { id: string; title: string; price_cents: number; currency: string; status: string }[] }),
    bundleIds.length
      ? admin.from("bundles").select("id, title, price_cents, currency, status, bundle_courses(course_id)").in("id", bundleIds)
      : Promise.resolve({ data: [] as { id: string; title: string; price_cents: number; currency: string; status: string; bundle_courses: { course_id: string }[] }[] }),
    admin.from("enrollments").select("course_id").eq("user_id", userId).is("revoked_at", null),
  ]);

  const owned = new Set((enrollRes.data ?? []).map((e) => e.course_id));
  const items: PricedItem[] = [];

  for (const c of coursesRes.data ?? []) {
    if (c.status !== "published") throw new CheckoutError(`«${c.title}» no está disponible.`);
    if (c.price_cents === 0) throw new CheckoutError(`«${c.title}» es gratuito: inscríbete desde su página.`);
    if (owned.has(c.id)) throw new CheckoutError(`Ya tienes acceso a «${c.title}».`);
    items.push({ type: "course", id: c.id, title: c.title, unitPriceCents: c.price_cents, currency: c.currency, courseIds: [c.id] });
  }
  for (const b of bundlesRes.data ?? []) {
    if (b.status !== "published") throw new CheckoutError(`El paquete «${b.title}» no está disponible.`);
    const ids = b.bundle_courses.map((bc) => bc.course_id);
    if (ids.length > 0 && ids.every((id) => owned.has(id))) {
      throw new CheckoutError(`Ya tienes todos los cursos del paquete «${b.title}».`);
    }
    items.push({ type: "bundle", id: b.id, title: b.title, unitPriceCents: b.price_cents, currency: b.currency, courseIds: ids });
  }

  // Evita comprar el mismo curso dos veces dentro del mismo carrito.
  const courseItems = items.filter((i) => i.type === "course").map((i) => i.id);
  for (const b of items.filter((i) => i.type === "bundle")) {
    const dup = b.courseIds.find((id) => courseItems.includes(id));
    if (dup) throw new CheckoutError(`El paquete «${b.title}» ya incluye un curso de tu carrito. Quita uno de los dos.`);
  }

  if (items.length !== courseIds.length + bundleIds.length) {
    throw new CheckoutError("Algunos productos ya no existen. Actualiza tu carrito.");
  }
  return items;
}

export async function loadCoupon(code: string, userId: string): Promise<{ rule: CouponRule; userRedemptions: number }> {
  const admin = createAdminClient();
  const normalized = code.trim();
  if (!/^[A-Za-z0-9_-]{3,40}$/.test(normalized)) throw new CouponError("Código de cupón inválido.");
  const { data: c } = await admin.from("coupons").select("*").eq("code", normalized).maybeSingle();
  if (!c) throw new CouponError("El cupón no existe.");
  const { count } = await admin
    .from("coupon_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("coupon_id", c.id)
    .eq("user_id", userId);
  return {
    rule: {
      id: c.id,
      code: String(c.code).toUpperCase(),
      discountType: c.discount_type,
      discountValue: c.discount_value,
      currency: c.currency,
      maxRedemptions: c.max_redemptions,
      redemptionsCount: c.redemptions_count,
      perUserLimit: c.per_user_limit,
      minSubtotalCents: c.min_subtotal_cents,
      courseIds: c.course_ids,
      startsAt: c.starts_at,
      expiresAt: c.expires_at,
      isActive: c.is_active,
    },
    userRedemptions: count ?? 0,
  };
}

export async function quoteFor(userId: string, refs: ItemRef[], couponCode?: string | null): Promise<Quote> {
  const items = await loadPricedItems(userId, refs);
  if (items.length === 0) throw new CheckoutError("Tu carrito está vacío.");
  if (couponCode) {
    const { rule, userRedemptions } = await loadCoupon(couponCode, userId);
    return buildQuote(items, rule, { now: new Date(), userRedemptions });
  }
  return buildQuote(items, null, { now: new Date(), userRedemptions: 0 });
}

export type StartCheckoutResult = { redirectUrl: string; orderId: string };

/**
 * Crea la orden (pendiente) y la sesión de pago en el proveedor elegido.
 * El acceso NO se concede aquí: solo cuando el webhook verificado confirma el pago.
 */
export async function startCheckout(params: {
  user: Profile;
  refs: ItemRef[];
  couponCode?: string | null;
  provider?: PaymentProviderId;
  billingDetails?: Record<string, string> | null;
}): Promise<StartCheckoutResult> {
  const { user, refs, provider } = params;
  const quote = await quoteFor(user.id, refs, params.couponCode);
  const admin = createAdminClient();

  // Compras cubiertas al 100 % por un cupón: no hay cobro que procesar.
  const effectiveProvider = quote.totalCents === 0 ? "free" : provider;
  if (!effectiveProvider) throw new CheckoutError("Elige un método de pago.");
  if (effectiveProvider !== "free" && !enabledPaymentProviders().includes(effectiveProvider)) {
    throw new CheckoutError("Ese método de pago no está disponible en este momento.");
  }

  const { data: order, error } = await admin
    .from("orders")
    .insert({
      user_id: user.id,
      provider: effectiveProvider,
      currency: quote.currency,
      subtotal_cents: quote.subtotalCents,
      discount_cents: quote.discountCents,
      total_cents: quote.totalCents,
      coupon_id: quote.coupon?.id ?? null,
      coupon_code: quote.coupon?.code ?? null,
      customer_email: user.email,
      customer_name: user.full_name || null,
      billing_details: params.billingDetails ?? null,
    })
    .select("id, order_number")
    .single();
  if (error || !order) throw new CheckoutError("No pudimos crear tu pedido. Intenta de nuevo.");

  const { error: itemsError } = await admin.from("order_items").insert(
    quote.lines.map((l) => ({
      order_id: order.id,
      item_type: l.type,
      course_id: l.type === "course" ? l.id : null,
      bundle_id: l.type === "bundle" ? l.id : null,
      title: l.title,
      unit_price_cents: l.unitPriceCents,
      discount_cents: l.discountCents,
      total_cents: l.totalCents,
    })),
  );
  if (itemsError) {
    await admin.from("orders").update({ status: "failed", failure_reason: "order_items_insert_failed" }).eq("id", order.id);
    throw new CheckoutError("No pudimos crear tu pedido. Intenta de nuevo.");
  }

  if (effectiveProvider === "free") {
    await fulfillOrder({ orderId: order.id, providerPaymentId: `free-${order.id}`, amountCents: 0, currency: quote.currency });
    return { orderId: order.id, redirectUrl: `${siteUrl}/checkout/exito?order=${order.id}` };
  }

  const request: CheckoutRequest = {
    orderId: order.id,
    orderNumber: order.order_number,
    currency: quote.currency,
    totalCents: quote.totalCents,
    lines: quote.lines.map((l) => ({ id: l.id, title: l.title, amountCents: l.totalCents })),
    customerEmail: user.email,
    successUrl:
      effectiveProvider === "paypal"
        ? `${siteUrl}/api/payments/paypal/return?order=${order.id}`
        : `${siteUrl}/checkout/exito?order=${order.id}`,
    cancelUrl: `${siteUrl}/checkout/cancelado?order=${order.id}`,
  };

  try {
    const session =
      effectiveProvider === "stripe"
        ? await createStripeCheckout(request)
        : effectiveProvider === "mercadopago"
          ? await createMercadoPagoCheckout(request)
          : await createPayPalCheckout(request);
    await admin.from("orders").update({ provider_session_id: session.providerSessionId }).eq("id", order.id);
    return { orderId: order.id, redirectUrl: session.url };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await admin.from("orders").update({ status: "failed", failure_reason: reason.slice(0, 500) }).eq("id", order.id);
    console.error("[checkout] error del proveedor", effectiveProvider, reason);
    throw new CheckoutError("El proveedor de pagos no respondió. No se realizó ningún cargo; intenta de nuevo.");
  }
}
