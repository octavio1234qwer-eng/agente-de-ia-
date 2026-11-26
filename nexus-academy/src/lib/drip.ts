/** Liberación programada de módulos («drip»). La regla real la aplica la base (can_view_lesson); esto la refleja en la interfaz. */

export const MAX_RELEASE_DAYS = 730;

/** Fecha en que se libera un módulo para un alumno, o null si ya está disponible para él (sin programación o admin). */
export function moduleReleaseAt(enrolledAt: string | null | undefined, releaseAfterDays: number | null | undefined, bypass = false): Date | null {
  if (bypass || !releaseAfterDays || releaseAfterDays <= 0 || !enrolledAt) return null;
  const start = new Date(enrolledAt);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() + releaseAfterDays * 86_400_000);
}

export function isReleased(releaseAt: Date | null, now: Date = new Date()) {
  return releaseAt === null || releaseAt.getTime() <= now.getTime();
}

/** Texto para el temario público: cuándo se libera respecto de la inscripción. */
export function releaseAfterLabel(days: number | null | undefined) {
  if (!days || days <= 0) return null;
  if (days === 1) return "Se libera 1 día después de inscribirte";
  if (days % 7 === 0 && days <= 84) {
    const w = days / 7;
    return `Se libera ${w === 1 ? "1 semana" : `${w} semanas`} después de inscribirte`;
  }
  return `Se libera ${days} días después de inscribirte`;
}

/** Valida lo que escribe el admin: vacío o 0 = de inmediato; 1-730 días. */
export function parseReleaseDays(raw: unknown): { ok: true; value: number | null } | { ok: false; error: string } {
  const s = String(raw ?? "").trim();
  if (s === "" || s === "0") return { ok: true, value: null };
  if (!/^\d{1,3}$/.test(s)) return { ok: false, error: "Escribe un número de días (0 a 730)." };
  const n = Number(s);
  if (n > MAX_RELEASE_DAYS) return { ok: false, error: "El máximo es 730 días." };
  return { ok: true, value: n };
}
