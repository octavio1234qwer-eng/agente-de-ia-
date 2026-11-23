import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { config, integrations } from "@/lib/env";
import { catalogContext, lessonContext, streamTutorReply, type ChatTurn } from "@/lib/ai/nexus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const schema = z.object({
  message: z.string().trim().min(1, "Escribe tu pregunta.").max(4000, "El mensaje es demasiado largo."),
  conversationId: z.uuid().optional(),
  lessonId: z.uuid().optional(),
});

const json = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return json(401, "Inicia sesión para usar NEXUS AI.");
  if (!integrations.ai()) {
    return json(503, "NEXUS AI aún no está activado en esta instalación (falta la clave del modelo de IA en el servidor).");
  }
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json(400, parsed.error.issues[0].message);
  const { message, lessonId } = parsed.data;
  const admin = createAdminClient();

  // Límite diario por alumno (protege costos y abuso).
  const since = new Date(Date.now() - 86400_000).toISOString();
  const { count } = await admin.from("ai_messages").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("role", "user").gte("created_at", since);
  if ((count ?? 0) >= config.aiDailyLimit) {
    return json(429, `Alcanzaste el límite de ${config.aiDailyLimit} mensajes en 24 horas. Vuelve más tarde.`);
  }

  // Contexto de la lección: se lee con la sesión del alumno, así RLS impide filtrar contenido no comprado.
  const supabase = await createClient();
  let lesson: string | null = null;
  let courseId: string | null = null;
  if (lessonId) {
    const { data: l } = await supabase.from("lessons").select("id, title, type, course_id, courses(title)").eq("id", lessonId).maybeSingle();
    if (l) {
      courseId = l.course_id;
      const [{ data: content }, { data: outline }] = await Promise.all([
        supabase.from("lesson_contents").select("body").eq("lesson_id", lessonId).maybeSingle(),
        supabase.from("lessons").select("title, position, modules(position)").eq("course_id", l.course_id),
      ]);
      const titles = (outline ?? [])
        .sort((a, b) => (a.modules?.position ?? 0) - (b.modules?.position ?? 0) || a.position - b.position)
        .map((o) => o.title);
      lesson = lessonContext({ courseTitle: l.courses?.title ?? "", lessonTitle: l.title, lessonType: l.type, body: content?.body ?? null, outline: titles });
    }
  }
  const { data: catalog } = await supabase
    .from("courses")
    .select("title, slug, level, price_cents, currency, categories(name)")
    .eq("status", "published")
    .order("title");
  const catalogText = catalogContext(
    (catalog ?? []).map((c) => ({ title: c.title, slug: c.slug, level: c.level, priceCents: c.price_cents, currency: c.currency, category: c.categories?.name ?? null })),
  );

  // Conversación propia (o una nueva).
  let conversationId = parsed.data.conversationId ?? null;
  if (conversationId) {
    const { data: conv } = await admin.from("ai_conversations").select("id").eq("id", conversationId).eq("user_id", user.id).maybeSingle();
    if (!conv) conversationId = null;
  }
  if (!conversationId) {
    const { data: conv, error } = await admin
      .from("ai_conversations")
      .insert({ user_id: user.id, title: message.slice(0, 70), lesson_id: lessonId ?? null, course_id: courseId })
      .select("id")
      .single();
    if (error || !conv) return json(500, "No se pudo iniciar la conversación.");
    conversationId = conv.id;
  }

  const { data: previous } = await admin
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(20);
  const history: ChatTurn[] = [...(previous ?? [])].reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  history.push({ role: "user", content: message });
  await admin.from("ai_messages").insert({ conversation_id: conversationId, user_id: user.id, role: "user", content: message });

  const encoder = new TextEncoder();
  const convId = conversationId;
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let text = "";
      try {
        const stream = streamTutorReply({ catalog: catalogText, lesson, history });
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            text += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal" && !text) {
          text = "No puedo ayudarte con esa solicitud. ¿Quieres que lo intentemos con otra pregunta sobre el curso?";
          controller.enqueue(encoder.encode(text));
        }
        await admin.from("ai_messages").insert({
          conversation_id: convId,
          user_id: user.id,
          role: "assistant",
          content: text || "(sin respuesta)",
          input_tokens: final.usage.input_tokens,
          output_tokens: final.usage.output_tokens,
        });
        await admin.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
      } catch (err) {
        console.error("[nexus-ai]", err);
        controller.enqueue(encoder.encode(`${text ? "\n\n" : ""}⚠️ NEXUS AI no pudo completar la respuesta. Intenta de nuevo en un momento.`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Conversation-Id": convId },
  });
}
