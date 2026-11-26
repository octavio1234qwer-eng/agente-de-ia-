import { z } from "zod";

/** Embudo por curso (datos de `admin_course_funnel`). */
const lessonSchema = z.object({
  lesson_id: z.string(),
  idx: z.number().int().min(1),
  title: z.string(),
  type: z.string(),
  module_title: z.string(),
  completed: z.number().int().min(0),
  stuck: z.number().int().min(0),
});
const funnelSchema = z.object({
  enrolled: z.number().int().min(0),
  started: z.number().int().min(0),
  not_started: z.number().int().min(0),
  completed: z.number().int().min(0),
  completion_rate: z.number().min(0).max(100),
  lessons: z.array(lessonSchema),
});
export type Funnel = z.infer<typeof funnelSchema>;
export type FunnelLesson = z.infer<typeof lessonSchema>;

export function parseFunnel(raw: unknown): Funnel | null {
  const parsed = funnelSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Porcentaje entero de `part` sobre `total` (0 si no hay total). */
export const pct = (part: number, total: number) => (total > 0 ? Math.round((part * 100) / total) : 0);

/**
 * Lecciones donde más alumnos se detienen (de mayor a menor), solo si hay
 * alguien detenido. En empate gana la que aparece antes en el temario.
 */
export function topDropOffs(f: Funnel, limit = 3): FunnelLesson[] {
  return f.lessons.filter((l) => l.stuck > 0).sort((a, b) => b.stuck - a.stuck || a.idx - b.idx).slice(0, limit);
}
