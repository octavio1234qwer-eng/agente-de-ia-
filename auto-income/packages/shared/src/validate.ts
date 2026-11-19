/**
 * Validación mínima de entradas sin dependencias externas.
 * Cada validador devuelve el valor normalizado o lanza ValidationError.
 */

export class ValidationError extends Error {
  readonly field: string;
  constructor(field: string, message: string) {
    super(`${field}: ${message}`);
    this.name = 'ValidationError';
    this.field = field;
  }
}

type Obj = Record<string, unknown>;

export function asObject(value: unknown, field = 'body'): Obj {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(field, 'debe ser un objeto');
  }
  return value as Obj;
}

export function str(
  obj: Obj,
  field: string,
  opts: { min?: number; max?: number; optional?: boolean; pattern?: RegExp } = {},
): string {
  const raw = obj[field];
  if (raw === undefined || raw === null || raw === '') {
    if (opts.optional) return '';
    throw new ValidationError(field, 'es obligatorio');
  }
  if (typeof raw !== 'string') throw new ValidationError(field, 'debe ser texto');
  const value = raw.trim();
  const min = opts.min ?? (opts.optional ? 0 : 1);
  const max = opts.max ?? 500;
  if (value.length < min) throw new ValidationError(field, `mínimo ${min} caracteres`);
  if (value.length > max) throw new ValidationError(field, `máximo ${max} caracteres`);
  if (opts.pattern && value && !opts.pattern.test(value)) throw new ValidationError(field, 'formato inválido');
  return value;
}

export function num(
  obj: Obj,
  field: string,
  opts: { min?: number; max?: number; integer?: boolean; optional?: boolean; fallback?: number } = {},
): number {
  const raw = obj[field];
  if (raw === undefined || raw === null || raw === '') {
    if (opts.optional) return opts.fallback ?? 0;
    throw new ValidationError(field, 'es obligatorio');
  }
  const value = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new ValidationError(field, 'debe ser numérico');
  if (opts.integer && !Number.isInteger(value)) throw new ValidationError(field, 'debe ser entero');
  if (opts.min !== undefined && value < opts.min) throw new ValidationError(field, `mínimo ${opts.min}`);
  if (opts.max !== undefined && value > opts.max) throw new ValidationError(field, `máximo ${opts.max}`);
  return value;
}

export function oneOf<T extends string>(obj: Obj, field: string, values: readonly T[], fallback?: T): T {
  const raw = obj[field];
  if ((raw === undefined || raw === null || raw === '') && fallback !== undefined) return fallback;
  if (typeof raw !== 'string' || !values.includes(raw as T)) {
    throw new ValidationError(field, `debe ser uno de: ${values.join(', ')}`);
  }
  return raw as T;
}

export function bool(obj: Obj, field: string, fallback = false): boolean {
  const raw = obj[field];
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw !== 'boolean') throw new ValidationError(field, 'debe ser booleano');
  return raw;
}

export function arr(obj: Obj, field: string, opts: { max?: number; optional?: boolean } = {}): unknown[] {
  const raw = obj[field];
  if (raw === undefined || raw === null) {
    if (opts.optional) return [];
    throw new ValidationError(field, 'es obligatorio');
  }
  if (!Array.isArray(raw)) throw new ValidationError(field, 'debe ser una lista');
  if (opts.max !== undefined && raw.length > opts.max) throw new ValidationError(field, `máximo ${opts.max} elementos`);
  return raw;
}

export function strList(obj: Obj, field: string, opts: { max?: number; itemMax?: number } = {}): string[] {
  return arr(obj, field, { max: opts.max ?? 50, optional: true }).map((item, i) => {
    if (typeof item !== 'string') throw new ValidationError(`${field}[${i}]`, 'debe ser texto');
    const v = item.trim();
    if (v.length > (opts.itemMax ?? 100)) throw new ValidationError(`${field}[${i}]`, 'demasiado largo');
    return v;
  }).filter(Boolean);
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^\+?[0-9 ()-]{7,20}$/;
