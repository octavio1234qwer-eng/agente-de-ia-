/**
 * Calculadoras de precio, ganancia, margen y recargo (CotizaFácil MX).
 *
 * Fórmulas (documentadas también en docs/FORMULAS.md):
 *   ganancia          = precio − costo
 *   margen (%)        = ganancia / precio × 100      → porcentaje SOBRE EL PRECIO DE VENTA
 *   recargo/markup (%) = ganancia / costo × 100      → porcentaje SOBRE EL COSTO
 *   precio por recargo = costo × (1 + recargo/100)
 *   precio por margen  = costo / (1 − margen/100)    (margen < 100%)
 *
 * Ejemplo: costo $100. Recargo 50% → precio $150 (margen 33.33%).
 *          Margen 50% → precio $200 (recargo 100%). No son lo mismo.
 */
import { assertCents, roundHalfAwayFromZero } from '../../shared/src/money.ts';

/** Redondea un porcentaje a 4 decimales para evitar artefactos de coma flotante (28.000000000000004). */
export function roundPct(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function priceFromMarkup(costCents: number, markupPct: number): number {
  assertCents(costCents, 'costo');
  if (costCents < 0) throw new RangeError('el costo no puede ser negativo');
  if (!Number.isFinite(markupPct) || markupPct < -100) throw new RangeError('recargo inválido (mínimo -100%)');
  return roundHalfAwayFromZero(costCents * (1 + markupPct / 100));
}

export function priceFromMargin(costCents: number, marginPct: number): number {
  assertCents(costCents, 'costo');
  if (costCents < 0) throw new RangeError('el costo no puede ser negativo');
  if (!Number.isFinite(marginPct) || marginPct >= 100) {
    throw new RangeError('el margen debe ser menor a 100% (con 100% el precio sería infinito)');
  }
  return roundHalfAwayFromZero(costCents / (1 - marginPct / 100));
}

/** Margen sobre precio de venta, en porcentaje. null si el precio es 0. */
export function marginPct(priceCents: number, costCents: number): number | null {
  assertCents(priceCents, 'precio');
  assertCents(costCents, 'costo');
  if (priceCents === 0) return null;
  return roundPct(((priceCents - costCents) / priceCents) * 100);
}

/** Recargo (markup) sobre costo, en porcentaje. null si el costo es 0. */
export function markupPct(priceCents: number, costCents: number): number | null {
  assertCents(priceCents, 'precio');
  assertCents(costCents, 'costo');
  if (costCents === 0) return null;
  return roundPct(((priceCents - costCents) / costCents) * 100);
}

export function markupToMargin(markup: number): number {
  if (markup <= -100) throw new RangeError('recargo inválido');
  return roundPct((markup / (100 + markup)) * 100);
}

export function marginToMarkup(margin: number): number {
  if (margin >= 100) throw new RangeError('margen inválido');
  return roundPct((margin / (100 - margin)) * 100);
}

export interface ProfitBreakdown {
  priceCents: number;
  costCents: number;
  quantity: number;
  revenueCents: number;
  totalCostCents: number;
  profitCents: number;
  marginPct: number | null;
  markupPct: number | null;
}

/** Calculadora de ganancias para una venta de `quantity` unidades. */
export function profitBreakdown(priceCents: number, costCents: number, quantity = 1): ProfitBreakdown {
  assertCents(priceCents, 'precio');
  assertCents(costCents, 'costo');
  if (!Number.isFinite(quantity) || quantity <= 0) throw new RangeError('cantidad inválida');
  const revenueCents = roundHalfAwayFromZero(priceCents * quantity);
  const totalCostCents = roundHalfAwayFromZero(costCents * quantity);
  return {
    priceCents,
    costCents,
    quantity,
    revenueCents,
    totalCostCents,
    profitCents: revenueCents - totalCostCents,
    marginPct: marginPct(priceCents, costCents),
    markupPct: markupPct(priceCents, costCents),
  };
}

/** Punto de equilibrio en unidades: costos fijos / (precio − costo variable). */
export function breakEvenUnits(fixedCostsCents: number, priceCents: number, variableCostCents: number): number | null {
  assertCents(fixedCostsCents, 'costos fijos');
  const unitContribution = priceCents - variableCostCents;
  if (unitContribution <= 0) return null; // nunca se alcanza
  return Math.ceil(fixedCostsCents / unitContribution);
}
