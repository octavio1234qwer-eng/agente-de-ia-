import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Dumbbell, FileText, ListChecks, PlayCircle, SearchX } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { normalizeQuery, parseSnippet } from "@/lib/search";
import { LessonSearchForm } from "@/components/search/lesson-search-form";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { lessonTypeLabel } from "@/lib/utils";

export const metadata: Metadata = { title: "Buscar en mis cursos", robots: { index: false } };

const LIMIT = 50;
const icons = { video: PlayCircle, article: FileText, quiz: ListChecks, exercise: Dumbbell } as const;

export default async function LessonSearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; curso?: string | string[] }> }) {
  const sp = await searchParams;
  const q = normalizeQuery(Array.isArray(sp.q) ? sp.q[0] : sp.q);
  const courseSlug = normalizeQuery(Array.isArray(sp.curso) ? sp.curso[0] : sp.curso);
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (courseSlug) qs.set("curso", courseSlug);
  const user = await requireUser(`/cuenta/buscar${qs.size ? `?${qs}` : ""}`);
  const supabase = await createClient();

  const { data: enrolled } = await supabase
    .from("enrollments")
    .select("course:courses(id, slug, title)")
    .eq("user_id", user.id)
    .is("revoked_at", null);
  const courses = (enrolled ?? []).flatMap((e) => (e.course ? [e.course] : [])).sort((a, b) => a.title.localeCompare(b.title, "es"));
  const selected = courses.find((c) => c.slug === courseSlug) ?? null;

  const header = (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-white">Buscar en mis cursos</h2>
        <p className="mt-1 text-sm text-mist-400">Encuentra cualquier tema, comando o concepto dentro de las lecciones de los cursos a los que tienes acceso.</p>
      </div>
      <LessonSearchForm q={q} course={selected?.slug ?? ""} courses={courses.map(({ slug, title }) => ({ slug, title }))} autoFocus={!q} />
    </div>
  );

  if (courses.length === 0 && user.role !== "admin") {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState
          icon={<BookOpen className="size-6" />}
          title="Aún no tienes cursos"
          description="La búsqueda recorre el contenido de los cursos en los que estás inscrito. Inscríbete a uno para empezar."
          action={<LinkButton href="/cursos">Explorar cursos</LinkButton>}
        />
      </div>
    );
  }

  if (q.length < 2) {
    return (
      <div className="space-y-6">
        {header}
        {q.length === 1 && <p role="status" className="text-sm text-mist-400">Escribe al menos 2 caracteres.</p>}
      </div>
    );
  }

  const { data: results, error } = await supabase.rpc("search_lessons", { q, p_course_id: selected?.id, p_limit: LIMIT });
  const rows = results ?? [];
  const groups = new Map<string, { slug: string; title: string; items: typeof rows }>();
  for (const r of rows) {
    const g = groups.get(r.course_id) ?? { slug: r.course_slug, title: r.course_title, items: [] };
    g.items.push(r);
    groups.set(r.course_id, g);
  }

  return (
    <div className="space-y-6">
      {header}
      {error ? (
        <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">No se pudo completar la búsqueda. Intenta de nuevo en un momento.</p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<SearchX className="size-6" />}
          title="Sin resultados"
          description={`No encontramos «${q}»${selected ? ` en ${selected.title}` : " en tus cursos"}. Prueba con otra palabra o con el inicio de la palabra (por ejemplo «prom» para «promesas»).`}
        />
      ) : (
        <>
          <p role="status" className="text-sm text-mist-400">
            {rows.length === LIMIT ? `Mostrando los ${LIMIT} resultados más relevantes` : `${rows.length} ${rows.length === 1 ? "lección encontrada" : "lecciones encontradas"}`} para «<span className="text-white">{q}</span>»{selected ? ` en ${selected.title}` : ""}.
          </p>
          {[...groups.values()].map((g) => (
            <section key={g.slug} aria-label={g.title} className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-mist-400">{g.title}</h3>
              <ul className="space-y-3">
                {g.items.map((r) => {
                  const Icon = icons[r.lesson_type];
                  return (
                    <li key={r.lesson_id}>
                      <Link href={`/aprender/${r.course_slug}/${r.lesson_id}?resaltar=${encodeURIComponent(q)}`} className="glass block rounded-2xl p-4 transition hover:ring-1 hover:ring-electric-400/40" data-testid="search-result">
                        <p className="flex items-center gap-2 text-xs text-mist-400">
                          <Icon className="size-3.5" aria-hidden /> {lessonTypeLabel[r.lesson_type]} · {r.module_title}
                        </p>
                        <p className="mt-1 font-medium text-white">{r.lesson_title}</p>
                        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-mist-300">
                          {parseSnippet(r.snippet).map((p, i) =>
                            p.hit ? <mark key={i} className="rounded bg-electric-500/25 px-0.5 text-white">{p.text}</mark> : <span key={i}>{p.text}</span>,
                          )}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
