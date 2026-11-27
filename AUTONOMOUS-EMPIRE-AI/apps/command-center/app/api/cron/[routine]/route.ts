import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/server";
import { ROUTINES, routinesOfKind, runRoutine } from "@empire/automation/routines";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const GROUPS = ["hourly", "daily", "weekly", "monthly"] as const;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || secret.length < 16 || got.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(secret));
}

/** Acepta una rutina (daily.ceo-cycle) o un grupo (daily). Vercel Cron llama con GET y Bearer CRON_SECRET. */
export async function POST(req: Request, { params }: { params: Promise<{ routine: string }> }) {
  if (!authorized(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const { routine } = await params;
  const names = (GROUPS as readonly string[]).includes(routine) ? routinesOfKind(routine as "daily") : ROUTINES[routine] ? [routine] : [];
  if (!names.length) return NextResponse.json({ error: "rutina desconocida" }, { status: 404 });
  const d = await db();
  const results: Record<string, { status: string; error?: string }> = {};
  for (const n of names) { const r = await runRoutine(d, n); results[n] = { status: r.status, error: r.error }; }
  const failed = Object.values(results).some((r) => r.status === "failed");
  return NextResponse.json(results, { status: failed ? 500 : 200 });
}
export const GET = POST;
