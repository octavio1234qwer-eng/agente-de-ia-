import { describe, expect, it } from "vitest";
import { buildQuote, CouponError, type CouponRule, type PricedItem } from "@/lib/commerce/pricing";

const now = new Date("2026-11-20T12:00:00Z");
const items: PricedItem[] = [
  { type: "course", id: "a", title: "A", unitPriceCents: 89900, currency: "MXN", courseIds: ["a"] },
  { type: "course", id: "b", title: "B", unitPriceCents: 149900, currency: "MXN", courseIds: ["b"] },
];
const coupon = (over: Partial<CouponRule> = {}): CouponRule => ({
  id: "c1", code: "PROMO", discountType: "percent", discountValue: 10, currency: "MXN", maxRedemptions: null,
  redemptionsCount: 0, perUserLimit: 1, minSubtotalCents: 0, courseIds: null, startsAt: null, expiresAt: null, isActive: true, ...over,
});

describe("buildQuote", () => {
  it("suma el subtotal sin cupón", () => {
    const q = buildQuote(items, null, { now, userRedemptions: 0 });
    expect(q.subtotalCents).toBe(239800);
    expect(q.totalCents).toBe(239800);
    expect(q.discountCents).toBe(0);
  });

  it("aplica un porcentaje y reparte el descuento sin perder centavos", () => {
    const q = buildQuote(items, coupon({ discountValue: 15 }), { now, userRedemptions: 0 });
    expect(q.discountCents).toBe(Math.round(239800 * 0.15));
    expect(q.lines.reduce((s, l) => s + l.discountCents, 0)).toBe(q.discountCents);
    expect(q.totalCents).toBe(q.subtotalCents - q.discountCents);
  });

  it("un cupón fijo nunca deja el total negativo", () => {
    const q = buildQuote([items[0]], coupon({ discountType: "fixed", discountValue: 999999 }), { now, userRedemptions: 0 });
    expect(q.totalCents).toBe(0);
  });

  it("limita el cupón a los cursos indicados", () => {
    const q = buildQuote(items, coupon({ courseIds: ["b"], discountValue: 50 }), { now, userRedemptions: 0 });
    expect(q.lines.find((l) => l.id === "a")!.discountCents).toBe(0);
    expect(q.lines.find((l) => l.id === "b")!.discountCents).toBe(74950);
  });

  it.each<[Partial<CouponRule>, string]>([
    [{ isActive: false }, "no está activo"],
    [{ expiresAt: "2026-11-01T00:00:00Z" }, "expirado"],
    [{ startsAt: "2026-12-01T00:00:00Z" }, "aún no"],
    [{ maxRedemptions: 5, redemptionsCount: 5 }, "límite"],
    [{ minSubtotalCents: 999999 }, "mínimo"],
    [{ courseIds: ["zzz"] }, "no aplica"],
  ])("rechaza cupones inválidos (%o)", (over, msg) => {
    expect(() => buildQuote(items, coupon(over), { now, userRedemptions: 0 })).toThrow(CouponError);
    expect(() => buildQuote(items, coupon(over), { now, userRedemptions: 0 })).toThrow(new RegExp(msg));
  });

  it("respeta el límite por usuario", () => {
    expect(() => buildQuote(items, coupon(), { now, userRedemptions: 1 })).toThrow(/Ya utilizaste/);
  });

  it("rechaza precios inválidos y monedas mezcladas", () => {
    expect(() => buildQuote([{ ...items[0], unitPriceCents: -1 }], null, { now, userRedemptions: 0 })).toThrow();
    expect(() => buildQuote([items[0], { ...items[1], currency: "USD" }], null, { now, userRedemptions: 0 })).toThrow(/moneda/);
  });
});
