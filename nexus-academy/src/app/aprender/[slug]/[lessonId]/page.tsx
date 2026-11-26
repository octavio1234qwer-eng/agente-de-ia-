import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download, FileText, Lock, Megaphone } from "lucide-react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getClassroom, getLessonContent, resolveVideoSource } from "@/lib/data/classroom";
import { Outline } from "@/components/classroom/outline";
import { VideoPlayer } from "@/components/classroom/video-player";
import { LessonActions } from "@/components/classroom/lesson-actions";
import { QuizRunner } from "@/components/classroom/quiz-runner";
import { NexusChat } from "@/components/classroom/nexus-chat";
import { SearchHighlight } from "@/components/classroom/search-highlight";
import { LessonNotes } from "@/components/classroom/lesson-notes";
import { LessonQA } from "@/components/classroom/lesson-qa";
import { parseQaThread } from "@/lib/qa";
import { normalizeQuery } from "@/lib/search";
import { CAPTION_LANGS } from "@/lib/captions";
import { ReviewForm } from "@/components/course/review-form";
import { Markdown } from "@/components/ui/markdown";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatSeconds, lessonTypeLabel } from "@/lib/utils";

type Params = { slug: string; lessonId: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Aula · ${slug.replace(/-/g, " ")}`, robots: { index: false } };
}

function formatBytes(n: number | null) {
  if (!n) return "";
  return n > 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`;
}

export default async function LessonPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ resaltar?: string | string[]; t?: string | string[] }> }) {
  const { slug, lessonId } = await params;
  const sp = await searchParams;
  const highlightQuery = normalizeQuery(Array.isArray(sp.resaltar) ? sp.resaltar[0] : sp.resaltar);
  // ?t=SEGUNDOS: abrir el video en ese momento (enlaces de marcas de tiempo).
  const rawT = Array.isArray(sp.t) ? sp.t[0] : sp.t;
  const jumpTo = rawT && /^\d{1,5}$/.test(rawT) ? Number(rawT) : null;
  const user = await requireUser(`/aprender/${slug}/${lessonId}`);
  const data = await getClassroom(slug, user.id);
  if (!data) notFound();
  const index = data.flat.findIndex((l) => l.id === lessonId);
  if (index === -1) notFound();
  const lesson = data.flat[index];
  const moduleOf = data.modules.find((m) => m.lessons.some((l) => l.id === lessonId))!;
  const prev = data.flat.slice(0, index).reverse().find((l) => l.canView) ?? null;
  const next = data.flat.slice(index + 1).find((l) => l.canView) ?? null;
  const canTrack = data.hasAccess;

  if (!lesson.canView) {
    // Con acceso al curso, la única razón es que su módulo aún no se libera.
    const scheduled = data.hasAccess && moduleOf.releaseAt;
    const firstAvailable = data.flat.find((l) => l.canView && !l.completed) ?? data.flat.find((l) => l.canView);
    return (
      <div className="flex flex-1">
        <Outline slug={slug} modules={data.modules} currentId={lessonId} searchable={data.hasAccess} />
        <main className="grid flex-1 place-items-center px-4 py-20 text-center">
          <div className="max-w-md">
            <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-white/[0.05]"><Lock className="size-7 text-mist-300" /></span>
            {scheduled ? (
              <>
                <h1 className="mt-6 text-2xl font-semibold text-white">Esta lección se libera el {formatDate(moduleOf.releaseAt!, { dateStyle: "long" })}</h1>
                <p className="mt-2 text-mist-300">El módulo «{moduleOf.title}» se abre por etapas para que avances a buen ritmo. Mientras tanto, sigue con lo que ya está disponible.</p>
                {firstAvailable && <LinkButton href={`/aprender/${slug}/${firstAvailable.id}`} className="mt-6">Continuar con lo disponible</LinkButton>}
              </>
            ) : (
              <>
                <h1 className="mt-6 text-2xl font-semibold text-white">Lección bloqueada</h1>
                <p className="mt-2 text-mist-300">Esta lección es parte del curso completo. Obtén acceso para continuar aprendiendo.</p>
                <LinkButton href={`/cursos/${slug}`} className="mt-6">Ver opciones de acceso</LinkButton>
              </>
            )}
          </div>
        </main>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ content, resources }, quizRes, myReview, myNote, qaRes] = await Promise.all([
    getLessonContent(lessonId),
    lesson.type === "quiz" ? supabase.rpc("get_quiz", { p_lesson_id: lessonId }) : Promise.resolve({ data: null }),
    supabase.from("reviews").select("rating, comment").eq("course_id", data.course.id).eq("user_id", user.id).maybeSingle(),
    supabase.from("lesson_notes").select("body, updated_at").eq("lesson_id", lessonId).eq("user_id", user.id).maybeSingle(),
    data.hasAccess ? supabase.rpc("lesson_qa", { p_lesson_id: lessonId }) : Promise.resolve({ data: null }),
  ]);
  const { data: unseenRows } = data.hasAccess ? await supabase.rpc("course_announcements_unseen") : { data: null };
  const unseen = unseenRows?.find((r) => r.course_id === data.course.id) ?? null;
  const qaThread = data.hasAccess ? parseQaThread(qaRes.data) : null;
  const video = lesson.type === "video" ? await resolveVideoSource(content?.video_provider ?? null, content?.video_ref ?? null) : null;
  const { data: passMeta } = lesson.type === "quiz" ? await supabase.from("lessons").select("pass_percent").eq("id", lessonId).single() : { data: null };
  const questions = (quizRes.data ?? []).map((q) => ({ id: q.id, prompt: q.prompt, options: (q.options as string[]) ?? [] }));
  const startAt = jumpTo ?? data.progress.get(lessonId)?.last_position_seconds ?? 0;
  const isLast = !next;
  const { data: highlightTerms } = highlightQuery.length >= 2 ? await supabase.rpc("lesson_search_terms", { p_q: highlightQuery }) : { data: null };
  const courseDone = data.flat.every((l) => l.completed);

  const lessonHeader = (
    <div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-mist-400">
        <span>{moduleOf.title}</span>
        <span aria-hidden>·</span>
        <Badge tone={lesson.type === "quiz" ? "violet" : lesson.type === "exercise" ? "amber" : "blue"}>{lessonTypeLabel[lesson.type]}</Badge>
        <span>{formatSeconds(lesson.duration_seconds)}</span>
        {lesson.is_preview && !data.hasAccess && <Badge tone="green">Vista previa gratuita</Badge>}
      </div>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{lesson.title}</h1>
    </div>
  );
  const lessonBody = lesson.type === "quiz" ? (
    questions.length > 0 ? (
      <QuizRunner lessonId={lessonId} questions={questions} passPercent={passMeta?.pass_percent ?? 70} alreadyPassed={lesson.completed} canSubmit={canTrack} />
    ) : (
      <p className="text-sm text-mist-400">Esta evaluación todavía no tiene preguntas.</p>
    )
  ) : content?.body ? (
    <Markdown>{content.body}</Markdown>
  ) : null;

  return (
    <div className="flex flex-1">
      <Outline slug={slug} modules={data.modules} currentId={lessonId} searchable={data.hasAccess} unseenAnnouncements={data.hasAccess ? (unseen?.unseen ?? 0) : undefined} />
      <main className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-8 lg:pb-12">
        <div className="mx-auto max-w-4xl space-y-6">
          {unseen && unseen.unseen > 0 && (
            <Link href={`/aprender/${slug}/avisos`} className="flex items-center gap-3 rounded-2xl border border-electric-400/25 bg-electric-500/10 px-4 py-3 text-sm text-mist-100 hover:bg-electric-500/15">
              <Megaphone className="size-5 shrink-0 text-electric-300" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="font-medium text-white">{unseen.unseen === 1 ? "Nuevo aviso del curso" : `${unseen.unseen} avisos nuevos del curso`}:</span>{" "}
                <span className="break-words">{unseen.latest_title}</span>
              </span>
              <span className="shrink-0 font-medium text-electric-300">Leer</span>
            </Link>
          )}
          {lesson.type === "video" && (
            video ? (
              video.kind === "file" ? (
                <VideoPlayer lessonId={lessonId} src={video.src} startAt={startAt} exactStart={jumpTo !== null} completed={lesson.completed} canTrack={canTrack} captions={content?.has_captions ? { src: `/api/captions/${lessonId}`, lang: content.captions_lang, label: CAPTION_LANGS[content.captions_lang as keyof typeof CAPTION_LANGS] ?? content.captions_lang } : null} />
              ) : (
                <div className="aspect-video overflow-hidden rounded-2xl bg-black">
                  <iframe src={video.src} title={lesson.title} className="size-full" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
                </div>
              )
            ) : (
              <div className="grid aspect-video place-items-center rounded-2xl border border-white/[0.06] bg-ink-850 text-center">
                <p className="max-w-sm px-6 text-sm text-mist-400">El video de esta lección aún no está disponible. Puedes continuar con el material de apoyo.</p>
              </div>
            )
          )}

          {highlightTerms && highlightTerms.length > 0 ? (
            <SearchHighlight key={`${lessonId}:${highlightQuery}`} query={highlightQuery} terms={highlightTerms} clearHref={`/aprender/${slug}/${lessonId}`}>
              {lessonHeader}
              {lessonBody}
            </SearchHighlight>
          ) : (
            <>
              {lessonHeader}
              {lessonBody}
            </>
          )}

          {resources.length > 0 && (
            <section className="glass rounded-2xl p-5" aria-labelledby="recursos">
              <h2 id="recursos" className="font-semibold text-white">Recursos de la lección</h2>
              <ul className="mt-3 divide-y divide-white/[0.06]">
                {resources.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-3">
                    <FileText className="size-5 text-electric-300" aria-hidden />
                    <span className="min-w-0 flex-1 text-sm text-mist-100">{r.title} <span className="text-xs text-mist-400">{formatBytes(r.size_bytes)}</span></span>
                    {r.is_downloadable ? (
                      <a href={`/api/resources/${r.id}`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.06] px-3 text-sm text-white hover:bg-white/[0.1]"><Download className="size-4" aria-hidden /> Descargar</a>
                    ) : (
                      <a href={`/api/resources/${r.id}?inline=1`} target="_blank" rel="noopener" className="inline-flex h-10 items-center rounded-xl bg-white/[0.06] px-3 text-sm text-white hover:bg-white/[0.1]">Ver</a>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <LessonNotes key={lessonId} lessonId={lessonId} initial={myNote.data?.body ?? ""} updatedAt={myNote.data?.updated_at ?? null} withVideo={video?.kind === "file"} />

          {qaThread && <LessonQA lessonId={lessonId} questions={qaThread} isAdmin={user.role === "admin"} canPost={data.hasAccess} />}

          <LessonActions
            lessonId={lessonId}
            completed={lesson.completed}
            isQuiz={lesson.type === "quiz"}
            canTrack={canTrack}
            prevHref={prev ? `/aprender/${slug}/${prev.id}` : null}
            nextHref={next ? `/aprender/${slug}/${next.id}` : null}
          />

          {canTrack && isLast && (
            <section className="glass glow-border rounded-2xl p-6">
              {courseDone ? (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-lg font-semibold text-white">🎓 ¡Completaste el curso!</p>
                    <p className="text-sm text-mist-300">Tu certificado verificable ya está disponible.</p>
                  </div>
                  <LinkButton href="/cuenta/certificados">Ver mi certificado</LinkButton>
                </div>
              ) : (
                <p className="text-sm text-mist-300">Completa todas las lecciones y aprueba las evaluaciones para obtener tu certificado.</p>
              )}
              <div className="mt-6"><ReviewForm courseId={data.course.id} slug={slug} initial={myReview.data} /></div>
            </section>
          )}
        </div>
      </main>
      <NexusChat lessonId={lessonId} />
    </div>
  );
}
