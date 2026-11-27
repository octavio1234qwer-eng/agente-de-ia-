import { NextResponse } from "next/server";
import { db } from "@/lib/server";
import { handleMercadoPagoWebhook } from "@empire/businesses/cotizafacil-mx/payments";

export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const url = new URL(req.url);
  const body = (await req.json().catch(() => ({}))) as { type?: string; data?: { id?: string } };
  const dataId = url.searchParams.get("data.id") ?? body.data?.id ?? null;
  const type = url.searchParams.get("type") ?? body.type ?? null;
  try {
    const r = await handleMercadoPagoWebhook(await db(), { xSignature: req.headers.get("x-signature"), xRequestId: req.headers.get("x-request-id"), dataId, type });
    return new NextResponse(r.body, { status: r.status });
  } catch (e) {
    console.error("webhook mercadopago", e);
    return new NextResponse("error", { status: 500 }); // MP reintentará
  }
}
