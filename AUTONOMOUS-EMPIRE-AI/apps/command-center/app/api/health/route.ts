import { NextResponse } from "next/server";
import { db } from "@/lib/server";
export const dynamic = "force-dynamic";
export async function GET() {
  try { const d = await db(); await d.query("select 1"); return NextResponse.json({ ok: true, db: d.kind }); }
  catch (e) { console.error("health", e); return NextResponse.json({ ok: false }, { status: 503 }); }
}
