import { isAuthorizedCron } from "@/lib/cron";
import { runStreakReminders } from "@/lib/email/automations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Avisa a quien está por perder su racha. Seguro de llamar cada hora: la base
 * solo elige alumnos que están en su horario de tarde-noche y el envío se
 * deduplica por alumno y día local.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return Response.json({ error: "No autorizado" }, { status: 401 });
  const result = await runStreakReminders();
  return Response.json({ job: "streak_reminders", ...result });
}
