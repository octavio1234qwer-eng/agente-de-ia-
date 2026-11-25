import { z } from "zod";

/** Racha de estudio y meta semanal (los datos vienen de `get_learning_stats()`). */

export const GOAL_MIN = 1;
export const GOAL_MAX = 50;
export const DEFAULT_TIME_ZONE = "America/Mexico_City";

const daySchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), active: z.boolean(), lessons: z.number().int().min(0) });
const statsSchema = z.object({
  time_zone: z.string(),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  current_streak: z.number().int().min(0),
  longest_streak: z.number().int().min(0),
  active_today: z.boolean(),
  weekly_goal: z.number().int().min(GOAL_MIN).max(GOAL_MAX),
  week_lessons: z.number().int().min(0),
  week: z.array(daySchema).length(7),
});

export type WeekDay = z.infer<typeof daySchema>;
export type LearningStats = z.infer<typeof statsSchema>;

export function parseLearningStats(raw: unknown): LearningStats | null {
  const parsed = statsSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const WEEKDAYS = [
  { short: "L", long: "lunes" },
  { short: "M", long: "martes" },
  { short: "M", long: "miércoles" },
  { short: "J", long: "jueves" },
  { short: "V", long: "viernes" },
  { short: "S", long: "sábado" },
  { short: "D", long: "domingo" },
] as const;

export type DayStatus = "active" | "missed" | "today" | "future";

/** Estado de un día de la semana respecto a «hoy» (fechas ISO en la zona del alumno). */
export function dayStatus(day: WeekDay, today: string): DayStatus {
  if (day.active) return "active";
  if (day.date === today) return "today";
  return day.date > today ? "future" : "missed";
}

/** Texto accesible de un día: «martes 24: estudiaste, 2 lecciones completadas». */
export function dayLabel(day: WeekDay, index: number, today: string): string {
  const name = `${WEEKDAYS[index].long} ${Number(day.date.slice(8, 10))}`;
  const status = dayStatus(day, today);
  const lessons = day.lessons > 0 ? `, ${plural(day.lessons, "lección completada", "lecciones completadas")}` : "";
  if (status === "active") return `${name}${day.date === today ? " (hoy)" : ""}: estudiaste${lessons}`;
  if (status === "today") return `${name} (hoy): aún sin actividad`;
  if (status === "future") return `${name}: todavía no llega`;
  return `${name}: sin actividad`;
}

export function streakMessage(s: Pick<LearningStats, "current_streak" | "longest_streak" | "active_today">): string {
  if (s.current_streak === 0) {
    return s.longest_streak === 0
      ? "Avanza en una lección hoy para empezar tu racha."
      : "Tu racha se reinició. Estudia hoy para empezar una nueva.";
  }
  if (s.active_today) return `¡Ya estudiaste hoy! Vuelve mañana para llegar a ${plural(s.current_streak + 1, "día", "días")}.`;
  return `Estudia hoy para mantener tu racha de ${plural(s.current_streak, "día", "días")}.`;
}

/** Días que quedan en la semana contando hoy (lunes = 7, domingo = 1). */
export function daysLeftInWeek(s: Pick<LearningStats, "week_start" | "today">): number {
  const diff = Math.round((Date.parse(`${s.today}T00:00:00Z`) - Date.parse(`${s.week_start}T00:00:00Z`)) / 86_400_000);
  return Math.max(1, 7 - diff);
}

export function goalMessage(s: Pick<LearningStats, "week_lessons" | "weekly_goal" | "week_start" | "today">): string {
  if (s.week_lessons >= s.weekly_goal) {
    return `¡Meta cumplida! Completaste ${plural(s.week_lessons, "lección", "lecciones")} esta semana.`;
  }
  const missing = s.weekly_goal - s.week_lessons;
  const left = daysLeftInWeek(s);
  return `Te ${missing === 1 ? "falta" : "faltan"} ${plural(missing, "lección", "lecciones")} y ${left === 1 ? "queda" : "quedan"} ${plural(left, "día", "días")} de la semana.`;
}

export function goalPercent(s: Pick<LearningStats, "week_lessons" | "weekly_goal">): number {
  return Math.min(100, Math.round((s.week_lessons * 100) / s.weekly_goal));
}

export function parseGoal(input: unknown): number | null {
  const n = Number(typeof input === "string" ? input.trim() : input);
  return Number.isInteger(n) && n >= GOAL_MIN && n <= GOAL_MAX ? n : null;
}

/** Nombre IANA con forma válida (la base de datos confirma que exista). */
export function isTimeZoneName(tz: unknown): tz is string {
  return typeof tz === "string" && tz.length <= 64 && /^(UTC|[A-Z][A-Za-z_]+(\/[A-Za-z0-9_+-]+){1,2})$/.test(tz);
}

/** Desfase actual de una zona, p. ej. «GMT-5». */
export function utcOffset(tz: string, at = new Date()): string {
  try {
    const part = new Intl.DateTimeFormat("es-MX", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(at).find((p) => p.type === "timeZoneName");
    return part?.value ?? "";
  } catch {
    return "";
  }
}

/** Zonas más comunes para el público hispanohablante. */
export const COMMON_TIME_ZONES: { value: string; label: string }[] = [
  { value: "America/Mexico_City", label: "México · Centro (CDMX, Guadalajara, Monterrey)" },
  { value: "America/Cancun", label: "México · Quintana Roo" },
  { value: "America/Mazatlan", label: "México · Pacífico (Sinaloa, Nayarit, BCS)" },
  { value: "America/Hermosillo", label: "México · Sonora" },
  { value: "America/Tijuana", label: "México · Baja California" },
  { value: "America/Guatemala", label: "Guatemala" },
  { value: "America/El_Salvador", label: "El Salvador" },
  { value: "America/Tegucigalpa", label: "Honduras" },
  { value: "America/Managua", label: "Nicaragua" },
  { value: "America/Costa_Rica", label: "Costa Rica" },
  { value: "America/Panama", label: "Panamá" },
  { value: "America/Havana", label: "Cuba" },
  { value: "America/Santo_Domingo", label: "República Dominicana" },
  { value: "America/Puerto_Rico", label: "Puerto Rico" },
  { value: "America/Bogota", label: "Colombia" },
  { value: "America/Caracas", label: "Venezuela" },
  { value: "America/Guayaquil", label: "Ecuador" },
  { value: "America/Lima", label: "Perú" },
  { value: "America/La_Paz", label: "Bolivia" },
  { value: "America/Santiago", label: "Chile" },
  { value: "America/Asuncion", label: "Paraguay" },
  { value: "America/Argentina/Buenos_Aires", label: "Argentina" },
  { value: "America/Montevideo", label: "Uruguay" },
  { value: "America/New_York", label: "EE. UU. · Este" },
  { value: "America/Chicago", label: "EE. UU. · Centro" },
  { value: "America/Denver", label: "EE. UU. · Montaña" },
  { value: "America/Los_Angeles", label: "EE. UU. · Pacífico" },
  { value: "Europe/Madrid", label: "España · Península" },
  { value: "Atlantic/Canary", label: "España · Canarias" },
  { value: "UTC", label: "UTC" },
];

/** Opciones del selector: las comunes más la guardada y la del dispositivo si no están. */
export function timeZoneOptions(current: string, detected?: string | null): { value: string; label: string }[] {
  const options = [...COMMON_TIME_ZONES];
  for (const tz of [current, detected]) {
    if (tz && isTimeZoneName(tz) && !options.some((o) => o.value === tz)) options.push({ value: tz, label: tz.replace(/_/g, " ") });
  }
  return options;
}
