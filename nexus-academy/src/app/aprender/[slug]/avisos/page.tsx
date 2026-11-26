import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Megaphone } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getClassroom } from "@/lib/data/classroom";
import { Outline } from "@/components/classroom/outline";
import { MarkAnnouncementsSeen } from "@/components/classroom/mark-announcements-seen";
import { Markdown } from "@/components/ui/markdown";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Avisos del curso", robots: { index: false } };

export default async function CourseAnnouncementsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser(`/aprender/${slug}/avisos`);
  const data = await getClassroom(slug, user.id);
  if (!data) notFound();
  if (!data.hasAccess) redirect(`/cursos/${slug}`);
  const supabase = await createClient();
  const [{ data: announcements }, { data: enrollment }] = await Promise.all([
    supabase.from("course_announcements").select("id, title, body, created_at, updated_at").eq("course_id", data.course.id).order("created_at", { ascending: false }),
    supabase.from("enrollments").select("announcements_seen_at").eq("course_id", data.course.id).eq("user_id", user.id).is("revoked_at", null).maybeSingle(),
  ]);
  const list = announcements ?? [];
  const seenAt = enrollment?.announcements_seen_at ? new Date(enrollment.announcements_seen_at).getTime() : null;
  const isNew = (createdAt: string) => seenAt === null || new Date(createdAt).getTime() > seenAt;
  // Lo que había sin ver antes de abrir esta página (en el temario ya se muestra en cero).
  const unseen = enrollment ? list.filter((a) => isNew(a.created_at)).length : 0;

  return (
    <div className="flex flex-1">
      <Outline slug={slug} modules={data.modules} currentId="avisos" searchable unseenAnnouncements={0} />
      <main className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-8 lg:pb-12">
        <div className="mx-auto max-w-3xl space-y-6">
          <div>
            <p className="text-xs text-mist-400">{data.course.title}</p>
            <h1 className="mt-1 inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              <Megaphone className="size-6 text-electric-300" aria-hidden /> Avisos del curso
            </h1>
            <p className="mt-2 text-sm text-mist-300">
              {list.length === 0 ? "Aún no hay avisos. Aquí verás las novedades que publique el equipo." : unseen > 0 ? `${unseen === 1 ? "1 aviso nuevo" : `${unseen} avisos nuevos`} desde tu última visita.` : "Estás al día."}
            </p>
          </div>
          {list.length > 0 && (
            <ul className="space-y-4">
              {list.map((a) => (
                <li key={a.id}>
                  <article id={`aviso-${a.id}`} className="glass scroll-mt-24 rounded-2xl p-5" aria-labelledby={`aviso-${a.id}-titulo`}>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-mist-400">
                      <time dateTime={a.created_at}>{formatDate(a.created_at, { dateStyle: "long" })}</time>
                      {new Date(a.updated_at).getTime() - new Date(a.created_at).getTime() > 1000 && <span>· editado</span>}
                      {enrollment && isNew(a.created_at) && <Badge tone="blue">Nuevo</Badge>}
                    </div>
                    <h2 id={`aviso-${a.id}-titulo`} className="mt-2 text-lg font-semibold text-white">{a.title}</h2>
                    <div className="mt-2"><Markdown>{a.body}</Markdown></div>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      {enrollment && <MarkAnnouncementsSeen courseId={data.course.id} />}
    </div>
  );
}
