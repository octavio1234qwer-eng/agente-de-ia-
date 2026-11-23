import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Entrega un recurso privado: RLS confirma el acceso y se emite una URL firmada de 60 s. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL(`/login`, request.url));
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("No encontrado", { status: 404 });

  const supabase = await createClient();
  const { data: resource } = await supabase.from("lesson_resources").select("title, storage_path, is_downloadable, mime_type").eq("id", id).maybeSingle();
  if (!resource) return new NextResponse("No tienes acceso a este recurso.", { status: 403 });

  const inline = request.nextUrl.searchParams.get("inline") === "1" || !resource.is_downloadable;
  const ext = resource.storage_path.split(".").pop();
  const filename = `${resource.title.replace(/[^\p{L}\p{N} _-]/gu, "").trim() || "recurso"}${ext ? `.${ext}` : ""}`;
  const { data, error } = await createAdminClient()
    .storage.from("course-materials")
    .createSignedUrl(resource.storage_path, 60, inline ? undefined : { download: filename });
  if (error || !data) return new NextResponse("El archivo no está disponible.", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
