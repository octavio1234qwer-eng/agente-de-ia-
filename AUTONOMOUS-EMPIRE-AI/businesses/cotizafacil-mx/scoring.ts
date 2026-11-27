/** Puntuación 0–100 de un lead según señales de dolor y disposición de pago declaradas. */
export const PILOT_PRICE_CENTS = 14900; // hipótesis: $149 MXN/mes (sin validar; ver VALIDATION.md)

export function scoreLead(l: {
  quotesPerMonth: number | null; willingnessToPayCents: number | null; need: string;
  hasPhone: boolean; hasCompany: boolean; trade: string | null;
}): number {
  let s = 0;
  const q = l.quotesPerMonth ?? 0;
  s += q >= 30 ? 30 : q >= 10 ? 22 : q >= 4 ? 12 : q > 0 ? 5 : 0;
  const w = l.willingnessToPayCents ?? 0;
  s += w >= PILOT_PRICE_CENTS * 2 ? 35 : w >= PILOT_PRICE_CENTS ? 28 : w > 0 ? 12 : 0;
  s += Math.min(15, Math.floor(l.need.trim().length / 20) * 3);
  if (l.hasPhone) s += 8;
  if (l.hasCompany) s += 6;
  if (l.trade) s += 6;
  return Math.min(100, s);
}
