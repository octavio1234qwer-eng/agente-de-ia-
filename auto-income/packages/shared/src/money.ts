/**
 * Dinero en unidades menores enteras (centavos) para evitar errores de coma flotante.
 * Toda cantidad monetaria del sistema se almacena y calcula como entero.
 */

export type CurrencyCode = string; // ISO 4217, p. ej. "MXN", "USD"

export const DEFAULT_CURRENCY: CurrencyCode = 'MXN';

export interface Money {
  /** Cantidad en centavos (entero). */
  cents: number;
  currency: CurrencyCode;
}

export function assertCents(value: number, label = 'cantidad'): number {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new RangeError(`${label} debe ser un entero en centavos`);
  }
  return value;
}

/** Redondeo "half away from zero" a entero (convención contable habitual). */
export function roundHalfAwayFromZero(value: number): number {
  const sign = value < 0 ? -1 : 1;
  // Corrige errores de representación binaria (p. ej. 1.005 * 100 = 100.49999...).
  const abs = Math.abs(value);
  const corrected = Math.round((abs + Number.EPSILON) * 1e6) / 1e6;
  return sign * Math.floor(corrected + 0.5);
}

/** Convierte un importe decimal (p. ej. 199.99) a centavos. */
export function toCents(amount: number): number {
  if (!Number.isFinite(amount)) throw new RangeError('importe inválido');
  return roundHalfAwayFromZero(amount * 100);
}

export function fromCents(cents: number): number {
  return assertCents(cents) / 100;
}

/** Multiplica centavos por un factor y redondea al centavo. */
export function multiplyCents(cents: number, factor: number): number {
  assertCents(cents);
  if (!Number.isFinite(factor)) throw new RangeError('factor inválido');
  return roundHalfAwayFromZero(cents * factor);
}

export function formatMoney(cents: number, currency: CurrencyCode = DEFAULT_CURRENCY, locale = 'es-MX'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(fromCents(cents));
}

export function isValidCurrency(code: string): boolean {
  if (!/^[A-Z]{3}$/.test(code)) return false;
  try {
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: code });
    return true;
  } catch {
    return false;
  }
}
