import { isAuthorizedCron } from "@/lib/cron";
import { runModuleUnlockEmails } from "@/lib/email/automations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Avisa por correo a los alumnos cuyo módulo programado se acaba de liberar. */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return Response.json({ error: "No autorizado" }, { status: 401 });
  const result = await runModuleUnlockEmails();
  return Response.json({ job: "module_unlocks", ...result });
}
