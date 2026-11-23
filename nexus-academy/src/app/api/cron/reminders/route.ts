import { isAuthorizedCron } from "@/lib/cron";
import { runLearningReminders } from "@/lib/email/automations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return Response.json({ error: "No autorizado" }, { status: 401 });
  const result = await runLearningReminders();
  return Response.json({ job: "learning_reminders", ...result });
}
