import { BRAND } from "@/lib/brand";
/** Longitud máxima de una nota (la base de datos aplica el mismo límite). */
export const NOTE_MAX = 5000;

export type ExportNote = {
  body: string;
  updated_at: string;
  lesson_title: string | null;
  course_title: string | null;
};

/**
 * Exporta las notas a Markdown, agrupadas por curso. El texto de cada nota se
 * conserva tal cual (es del alumno); los títulos se escapan para que no rompan
 * la estructura del documento.
 */
export function notesToMarkdown(notes: ExportNote[], exportedAt: Date, formatDate: (d: string | Date) => string): string {
  const esc = (s: string) => s.replace(/([\\`*_[\]#])/g, "\\$1").replace(/\s+/g, " ").trim();
  const out = [`# Mis notas · ${BRAND.name}`, "", `Exportado el ${formatDate(exportedAt)}.`, ""];
  if (notes.length === 0) {
    out.push("Todavía no tienes notas.", "");
    return out.join("\n");
  }
  const groups = new Map<string, ExportNote[]>();
  for (const n of notes) {
    const key = n.course_title ?? "Curso no disponible";
    groups.set(key, [...(groups.get(key) ?? []), n]);
  }
  for (const [course, items] of groups) {
    out.push(`## ${esc(course)}`, "");
    for (const n of items) {
      out.push(`### ${esc(n.lesson_title ?? "Lección no disponible")}`, "", `_Actualizada el ${formatDate(n.updated_at)}_`, "", n.body.trim(), "");
    }
  }
  return out.join("\n");
}

/** 75 → "1:15"; 3725 → "1:02:05". */
export function formatTimestamp(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Marca de tiempo escrita en una nota: [1:15] o [1:02:05]. */
export const TIMESTAMP_RE = /\[(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\]/g;

function toSeconds(h: string | undefined, m: string, s: string): number | null {
  const hh = h ? Number(h) : 0;
  const mm = Number(m);
  const ss = Number(s);
  if (ss > 59 || (h !== undefined && mm > 59)) return null;
  return hh * 3600 + mm * 60 + ss;
}

export type TimestampEntry = { seconds: number; label: string; text: string };

/** Marcas de tiempo de una nota con el texto que las acompaña en su línea. */
export function parseTimestamps(body: string): TimestampEntry[] {
  const out: TimestampEntry[] = [];
  for (const line of body.split("\n")) {
    for (const m of line.matchAll(TIMESTAMP_RE)) {
      const seconds = toSeconds(m[1], m[2], m[3]);
      if (seconds === null) continue;
      const text = line.replace(TIMESTAMP_RE, "").replace(/^[\s\-*•:–—]+/, "").trim();
      out.push({ seconds, label: formatTimestamp(seconds), text });
    }
  }
  return out;
}

export type NotePart = { kind: "text"; text: string } | { kind: "time"; text: string; seconds: number };

/** Divide el texto de una nota en texto y marcas de tiempo (para enlazarlas). */
export function splitTimestamps(body: string): NotePart[] {
  const parts: NotePart[] = [];
  let last = 0;
  for (const m of body.matchAll(TIMESTAMP_RE)) {
    const seconds = toSeconds(m[1], m[2], m[3]);
    if (seconds === null) continue;
    if (m.index > last) parts.push({ kind: "text", text: body.slice(last, m.index) });
    parts.push({ kind: "time", text: m[0], seconds });
    last = m.index + m[0].length;
  }
  if (last < body.length) parts.push({ kind: "text", text: body.slice(last) });
  return parts;
}
