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
  // Solo lecciones ya disponibles (los módulos programados aún no liberados se saltan).
  const open = data.flat.filter((l) => l.canView);
  const target =
    open.find((l) => l.id === data.enrollment?.last_lesson_id && !l.completed) ??
    open.find((l) => !l.completed) ??
    open.find((l) => l.id === data.enrollment?.last_lesson_id) ??
    open[0] ??
    data.flat[0];
  if (!target) redirect(`/cursos/${slug}`);
  redirect(`/aprender/${slug}/${target.id}`);
}
