import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowUp, ExternalLink, Filter, Pencil, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { CourseForm } from "@/components/admin/course-form";
import { ConfirmButton, IconSubmit } from "@/components/admin/confirm-button";
import { ActionForm } from "@/components/admin/action-form";
import { addLessonAction, addModuleAction, announceCourseAction, deleteCourseAction, deleteModuleAction, moveLessonAction, moveModuleAction, renameModuleAction } from "@/lib/actions/admin";
import { Badge } from "@/components/ui/badge";
import { formatSeconds, lessonTypeLabel } from "@/lib/utils";

export const metadata: Metadata = { title: "Editar curso" };

export default async function EditCourse({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ creado?: string; archivado?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { creado, archivado } = await searchParams;
  const supabase = await createClient();
  const [{ data: course }, { data: categories }, { data: instructors }, { data: modules }] = await Promise.all([
    supabase.from("courses").select("*").eq("id", id).maybeSingle(),
    supabase.from("categories").select("id, name").order("sort_order"),
    supabase.from("instructors").select("id, name").order("name"),
    supabase.from("modules").select("id, title, position, lessons(id, title, type, duration_seconds, position, is_preview)").eq("course_id", id).order("position"),
  ]);
  if (!course) notFound();
  const sorted = (modules ?? []).map((m) => ({ ...m, lessons: [...m.lessons].sort((a, b) => a.position - b.position) }));

  return (
    <>
      <AdminHeader
        title={course.title}
        description={`${course.lessons_count} lecciones · ${course.students_count} alumnos`}
        actions={
          <>
            <Link href={`/admin/cursos/${course.id}/embudo`} className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm text-mist-200 hover:bg-white/[0.06]"><Filter className="size-4" aria-hidden /> Embudo de alumnos</Link>
            <Link href={`/cursos/${course.slug}`} target="_blank" className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm text-mist-200 hover:bg-white/[0.06]"><ExternalLink className="size-4" /> Ver página pública</Link>
          </>
        }
      />
      {creado && <p role="status" className="mb-4 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">Curso creado. Ahora arma el temario.</p>}
      {archivado && <p role="status" className="mb-4 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">El curso tiene alumnos inscritos, así que se archivó en lugar de eliminarse para no quitarles el acceso.</p>}

      <div className="grid gap-4 2xl:grid-cols-[1fr_520px]">
        <Panel title="Información del curso">
          <CourseForm course={course} categories={categories ?? []} instructors={instructors ?? []} />
        </Panel>

        <div className="space-y-4">
          <Panel title="Temario" subtitle="Módulos y lecciones en orden">
            <div className="space-y-4">
              {sorted.map((m, mi) => (
                <div key={m.id} className="rounded-xl border border-white/[0.07]">
                  <div className="flex items-center gap-1 border-b border-white/[0.06] p-2">
                    <form action={renameModuleAction} className="flex flex-1 items-center gap-2">
                      <input type="hidden" name="id" value={m.id} />
                      <span className="pl-1 text-xs text-mist-500">M{mi + 1}</span>
                      <input name="title" defaultValue={m.title} aria-label={`Título del módulo ${mi + 1}`} className="h-9 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-sm font-medium text-white hover:bg-white/[0.03] focus:bg-white/[0.05] focus:outline-none" />
                      <IconSubmit label="Guardar título"><Pencil className="size-3.5" /></IconSubmit>
                    </form>
                    <form action={moveModuleAction}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="course_id" value={id} /><input type="hidden" name="dir" value="up" /><IconSubmit label="Subir módulo"><ArrowUp className="size-3.5" /></IconSubmit></form>
                    <form action={moveModuleAction}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="course_id" value={id} /><input type="hidden" name="dir" value="down" /><IconSubmit label="Bajar módulo"><ArrowDown className="size-3.5" /></IconSubmit></form>
                    <form action={deleteModuleAction}><input type="hidden" name="id" value={m.id} /><ConfirmButton message={`¿Eliminar el módulo «${m.title}» y todas sus lecciones?`}>Eliminar</ConfirmButton></form>
                  </div>
                  <ul className="divide-y divide-white/[0.04]">
                    {m.lessons.map((l) => (
                      <li key={l.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                        <Link href={`/admin/cursos/${id}/lecciones/${l.id}`} className="min-w-0 flex-1 truncate text-mist-100 hover:text-electric-300">{l.title}</Link>
                        <Badge tone={l.type === "quiz" ? "violet" : "neutral"}>{lessonTypeLabel[l.type]}</Badge>
                        {l.is_preview && <Badge tone="green">Vista previa</Badge>}
                        <span className="w-12 text-right text-xs text-mist-500">{formatSeconds(l.duration_seconds)}</span>
                        <form action={moveLessonAction}><input type="hidden" name="id" value={l.id} /><input type="hidden" name="module_id" value={m.id} /><input type="hidden" name="course_id" value={id} /><input type="hidden" name="dir" value="up" /><IconSubmit label="Subir lección"><ArrowUp className="size-3.5" /></IconSubmit></form>
                        <form action={moveLessonAction}><input type="hidden" name="id" value={l.id} /><input type="hidden" name="module_id" value={m.id} /><input type="hidden" name="course_id" value={id} /><input type="hidden" name="dir" value="down" /><IconSubmit label="Bajar lección"><ArrowDown className="size-3.5" /></IconSubmit></form>
                      </li>
                    ))}
                  </ul>
                  <form action={addLessonAction} className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] p-2">
                    <input type="hidden" name="module_id" value={m.id} />
                    <input type="hidden" name="course_id" value={id} />
                    <input name="title" required placeholder="Nueva lección" aria-label="Título de la nueva lección" className="h-9 min-w-40 flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white placeholder:text-mist-500 focus:outline-none" />
                    <select name="type" aria-label="Tipo de lección" className="h-9 rounded-lg border border-white/10 bg-ink-850 px-2 text-sm text-white">
                      <option value="video">Video</option><option value="article">Lectura</option><option value="exercise">Ejercicio</option><option value="quiz">Evaluación</option>
                    </select>
                    <button type="submit" className="inline-flex h-9 items-center gap-1 rounded-lg bg-white/[0.06] px-3 text-sm text-white hover:bg-white/[0.1]"><Plus className="size-4" /> Lección</button>
                  </form>
                </div>
              ))}
              <form action={addModuleAction} className="flex gap-2">
                <input type="hidden" name="course_id" value={id} />
                <input name="title" required placeholder="Título del nuevo módulo" aria-label="Título del nuevo módulo" className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white placeholder:text-mist-500 focus:outline-none" />
                <button type="submit" className="inline-flex h-10 items-center gap-1 rounded-xl bg-electric-500/20 px-4 text-sm text-white hover:bg-electric-500/30"><Plus className="size-4" /> Módulo</button>
              </form>
            </div>
          </Panel>

          <Panel title="Anunciar curso" subtitle="Envía un correo a alumnos y suscriptores que aceptaron recibir novedades.">
            <ActionForm action={announceCourseAction} submitLabel="Enviar anuncio" pendingLabel="Enviando…" variant="secondary">
              <input type="hidden" name="id" value={id} />
              {course.status !== "published" && <p className="text-xs text-amber-300">Publica el curso antes de anunciarlo.</p>}
            </ActionForm>
          </Panel>

          <Panel title="Zona de peligro">
            <form action={deleteCourseAction}>
              <input type="hidden" name="id" value={id} />
              <ConfirmButton message="¿Eliminar este curso? Si tiene alumnos se archivará en su lugar." className="h-10 px-4 text-sm">Eliminar curso</ConfirmButton>
            </form>
          </Panel>
        </div>
      </div>
    </>
  );
}
