import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Pencil } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { AnnouncementForm } from "@/components/admin/announcement-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { deleteAnnouncementAction } from "@/lib/actions/announcements";
import { Markdown } from "@/components/ui/markdown";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Avisos del curso" };

export default async function CourseAnnouncementsAdmin({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ editar?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { editar } = await searchParams;
  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("id, title, slug").eq("id", id).maybeSingle();
  if (!course) notFound();
  const [{ data: announcements }, { count: recipients }] = await Promise.all([
    supabase.from("course_announcements").select("id, title, body, created_at, updated_at, emailed_at, email_sent, email_skipped, email_failed").eq("course_id", id).order("created_at", { ascending: false }),
    createAdminClient()
      .from("enrollments")
      .select("user_id, profiles!inner(reminder_opt_in)", { count: "exact", head: true })
      .eq("course_id", id)
      .is("revoked_at", null)
      .eq("profiles.reminder_opt_in", true),
  ]);
  const list = announcements ?? [];
  const editing = editar ? list.find((a) => a.id === editar) : undefined;

  return (
    <>
      <AdminHeader
        title={`Avisos · ${course.title}`}
        description="Novedades para los alumnos con acceso a este curso: las ven en el aula y en «Mis cursos», y opcionalmente las reciben por correo."
        actions={<Link href={`/admin/cursos/${id}`} className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm text-mist-200 hover:bg-white/[0.06]"><ArrowLeft className="size-4" aria-hidden /> Volver al curso</Link>}
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title={editing ? "Editar aviso" : "Nuevo aviso"} subtitle={editing ? `Publicado el ${formatDate(editing.created_at, { dateStyle: "medium", timeStyle: "short" })}` : "Admite Markdown: negritas, listas y enlaces."}>
          <AnnouncementForm
            key={editing?.id ?? "nuevo"}
            courseId={id}
            recipients={recipients ?? 0}
            editing={editing ? { id: editing.id, title: editing.title, body: editing.body, emailed: Boolean(editing.emailed_at), cancelHref: `/admin/cursos/${id}/avisos` } : undefined}
          />
        </Panel>
        <section aria-labelledby="publicados" className="space-y-3">
          <h2 id="publicados" className="font-semibold text-white">Publicados ({list.length})</h2>
          {list.length === 0 ? (
            <p className="glass rounded-2xl p-5 text-sm text-mist-400">Aún no hay avisos para este curso.</p>
          ) : (
            <ul className="space-y-3">
              {list.map((a) => (
                <li key={a.id}>
                  <article className="glass rounded-2xl p-5" aria-label={a.title}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-medium text-white">{a.title}</h3>
                        <p className="text-xs text-mist-400">
                          {formatDate(a.created_at, { dateStyle: "medium", timeStyle: "short" })}
                          {new Date(a.updated_at).getTime() - new Date(a.created_at).getTime() > 1000 && " · editado"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Link href={`/admin/cursos/${id}/avisos?editar=${a.id}`} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-mist-200 hover:bg-white/[0.06]"><Pencil className="size-3.5" aria-hidden /> Editar</Link>
                        <form action={deleteAnnouncementAction}>
                          <input type="hidden" name="id" value={a.id} />
                          <input type="hidden" name="course_id" value={id} />
                          <ConfirmButton message="¿Eliminar este aviso? Los alumnos dejarán de verlo.">Eliminar</ConfirmButton>
                        </form>
                      </div>
                    </div>
                    <div className="mt-3 max-h-48 overflow-hidden text-sm"><Markdown>{a.body}</Markdown></div>
                    <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-mist-400">
                      <Mail className="size-3.5" aria-hidden />
                      {a.emailed_at
                        ? `Correo (${formatDate(a.emailed_at, { dateStyle: "medium", timeStyle: "short" })}): ${a.email_sent} enviado(s), ${a.email_skipped} omitido(s), ${a.email_failed} con error`
                        : "No se envió por correo"}
                    </p>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
