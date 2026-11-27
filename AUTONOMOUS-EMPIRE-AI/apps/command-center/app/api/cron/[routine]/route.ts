import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/server";
import { ROUTINES, runRoutine } from "@empire/automation/routines";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || secret.length < 16 || got.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(secret));
}

export async function POST(req: Request, { params }: { params: Promise<{ routine: string }> }) {
  if (!authorized(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const { routine } = await params;
  if (!ROUTINES[routine]) return NextResponse.json({ error: "rutina desconocida" }, { status: 404 });
  const r = await runRoutine(await db(), routine);
  return NextResponse.json(r, { status: r.status === "failed" ? 500 : 200 });
}
export const GET = POST; // Vercel Cron usa GET con el encabezado Authorization: Bearer CRON_SECRET
