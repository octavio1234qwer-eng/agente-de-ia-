import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getClassroom } from "@/lib/data/classroom";

/** Continúa donde el alumno se quedó: última lección, primera pendiente o la primera. */
export default async function CourseEntry({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser(`/aprender/${slug}`);
  const data = await getClassroom(slug, user.id);
  if (!data) notFound();
  if (!data.hasAccess) {
    const preview = data.flat.find((l) => l.is_preview);
    redirect(preview ? `/aprender/${slug}/${preview.id}` : `/cursos/${slug}`);
  }
  const target =
    data.flat.find((l) => l.id === data.enrollment?.last_lesson_id && !l.completed) ??
    data.flat.find((l) => !l.completed) ??
    data.flat.find((l) => l.id === data.enrollment?.last_lesson_id) ??
    data.flat[0];
  if (!target) redirect(`/cursos/${slug}`);
  redirect(`/aprender/${slug}/${target.id}`);
}
