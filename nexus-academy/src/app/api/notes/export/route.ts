import { getCurrentUser } from "@/lib/auth";
import { getMyNotes } from "@/lib/data/notes";
import { notesToMarkdown } from "@/lib/notes";
import { formatDate } from "@/lib/utils";

/** Descarga las notas del alumno en Markdown. Solo las propias (RLS). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Inicia sesión para descargar tus notas.", { status: 401, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const notes = await getMyNotes(user.id);
  const md = notesToMarkdown(
    notes.map((n) => ({ body: n.body, updated_at: n.updated_at, lesson_title: n.lesson?.title ?? null, course_title: n.course?.title ?? null })),
    new Date(),
    (d) => formatDate(d, { dateStyle: "long" }),
  );
  return new Response(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": 'attachment; filename="mis-notas-nexus-academy.md"',
      "Cache-Control": "private, no-store",
    },
  });
}
