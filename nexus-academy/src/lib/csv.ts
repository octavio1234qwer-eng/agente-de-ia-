/**
 * CSV para hojas de cálculo (Excel, Google Sheets, Numbers).
 * - Escapa comillas, comas y saltos de línea (RFC 4180).
 * - Neutraliza la «inyección de fórmulas»: una celda que empieza con = + - @ o
 *   tabulador/retorno se antepone con ' para que la hoja no la ejecute.
 * - Incluye BOM UTF-8 para que Excel muestre bien acentos y ñ.
 */
export type CsvColumn<T> = { header: string; value: (row: T) => string | number | null | undefined };

const DANGEROUS_START = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // Los números se dejan tal cual (un negativo como -12.50 no es una fórmula).
  if (typeof value !== "number" && DANGEROUS_START.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((c) => csvCell(c.header)).join(",")];
  for (const row of rows) lines.push(columns.map((c) => csvCell(c.value(row))).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** 89900 → "899.00" (sin símbolo: la moneda va en su propia columna). */
export function centsToDecimal(cents: number | null | undefined): string {
  return ((cents ?? 0) / 100).toFixed(2);
}

/** Fecha y hora local de la academia en formato ordenable: 2026-11-23 08:15. */
export function csvDate(value: string | null | undefined): string {
  if (!value) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(value))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

/**
 * Convierte el rango «desde/hasta» (fechas locales YYYY-MM-DD, inclusive) a
 * instantes UTC. Devuelve null si alguna fecha es inválida o el rango está al revés.
 */
export function dateRange(from: string | null, to: string | null): { from: string | null; to: string | null } | null {
  const valid = (d: string | null) => d === null || d === "" || /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (!valid(from) || !valid(to)) return null;
  // Ciudad de México no tiene horario de verano desde 2022: UTC−6 todo el año.
  const start = from ? new Date(`${from}T00:00:00-06:00`) : null;
  const end = to ? new Date(new Date(`${to}T00:00:00-06:00`).getTime() + 24 * 60 * 60 * 1000) : null;
  if ((start && isNaN(start.getTime())) || (end && isNaN(end.getTime()))) return null;
  if (start && end && start >= end) return null;
  return { from: start?.toISOString() ?? null, to: end?.toISOString() ?? null };
}
