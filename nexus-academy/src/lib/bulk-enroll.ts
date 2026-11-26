/** Inscripción masiva: lectura de la lista de correos y textos de resultado. */

export const BULK_MAX = 500;

export type BulkStatus = "enrolled" | "restored" | "already" | "not_found" | "invalid" | "invited" | "invite_failed";
export type BulkRow = { email: string; status: BulkStatus; detail?: string };

/**
 * Separa la lista pegada (una por línea, o con comas, punto y coma o espacios;
 * también acepta «Nombre <correo>»), normaliza a minúsculas y quita repetidos
 * conservando el orden.
 */
export function parseEmailList(raw: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const piece of String(raw ?? "").split(/[\n\r,;\t]+/)) {
    const angle = piece.match(/<([^>]+)>/);
    const candidates = angle ? [angle[1]] : piece.split(/\s+/);
    for (const c of candidates) {
      const email = c.trim().replace(/^mailto:/i, "").toLowerCase();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      out.push(email);
    }
  }
  return out;
}

export const statusLabel: Record<BulkStatus, string> = {
  enrolled: "Inscrito",
  restored: "Acceso devuelto",
  already: "Ya tenía acceso",
  not_found: "Sin cuenta",
  invalid: "Correo inválido",
  invited: "Invitado por correo",
  invite_failed: "No se pudo invitar",
};

export function summarize(rows: BulkRow[]) {
  const count = (s: BulkStatus) => rows.filter((r) => r.status === s).length;
  const parts = [
    [count("enrolled") + count("restored") + count("invited"), "con acceso nuevo"],
    [count("already"), "ya tenían acceso"],
    [count("invited"), "invitados por correo"],
    [count("not_found"), "sin cuenta (no invitados)"],
    [count("invite_failed"), "no se pudieron invitar"],
    [count("invalid"), "correos inválidos"],
  ] as const;
  return parts.filter(([n], i) => n > 0 || i === 0).map(([n, label]) => `${n} ${label}`).join(" · ");
}
