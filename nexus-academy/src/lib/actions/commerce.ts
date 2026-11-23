"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { quoteFor, startCheckout, CheckoutError, type ItemRef } from "@/lib/commerce/checkout";
import { CouponError } from "@/lib/commerce/pricing";
import type { ActionState } from "./types";

const uuid = z.uuid();

export async function addToCartAction(itemType: "course" | "bundle", itemId: string, returnPath: string, goToCheckout = false) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnPath)}`);
  if (!uuid.safeParse(itemId).success) return { error: "Producto inválido." };

  const supabase = await createClient();
  if (itemType === "course") {
    const { data: enrolled } = await supabase.from("enrollments").select("id").eq("course_id", itemId).eq("user_id", user.id).is("revoked_at", null).maybeSingle();
    if (enrolled) return { error: "Ya tienes acceso a este curso." };
  }
  const { error } = await supabase.from("cart_items").insert({
    user_id: user.id,
    item_type: itemType,
    course_id: itemType === "course" ? itemId : null,
    bundle_id: itemType === "bundle" ? itemId : null,
  });
  if (error && error.code !== "23505") return { error: "No se pudo añadir al carrito." };
  revalidatePath("/", "layout");
  if (goToCheckout) redirect("/checkout");
  return { success: error?.code === "23505" ? "Ya estaba en tu carrito." : "Añadido al carrito." };
}

export async function removeFromCartAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!uuid.safeParse(id).success) return;
  const supabase = await createClient();
  await supabase.from("cart_items").delete().eq("id", id);
  revalidatePath("/", "layout");
}

async function cartRefs(userId: string): Promise<ItemRef[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("cart_items").select("item_type, course_id, bundle_id").eq("user_id", userId);
  return (data ?? []).map((i) => ({ type: i.item_type, id: (i.course_id ?? i.bundle_id)! }));
}

export type QuoteState = (NonNullable<ActionState> & {
  quote?: { subtotalCents: number; discountCents: number; totalCents: number; currency: string; coupon: string | null };
}) | null;

export async function applyCouponAction(_prev: QuoteState, formData: FormData): Promise<QuoteState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Inicia sesión para continuar." };
  const code = String(formData.get("coupon") ?? "").trim();
  if (!code) return { error: "Escribe un código." };
  try {
    const q = await quoteFor(user.id, await cartRefs(user.id), code);
    return {
      success: `Cupón ${q.coupon?.code} aplicado.`,
      quote: { subtotalCents: q.subtotalCents, discountCents: q.discountCents, totalCents: q.totalCents, currency: q.currency, coupon: q.coupon?.code ?? null },
    };
  } catch (e) {
    if (e instanceof CouponError || e instanceof CheckoutError) return { error: e.message };
    return { error: "No pudimos validar el cupón." };
  }
}

const checkoutSchema = z.object({
  provider: z.enum(["stripe", "mercadopago", "paypal"], { error: "Elige un método de pago." }),
  coupon: z.string().trim().max(40).optional(),
  rfc: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^([A-ZÑ&]{3,4})\d{6}([A-Z\d]{3})$/, "RFC inválido.")
    .optional()
    .or(z.literal("")),
  businessName: z.string().trim().max(200).optional(),
  terms: z.literal("on", { error: "Acepta los términos y la política de reembolsos." }),
});

export async function startCheckoutAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/checkout");
  const parsed = checkoutSchema.safeParse({
    provider: formData.get("provider"),
    coupon: formData.get("coupon") || undefined,
    rfc: formData.get("rfc") || "",
    businessName: formData.get("businessName") || undefined,
    terms: formData.get("terms"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const billing = parsed.data.rfc
    ? { rfc: parsed.data.rfc, razon_social: parsed.data.businessName ?? "" }
    : null;

  let redirectUrl: string;
  try {
    const refs = await cartRefs(user.id);
    if (refs.length === 0) return { error: "Tu carrito está vacío." };
    const result = await startCheckout({ user, refs, couponCode: parsed.data.coupon || null, provider: parsed.data.provider, billingDetails: billing });
    redirectUrl = result.redirectUrl;
  } catch (e) {
    if (e instanceof CouponError || e instanceof CheckoutError) return { error: e.message };
    console.error("[checkout]", e);
    return { error: "No pudimos iniciar el pago. No se realizó ningún cargo." };
  }
  redirect(redirectUrl);
}
