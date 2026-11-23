import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { LessonEditor } from "@/components/admin/lesson-editor";
import { ResourceUploader } from "@/components/admin/resource-uploader";
import { ActionForm } from "@/components/admin/action-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { deleteLessonAction, deleteQuestionAction, deleteResourceAction, saveQuestionAction, toggleResourceDownloadAction } from "@/lib/actions/admin";
import { Field, Input, Textarea } from "@/components/ui/field";

export const metadata: Metadata = { title: "Editar lección" };

export default async function EditLesson({ params }: { params: Promise<{ id: string; lessonId: string }> }) {
  await requireAdmin();
  const { id, lessonId } = await params;
  const supabase = await createClient();
  const [{ data: lesson }, { data: content }, { data: resources }, { data: questions }, { data: course }] = await Promise.all([
    supabase.from("lessons").select("*").eq("id", lessonId).eq("course_id", id).maybeSingle(),
    supabase.from("lesson_contents").select("body, video_provider, video_ref").eq("lesson_id", lessonId).maybeSingle(),
    supabase.from("lesson_resources").select("*").eq("lesson_id", lessonId).order("created_at"),
    supabase.from("quiz_questions").select("*").eq("lesson_id", lessonId).order("position"),
    supabase.from("courses").select("title, slug").eq("id", id).single(),
  ]);
  if (!lesson || !course) notFound();

  return (
    <>
      <Link href={`/admin/cursos/${id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-mist-400 hover:text-white"><ArrowLeft className="size-4" /> {course.title}</Link>
      <AdminHeader
        title={lesson.title}
        actions={<Link href={`/aprender/${course.slug}/${lessonId}`} target="_blank" className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm text-mist-200 hover:bg-white/[0.06]"><ExternalLink className="size-4" /> Ver en el aula</Link>}
      />
      <div className="grid gap-4 2xl:grid-cols-[1fr_460px]">
        <Panel title="Contenido"><LessonEditor courseId={id} lesson={lesson} content={content} /></Panel>
        <div className="space-y-4">
          <Panel title="Recursos descargables" subtitle="Privados: se entregan con enlaces firmados de 60 s solo a alumnos con acceso.">
            <ul className="mb-4 divide-y divide-white/[0.05]">
              {(resources ?? []).map((r) => (
                <li key={r.id} className="flex items-center gap-2 py-2 text-sm">
                  <FileText className="size-4 text-electric-300" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-mist-100">{r.title}</span>
                  <form action={toggleResourceDownloadAction}>
                    <input type="hidden" name="id" value={r.id} /><input type="hidden" name="value" value={String(!r.is_downloadable)} />
                    <button type="submit" className="rounded-lg px-2 py-1 text-xs text-mist-300 hover:bg-white/[0.06]">{r.is_downloadable ? "Descargable" : "Solo ver"}</button>
                  </form>
                  <form action={deleteResourceAction}><input type="hidden" name="id" value={r.id} /><ConfirmButton message={`¿Eliminar «${r.title}»?`}>Eliminar</ConfirmButton></form>
                </li>
              ))}
              {(resources ?? []).length === 0 && <li className="py-2 text-xs text-mist-500">Sin recursos todavía.</li>}
            </ul>
            <ResourceUploader courseId={id} lessonId={lessonId} />
          </Panel>

          {lesson.type === "quiz" && (
            <Panel title="Preguntas de la evaluación" subtitle="Las respuestas correctas nunca se envían al navegador del alumno.">
              <ol className="mb-5 space-y-3">
                {(questions ?? []).map((q, i) => (
                  <li key={q.id} className="rounded-xl border border-white/[0.07] p-3">
                    <details>
                      <summary className="cursor-pointer text-sm text-white">{i + 1}. {q.prompt}</summary>
                      <ActionForm action={saveQuestionAction} submitLabel="Actualizar" variant="secondary" className="mt-3 space-y-3">
                        <input type="hidden" name="id" value={q.id} />
                        <input type="hidden" name="lesson_id" value={lessonId} />
                        <Textarea name="prompt" defaultValue={q.prompt} aria-label="Pregunta" />
                        <Textarea name="options" defaultValue={(q.options as string[]).join("\n")} aria-label="Opciones, una por línea" />
                        <Input name="correct" type="number" min={1} defaultValue={q.correct_index + 1} aria-label="Número de la opción correcta" />
                        <Input name="explanation" defaultValue={q.explanation ?? ""} aria-label="Explicación" placeholder="Explicación (opcional)" />
                      </ActionForm>
                    </details>
                    <form action={deleteQuestionAction} className="mt-2"><input type="hidden" name="id" value={q.id} /><ConfirmButton message="¿Eliminar esta pregunta?">Eliminar</ConfirmButton></form>
                  </li>
                ))}
              </ol>
              <ActionForm action={saveQuestionAction} submitLabel="Agregar pregunta" variant="secondary">
                <input type="hidden" name="lesson_id" value={lessonId} />
                <input type="hidden" name="position" value={(questions ?? []).length} />
                <Field label="Pregunta" htmlFor="q-prompt"><Textarea id="q-prompt" name="prompt" rows={2} /></Field>
                <Field label="Opciones (una por línea)" htmlFor="q-options"><Textarea id="q-options" name="options" rows={4} /></Field>
                <div className="grid grid-cols-[120px_1fr] gap-3">
                  <Field label="Correcta (n.º)" htmlFor="q-correct"><Input id="q-correct" name="correct" type="number" min={1} defaultValue={1} /></Field>
                  <Field label="Explicación" htmlFor="q-exp"><Input id="q-exp" name="explanation" /></Field>
                </div>
              </ActionForm>
            </Panel>
          )}

          <Panel title="Zona de peligro">
            <form action={deleteLessonAction}>
              <input type="hidden" name="id" value={lessonId} /><input type="hidden" name="course_id" value={id} />
              <ConfirmButton message="¿Eliminar esta lección, su video y sus recursos? El progreso de los alumnos en ella se perderá." className="h-10 px-4 text-sm">Eliminar lección</ConfirmButton>
            </form>
          </Panel>
        </div>
      </div>
    </>
  );
}
