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
  const out = ["# Mis notas · NEXUS ACADEMY", "", `Exportado el ${formatDate(exportedAt)}.`, ""];
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
