/**
 * Cálculo de precios del checkout. Función pura (sin E/S) para poder probarla
 * de forma exhaustiva. Los precios SIEMPRE se leen de la base de datos en el
 * servidor; nunca se aceptan importes enviados por el navegador.
 */

export type PricedItem = {
  type: "course" | "bundle";
  id: string;
  title: string;
  unitPriceCents: number;
  currency: string;
  /** Cursos incluidos (para paquetes) — permite validar cupones por curso. */
  courseIds: string[];
};

export type CouponRule = {
  id: string;
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  currency: string;
  maxRedemptions: number | null;
  redemptionsCount: number;
  perUserLimit: number;
  minSubtotalCents: number;
  courseIds: string[] | null;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
};

export type CouponContext = {
  now: Date;
  userRedemptions: number;
};

export type PricedLine = PricedItem & { discountCents: number; totalCents: number };

export type Quote = {
  currency: string;
  lines: PricedLine[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  coupon: { id: string; code: string } | null;
};

export class CouponError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CouponError";
  }
}

export function validateCoupon(coupon: CouponRule, items: PricedItem[], ctx: CouponContext): PricedItem[] {
  if (!coupon.isActive) throw new CouponError("El cupón no está activo.");
  if (coupon.startsAt && new Date(coupon.startsAt) > ctx.now) throw new CouponError("El cupón aún no está vigente.");
  if (coupon.expiresAt && new Date(coupon.expiresAt) <= ctx.now) throw new CouponError("El cupón ha expirado.");
  if (coupon.maxRedemptions !== null && coupon.redemptionsCount >= coupon.maxRedemptions) {
    throw new CouponError("El cupón alcanzó su límite de usos.");
  }
  if (ctx.userRedemptions >= coupon.perUserLimit) throw new CouponError("Ya utilizaste este cupón.");

  const eligible = coupon.courseIds && coupon.courseIds.length > 0
    ? items.filter((i) => i.courseIds.some((c) => coupon.courseIds!.includes(c)))
    : items;
  if (eligible.length === 0) throw new CouponError("El cupón no aplica a los cursos de tu carrito.");

  const subtotal = items.reduce((s, i) => s + i.unitPriceCents, 0);
  if (subtotal < coupon.minSubtotalCents) throw new CouponError("Tu compra no alcanza el mínimo para este cupón.");
  if (coupon.discountType === "fixed" && coupon.currency.toUpperCase() !== items[0]?.currency.toUpperCase()) {
    throw new CouponError("El cupón no aplica a esta moneda.");
  }
  return eligible;
}

/** Reparte un descuento total entre líneas, proporcional a su precio y sin perder centavos. */
function allocate(total: number, lines: PricedItem[]): Map<string, number> {
  const result = new Map<string, number>();
  const base = lines.reduce((s, l) => s + l.unitPriceCents, 0);
  if (base === 0 || total === 0) {
    lines.forEach((l) => result.set(l.id, 0));
    return result;
  }
  let assigned = 0;
  lines.forEach((l, idx) => {
    const share = idx === lines.length - 1 ? total - assigned : Math.floor((total * l.unitPriceCents) / base);
    const capped = Math.min(share, l.unitPriceCents);
    result.set(l.id, capped);
    assigned += capped;
  });
  return result;
}

export function buildQuote(items: PricedItem[], coupon: CouponRule | null, ctx: CouponContext): Quote {
  if (items.length === 0) throw new Error("El carrito está vacío.");
  const currency = items[0].currency.toUpperCase();
  if (items.some((i) => i.currency.toUpperCase() !== currency)) {
    throw new Error("Todos los productos deben tener la misma moneda.");
  }
  for (const i of items) {
    if (!Number.isInteger(i.unitPriceCents) || i.unitPriceCents < 0) throw new Error("Precio inválido.");
  }

  const subtotalCents = items.reduce((s, i) => s + i.unitPriceCents, 0);
  let discounts = new Map<string, number>();
  let applied: Quote["coupon"] = null;

  if (coupon) {
    const eligible = validateCoupon(coupon, items, ctx);
    const eligibleSubtotal = eligible.reduce((s, i) => s + i.unitPriceCents, 0);
    const raw = coupon.discountType === "percent"
      ? Math.round((eligibleSubtotal * coupon.discountValue) / 100)
      : coupon.discountValue;
    const discountTotal = Math.min(raw, eligibleSubtotal);
    discounts = allocate(discountTotal, eligible);
    applied = { id: coupon.id, code: coupon.code };
  }

  const lines: PricedLine[] = items.map((i) => {
    const d = discounts.get(i.id) ?? 0;
    return { ...i, discountCents: d, totalCents: i.unitPriceCents - d };
  });
  const discountCents = lines.reduce((s, l) => s + l.discountCents, 0);
  return {
    currency,
    lines,
    subtotalCents,
    discountCents,
    totalCents: subtotalCents - discountCents,
    coupon: applied,
  };
}
