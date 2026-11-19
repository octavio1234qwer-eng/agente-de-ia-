/**
 * Motor de cotizaciones / presupuestos.
 *
 * Orden de cálculo (documentado en docs/FORMULAS.md):
 *  1. importe de línea   = round(cantidad × precio unitario)
 *  2. descuento de línea = round(importe × descuento% / 100)
 *  3. subtotal           = Σ (importe − descuento de línea)
 *  4. descuento global   = round(subtotal × descuentoGlobal% / 100)
 *  5. base gravable      = subtotal − descuento global
 *  6. impuesto (IVA)     = round(base × tasa% / 100)        (si los precios NO incluyen IVA)
 *     Si los precios YA incluyen IVA: base = round(total / (1 + tasa)), impuesto = total − base.
 *  7. total              = base + impuesto
 * La tasa de IVA general en México es 16%; es configurable (0%, 8% en zona fronteriza, etc.).
 */
import { assertCents, roundHalfAwayFromZero, DEFAULT_CURRENCY, type CurrencyCode } from '../../shared/src/money.ts';

export interface QuoteLineInput {
  description: string;
  quantity: number;
  unitPriceCents: number;
  /** Costo unitario opcional para calcular la ganancia interna (no se muestra al cliente). */
  unitCostCents?: number;
  discountPct?: number;
}

export interface QuoteInput {
  lines: QuoteLineInput[];
  globalDiscountPct?: number;
  taxRatePct?: number;
  pricesIncludeTax?: boolean;
  currency?: CurrencyCode;
}

export interface QuoteLineResult extends Required<Omit<QuoteLineInput, 'unitCostCents'>> {
  unitCostCents: number | null;
  grossCents: number;
  discountCents: number;
  netCents: number;
}

export interface QuoteTotals {
  currency: CurrencyCode;
  lines: QuoteLineResult[];
  subtotalCents: number;
  globalDiscountCents: number;
  taxableBaseCents: number;
  taxRatePct: number;
  taxCents: number;
  totalCents: number;
  /** Costo total conocido (solo líneas con costo). */
  knownCostCents: number;
  /** Ganancia estimada antes de impuestos sobre las líneas con costo conocido; null si ninguna tiene costo. */
  estimatedProfitCents: number | null;
}

function pct(value: number | undefined, label: string): number {
  const v = value ?? 0;
  if (!Number.isFinite(v) || v < 0 || v > 100) throw new RangeError(`${label} debe estar entre 0 y 100`);
  return v;
}

export function calculateQuote(input: QuoteInput): QuoteTotals {
  if (!Array.isArray(input.lines) || input.lines.length === 0) throw new RangeError('la cotización necesita al menos una línea');
  if (input.lines.length > 200) throw new RangeError('máximo 200 líneas');
  const taxRatePct = input.taxRatePct ?? 16;
  if (!Number.isFinite(taxRatePct) || taxRatePct < 0 || taxRatePct > 100) throw new RangeError('tasa de impuesto inválida');
  const globalPct = pct(input.globalDiscountPct, 'descuento global');

  const lines: QuoteLineResult[] = input.lines.map((line, i) => {
    if (!line.description || !line.description.trim()) throw new RangeError(`línea ${i + 1}: descripción obligatoria`);
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) throw new RangeError(`línea ${i + 1}: cantidad inválida`);
    assertCents(line.unitPriceCents, `línea ${i + 1}: precio`);
    if (line.unitPriceCents < 0) throw new RangeError(`línea ${i + 1}: precio negativo`);
    if (line.unitCostCents !== undefined) assertCents(line.unitCostCents, `línea ${i + 1}: costo`);
    const discountPct = pct(line.discountPct, `línea ${i + 1}: descuento`);
    const grossCents = roundHalfAwayFromZero(line.quantity * line.unitPriceCents);
    const discountCents = roundHalfAwayFromZero((grossCents * discountPct) / 100);
    return {
      description: line.description.trim(),
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      unitCostCents: line.unitCostCents ?? null,
      discountPct,
      grossCents,
      discountCents,
      netCents: grossCents - discountCents,
    };
  });

  const subtotalCents = lines.reduce((s, l) => s + l.netCents, 0);
  const globalDiscountCents = roundHalfAwayFromZero((subtotalCents * globalPct) / 100);
  const afterDiscount = subtotalCents - globalDiscountCents;

  let taxableBaseCents: number;
  let taxCents: number;
  if (input.pricesIncludeTax) {
    taxableBaseCents = roundHalfAwayFromZero(afterDiscount / (1 + taxRatePct / 100));
    taxCents = afterDiscount - taxableBaseCents;
  } else {
    taxableBaseCents = afterDiscount;
    taxCents = roundHalfAwayFromZero((taxableBaseCents * taxRatePct) / 100);
  }

  const costed = lines.filter((l) => l.unitCostCents !== null);
  const knownCostCents = costed.reduce((s, l) => s + roundHalfAwayFromZero(l.quantity * (l.unitCostCents ?? 0)), 0);
  let estimatedProfitCents: number | null = null;
  if (costed.length > 0) {
    // Ingreso neto (sin IVA) atribuible a las líneas con costo, prorrateando el descuento global.
    const costedNet = costed.reduce((s, l) => s + l.netCents, 0);
    const share = subtotalCents === 0 ? 0 : costedNet / subtotalCents;
    const costedRevenueExTax = roundHalfAwayFromZero(taxableBaseCents * share);
    estimatedProfitCents = costedRevenueExTax - knownCostCents;
  }

  return {
    currency: input.currency ?? DEFAULT_CURRENCY,
    lines,
    subtotalCents,
    globalDiscountCents,
    taxableBaseCents,
    taxRatePct,
    taxCents,
    totalCents: taxableBaseCents + taxCents,
    knownCostCents,
    estimatedProfitCents,
  };
}

/** Texto plano para compartir la cotización por WhatsApp (enlace wa.me con texto codificado). */
export function quoteToWhatsAppText(params: {
  businessName: string;
  quoteNumber: string;
  customerName?: string;
  totals: QuoteTotals;
  validUntil?: string;
  notes?: string;
  format: (cents: number) => string;
}): string {
  const { totals, format } = params;
  const rows = totals.lines.map((l) => `• ${l.quantity} × ${l.description}: ${format(l.netCents)}`);
  const parts: Array<string | false | undefined> = [
    `*${params.businessName}* — Cotización ${params.quoteNumber}`,
    params.customerName && `Cliente: ${params.customerName}`,
    '',
    ...rows,
    '',
    `Subtotal: ${format(totals.subtotalCents)}`,
    totals.globalDiscountCents > 0 && `Descuento: −${format(totals.globalDiscountCents)}`,
    totals.taxRatePct > 0 && `IVA (${totals.taxRatePct}%): ${format(totals.taxCents)}`,
    `*Total: ${format(totals.totalCents)}*`,
    params.validUntil && `Vigencia: ${params.validUntil}`,
    params.notes && `\n${params.notes}`,
  ];
  return parts.filter((p): p is string => typeof p === 'string').join('\n').trim();
}

export function whatsAppShareUrl(text: string, phone?: string): string {
  const digits = phone ? phone.replace(/\D/g, '') : '';
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
