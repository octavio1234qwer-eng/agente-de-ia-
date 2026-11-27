import { NextResponse } from "next/server";
import { db, visitorHash, assertSameOrigin } from "@/lib/server";
import { captureLead } from "@empire/businesses/cotizafacil-mx/leads";

export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try { await assertSameOrigin(); } catch { return NextResponse.json({ error: "Origen no permitido" }, { status: 403 }); }
  if (Number(req.headers.get("content-length") ?? 0) > 10_000) return NextResponse.json({ error: "Solicitud demasiado grande" }, { status: 413 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  const r = await captureLead(await db(), body, { visitorHash: await visitorHash() });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true }, { status: 201 });
}
