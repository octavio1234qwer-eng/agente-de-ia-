import { NextResponse } from "next/server";
import { db, visitorHash } from "@/lib/server";
import { resolveAndRecordClick } from "@empire/businesses/affiliate-engine/links";

export const dynamic = "force-dynamic";
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dest = await resolveAndRecordClick(await db(), slug, { referrer: req.headers.get("referer"), visitorHash: await visitorHash() });
  if (!dest) return new NextResponse("Enlace no disponible", { status: 404 });
  const res = NextResponse.redirect(dest, 302);
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("Cache-Control", "no-store");
  return res;
}
