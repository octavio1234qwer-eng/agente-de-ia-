import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseLearningStats, type LearningStats } from "@/lib/learning-stats";

/** Racha y meta semanal del alumno con sesión (la función solo lee sus propios datos). */
export async function getLearningStats(): Promise<LearningStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_learning_stats");
  if (error) {
    console.error("[learning stats]", error.message);
    return null;
  }
  return parseLearningStats(data);
}
