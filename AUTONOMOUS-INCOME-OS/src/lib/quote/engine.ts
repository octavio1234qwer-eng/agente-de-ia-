// Motor de cálculo de CotizaFácil MX. Puro: sin red ni almacenamiento.
// Todo se calcula en centavos enteros para evitar errores de redondeo.
// Las tasas van en puntos base (bp): 1600 = 16 %.

import { z } from "zod";

export const IVA_OPTIONS = [
  { label: "IVA 16 %", bp: 1600 },
  { label: "IVA 8 % (región fronteriza)", bp: 800 },
  { label: "IVA 0 %", bp: 0 },
  { label: "Exento de IVA", bp: null },
] as const;

/** Retenciones frecuentes cuando una persona física factura a una persona moral. */
export const RETENTION_PRESETS = [
  { label: "Sin retenciones", isrBp: 0, ivaBp: 0 },
  { label: "Honorarios / arrendamiento (ISR 10 %, IVA 2/3)", isrBp: 1000, ivaBp: 1067 },
  { label: "RESICO persona física (ISR 1.25 %, IVA 2/3)", isrBp: 125, ivaBp: 1067 },
] as const;

export const quoteLineSchema = z.object({
  id: z.string().min(1).max(40),
  description: z.string().trim().min(1, "Escribe el concepto").max(500),
  unit: z.string().trim().max(20).default("pza"),
  quantity: z.number().positive().max(1_000_000),
  unitPriceCents: z.number().int().min(0).max(10_000_000_000),
  unitCostCents: z.number().int().min(0).max(10_000_000_000).optional(),
});

export const taxConfigSchema = z.object({
  ivaRateBp: z.number().int().min(0).max(5000).nullable(),
  pricesIncludeIva: z.boolean().default(false),
  isrRetentionBp: z.number().int().min(0).max(5000).default(0),
  ivaRetentionBp: z.number().int().min(0).max(1600).default(0),
});

export const discountSchema = z.object({
  type: z.enum(["none", "percent", "amount"]),
  value: z.number().int().min(0),
});

export type QuoteLine = z.infer<typeof quoteLineSchema>;
export type TaxConfig = z.infer<typeof taxConfigSchema>;
export type Discount = z.infer<typeof discountSchema>;

export interface LineResult {
  id: string;
  totalCents: number;
  costCents: number;
}

export interface QuoteTotals {
  lines: LineResult[];
  subtotalCents: number;
  discountCents: number;
  /** Base gravable (después de descuento, sin IVA). */
  baseCents: number;
  ivaCents: number;
  isrRetentionCents: number;
  ivaRetentionCents: number;
  totalCents: number;
  /** Datos internos: nunca se imprimen en el PDF para el cliente. */
  costCents: number;
  profitCents: number;
  marginBp: number | null;
  markupBp: number | null;
  hasCosts: boolean;
}

/** Redondeo comercial (mitad hacia arriba, simétrico para negativos). */
export function roundHalfUp(n: number): number {
  return Math.sign(n) * Math.round(Math.abs(n) + Number.EPSILON * Math.abs(n));
}

/** Cantidad con hasta 3 decimales × precio en centavos. */
export function lineAmount(quantity: number, unitCents: number): number {
  const milli = Math.round(quantity * 1000);
  return roundHalfUp((milli * unitCents) / 1000);
}

export function applyBp(amountCents: number, bp: number): number {
  return roundHalfUp((amountCents * bp) / 10_000);
}

export function calculateQuote(lines: QuoteLine[], tax: TaxConfig, discount: Discount = { type: "none", value: 0 }): QuoteTotals {
  const lineResults = lines.map((l) => ({
    id: l.id,
    totalCents: lineAmount(l.quantity, l.unitPriceCents),
    costCents: l.unitCostCents === undefined ? 0 : lineAmount(l.quantity, l.unitCostCents),
  }));
  const hasCosts = lines.some((l) => l.unitCostCents !== undefined && l.unitCostCents > 0);
  const subtotal = lineResults.reduce((s, l) => s + l.totalCents, 0);

  let discountCents = 0;
  if (discount.type === "percent") discountCents = applyBp(subtotal, Math.min(discount.value, 10_000));
  if (discount.type === "amount") discountCents = Math.min(discount.value, subtotal);
  const afterDiscount = subtotal - discountCents;

  const rate = tax.ivaRateBp ?? 0;
  let base: number;
  let iva: number;
  if (tax.pricesIncludeIva && rate > 0) {
    // Los precios ya traen IVA: se separa la base para no cobrarlo dos veces.
    base = roundHalfUp((afterDiscount * 10_000) / (10_000 + rate));
    iva = afterDiscount - base;
  } else {
    base = afterDiscount;
    iva = applyBp(base, rate);
  }
  const isr = applyBp(base, tax.isrRetentionBp);
  // La retención de IVA nunca supera el IVA trasladado.
  const ivaRet = Math.min(applyBp(base, tax.ivaRetentionBp), iva);
  const total = base + iva - isr - ivaRet;

  const cost = lineResults.reduce((s, l) => s + l.costCents, 0);
  const profit = base - cost;
  return {
    lines: lineResults,
    subtotalCents: subtotal,
    discountCents,
    baseCents: base,
    ivaCents: iva,
    isrRetentionCents: isr,
    ivaRetentionCents: ivaRet,
    totalCents: total,
    costCents: cost,
    profitCents: profit,
    marginBp: base > 0 && hasCosts ? Math.round((profit * 10_000) / base) : null,
    markupBp: cost > 0 ? Math.round((profit * 10_000) / cost) : null,
    hasCosts,
  };
}

/** Precio para obtener un margen sobre la venta: precio = costo / (1 − margen). */
export function priceForMargin(costCents: number, marginBp: number): number {
  if (marginBp >= 10_000) throw new RangeError("El margen debe ser menor que 100 %");
  return roundHalfUp((costCents * 10_000) / (10_000 - marginBp));
}

/** Precio con un recargo sobre el costo: precio = costo × (1 + recargo). */
export function priceForMarkup(costCents: number, markupBp: number): number {
  return costCents + applyBp(costCents, markupBp);
}

export function formatMXN(cents: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(cents / 100);
}

export function formatPercent(bp: number | null): string {
  if (bp === null) return "—";
  return `${(bp / 100).toLocaleString("es-MX", { maximumFractionDigits: 2 })} %`;
}

/** "1,234.50" → 123450. Acepta coma de miles y punto decimal, o solo coma decimal. */
export function parseMoneyToCents(input: string): number | null {
  const s = input.trim().replace(/[$\s]/g, "");
  if (!s) return null;
  let normalized = s;
  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)) normalized = s.replace(/,/g, "");
  else if (/^\d+,\d{1,2}$/.test(s)) normalized = s.replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [int, dec = ""] = normalized.split(".");
  return Number(int) * 100 + Number(dec.padEnd(2, "0"));
}

export function nextFolio(previous: string | null | undefined, prefix = "COT"): string {
  const m = previous?.match(/(\d+)$/);
  const n = m ? Number(m[1]) + 1 : 1;
  return `${prefix}-${String(n).padStart(4, "0")}`;
}
