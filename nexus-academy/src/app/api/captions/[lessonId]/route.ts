import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Sirve los subtítulos WebVTT de una lección desde el mismo dominio (sin CORS).
 * La consulta pasa por RLS: solo responde a quien puede ver la lección
 * (alumnos con acceso o lecciones de vista previa); al resto, 404.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  if (!z.uuid().safeParse(lessonId).success) return new Response("Not found", { status: 404 });
  const supabase = await createClient();
  const { data } = await supabase.from("lesson_contents").select("captions_vtt").eq("lesson_id", lessonId).maybeSingle();
  if (!data?.captions_vtt) return new Response("Not found", { status: 404 });
  return new Response(data.captions_vtt, {
    headers: {
      "Content-Type": "text/vtt; charset=utf-8",
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
