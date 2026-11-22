import Link from "next/link";
import { ArrowRight, Bot, FileText, ListChecks, MessageSquare, PlayCircle, Quote, Route, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getCategories, getCoursesBy, getFeaturedReviews, getInstructors, getPublicStats } from "@/lib/data/catalog";
import { Hero } from "@/components/home/hero";
import { AcademyStats } from "@/components/home/stats";
import { Faq } from "@/components/home/faq";
import { CourseCard } from "@/components/course/course-card";
import { SectionHeading } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { CategoryIcon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Rating } from "@/components/course/rating";

export default async function HomePage() {
  const [user, featured, bestSellers, newest, categories, stats, reviews, instructors] = await Promise.all([
    getCurrentUser(),
    getCoursesBy({ featured: true, order: "published_at", limit: 6 }),
    getCoursesBy({ order: "students_count", limit: 4 }),
    getCoursesBy({ order: "published_at", limit: 4 }),
    getCategories(),
    getPublicStats(),
    getFeaturedReviews(6),
    getInstructors(4),
  ]);

  const hasSales = bestSellers.some((c) => c.students_count > 0);
  const ranked = bestSellers.filter((c) => c.students_count > 0);

  return (
    <>
      <Hero signedIn={Boolean(user)} spotlight={featured[0] ?? newest[0] ?? null} />

      <AcademyStats stats={stats} />

      {/* Categorías */}
      <section className="mx-auto mt-24 max-w-7xl px-4 sm:px-6 lg:px-8" aria-labelledby="categorias">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <SectionHeading eyebrow="Explora" title="Categorías educativas" description="Rutas de aprendizaje para las habilidades más demandadas." />
          <LinkButton href="/cursos" variant="ghost" size="sm">Ver todo el catálogo <ArrowRight className="size-4" aria-hidden /></LinkButton>
        </div>
        <h2 id="categorias" className="sr-only">Categorías</h2>
        <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/cursos?categoria=${c.slug}`}
              className="group glass relative overflow-hidden rounded-2xl p-5 transition hover:-translate-y-0.5 hover:bg-white/[0.06] sm:p-6"
            >
              <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full opacity-25 blur-2xl transition group-hover:opacity-50" style={{ background: c.color }} />
              <span className="grid size-11 place-items-center rounded-xl border border-white/10 bg-white/[0.05]" style={{ color: c.color }}>
                <CategoryIcon name={c.icon} className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold text-white">{c.name}</h3>
              <p className="mt-1 line-clamp-2 hidden text-sm text-mist-400 sm:block">{c.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Destacados */}
      {featured.length > 0 && (
        <section className="mx-auto mt-24 max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="Selección" title="Cursos destacados" description="Elegidos por el equipo académico para empezar con el pie derecho." />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((c) => <CourseCard key={c.id} course={c} />)}
          </div>
        </section>
      )}

      {/* Más vendidos */}
      <section className="mx-auto mt-24 max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Tendencia" title="Cursos más vendidos" description="Ranking calculado automáticamente con las inscripciones reales." />
        {hasSales ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {ranked.map((c) => <CourseCard key={c.id} course={c} />)}
          </div>
        ) : (
          <EmptyState
            className="mt-10"
            icon={<Sparkles className="size-6" />}
            title="El ranking se está formando"
            description="Todavía no hay inscripciones suficientes para un ranking. En cuanto los alumnos se inscriban, aquí verás los cursos más populares."
            action={<LinkButton href="/cursos" variant="secondary">Explorar el catálogo</LinkButton>}
          />
        )}
      </section>

      {/* Nuevos lanzamientos */}
      {newest.length > 0 && (
        <section className="mx-auto mt-24 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <SectionHeading eyebrow="Recién llegados" title="Nuevos lanzamientos" />
            <LinkButton href="/cursos?orden=recientes" variant="ghost" size="sm">Ver novedades <ArrowRight className="size-4" aria-hidden /></LinkButton>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {newest.map((c) => <CourseCard key={c.id} course={c} />)}
          </div>
        </section>
      )}

      {/* Aula virtual + NEXUS AI */}
      <section className="relative mx-auto mt-28 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="glass-strong glow-border relative overflow-hidden rounded-[32px] p-8 sm:p-12">
          <div className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-violet-600/25 blur-[100px]" />
          <div className="relative grid gap-12 lg:grid-cols-2">
            <div>
              <SectionHeading
                eyebrow="Aula virtual"
                title="Una experiencia de aprendizaje que se adapta a ti"
                description="Video, lecturas, ejercicios y evaluaciones en un solo lugar. Retoma donde te quedaste en cualquier dispositivo."
              />
              <ul className="mt-8 grid gap-4 sm:grid-cols-2">
                {[
                  { icon: PlayCircle, t: "Reproductor inteligente", d: "Recuerda tu posición y marca tu avance." },
                  { icon: ListChecks, t: "Evaluaciones", d: "Cuestionarios con retroalimentación inmediata." },
                  { icon: FileText, t: "Recursos descargables", d: "PDF, plantillas y material de apoyo." },
                  { icon: Route, t: "Progreso visible", d: "Certificado automático al completar." },
                ].map(({ icon: Icon, t, d }) => (
                  <li key={t} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                    <Icon className="size-5 text-electric-300" aria-hidden />
                    <p className="mt-3 font-medium text-white">{t}</p>
                    <p className="mt-1 text-sm text-mist-400">{d}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col justify-center">
              <div className="rounded-3xl border border-white/[0.08] bg-ink-900/80 p-5 shadow-2xl">
                <div className="flex items-center gap-3 border-b border-white/[0.06] pb-4">
                  <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-electric-500 to-violet-600"><Bot className="size-5 text-white" aria-hidden /></span>
                  <div>
                    <p className="font-semibold text-white">NEXUS AI</p>
                    <p className="text-xs text-mist-400">Tu tutor personal, dentro de cada lección</p>
                  </div>
                </div>
                <ul className="mt-4 space-y-2.5">
                  {[
                    "Responde preguntas sobre la lección",
                    "Explica conceptos difíciles con ejemplos",
                    "Crea resúmenes y preguntas de práctica",
                    "Recomienda cursos y arma tu ruta de aprendizaje",
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3.5 py-3 text-sm text-mist-200">
                      <MessageSquare className="size-4 shrink-0 text-violet-300" aria-hidden /> {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-5"><LinkButton href="/nexus-ai" variant="secondary" className="w-full">Probar NEXUS AI</LinkButton></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Opiniones */}
      <section className="mx-auto mt-28 max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Comunidad" title="Opiniones de alumnos" description="Reseñas publicadas por alumnos inscritos en los cursos." />
        {reviews.length > 0 ? (
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r) => (
              <figure key={r.id} className="glass flex flex-col rounded-2xl p-6">
                <Quote className="size-6 text-violet-400/70" aria-hidden />
                <blockquote className="mt-3 flex-1 text-[15px] leading-relaxed text-mist-200">“{r.comment}”</blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <Avatar name={r.author_name} url={r.author_avatar} size={40} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{r.author_name}</p>
                    <Link href={`/cursos/${r.course_slug}`} className="block truncate text-xs text-mist-400 hover:text-electric-300">{r.course_title}</Link>
                  </div>
                  <Rating value={r.rating} count={1} className="ml-auto [&>span:last-child]:hidden" />
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <EmptyState
            className="mt-10"
            icon={<Quote className="size-6" />}
            title="Aún no hay opiniones publicadas"
            description="Las reseñas solo pueden escribirlas alumnos inscritos. Aparecerán aquí en cuanto se publiquen."
          />
        )}
      </section>

      {/* Instructores */}
      {instructors.length > 0 && (
        <section className="mx-auto mt-28 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <SectionHeading eyebrow="Docentes" title="Aprende de equipos especializados" />
            <LinkButton href="/instructores" variant="ghost" size="sm">Conocer a los instructores <ArrowRight className="size-4" aria-hidden /></LinkButton>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {instructors.map((i) => (
              <Link key={i.id} href={`/instructores#${i.slug}`} className="glass rounded-2xl p-6 transition hover:bg-white/[0.06]">
                <Avatar name={i.name} url={i.avatar_url} size={56} />
                <h3 className="mt-4 font-semibold text-white">{i.name}</h3>
                {i.headline && <p className="mt-1 text-sm text-mist-400">{i.headline}</p>}
                <p className="mt-4 text-xs text-electric-300">{i.courseCount} {i.courseCount === 1 ? "curso" : "cursos"}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* FAQ */}
      <section id="faq" className="mx-auto mt-28 max-w-7xl scroll-mt-24 px-4 sm:px-6 lg:px-8">
        <SectionHeading align="center" eyebrow="Dudas" title="Preguntas frecuentes" />
        <div className="mt-10"><Faq /></div>
      </section>

      {/* CTA */}
      <section className="mx-auto mt-28 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-electric-600/30 via-ink-850 to-violet-700/30 p-10 text-center sm:p-16">
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
          <h2 className="relative text-3xl font-semibold tracking-tight text-white sm:text-5xl">Tu próxima habilidad empieza hoy</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-mist-200">Crea tu cuenta gratis, empieza con un curso sin costo y avanza a tu ritmo.</p>
          <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <LinkButton href={user ? "/cuenta/cursos" : "/registro"} size="lg">Comenzar ahora</LinkButton>
            <LinkButton href="/cursos?precio=gratis" size="lg" variant="secondary">Ver cursos gratuitos</LinkButton>
          </div>
        </div>
      </section>
    </>
  );
}
