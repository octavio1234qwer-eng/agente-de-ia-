import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, BookOpen, Bot, Check, ChevronDown, Clock, FileText, Globe, Infinity as InfinityIcon, ListChecks, PlayCircle, Smartphone, Users, Dumbbell } from "lucide-react";
import { getCourseBySlug } from "@/lib/data/catalog";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CourseCover } from "@/components/course/course-cover";
import { PriceTag } from "@/components/course/price-tag";
import { Rating } from "@/components/course/rating";
import { PurchaseActions } from "@/components/course/purchase-actions";
import { ReviewForm } from "@/components/course/review-form";
import { Markdown } from "@/components/ui/markdown";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDuration, formatSeconds, levelLabel, lessonTypeLabel } from "@/lib/utils";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course) notFound();
  // Texto plano para buscadores y redes: subtítulo o, si no hay, el inicio de la descripción sin Markdown.
  const plain = (course.description ?? "").replace(/[#*_`>\[\]()!-]+/g, " ").replace(/\s+/g, " ").trim();
  const description = (course.subtitle?.trim() || plain || `Curso de ${course.title} en NEXUS ACADEMY.`).slice(0, 160);
  return {
    title: course.title,
    description,
    alternates: { canonical: `/cursos/${course.slug}` },
    openGraph: { title: course.title, description, images: course.cover_url ? [course.cover_url] : undefined },
  };
}

const typeIcon = { video: PlayCircle, article: FileText, quiz: ListChecks, exercise: Dumbbell } as const;

export default async function CoursePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course) notFound();

  const user = await getCurrentUser();
  const supabase = await createClient();
  const [reviewsRes, enrollmentRes, favoriteRes, cartRes, myReviewRes] = await Promise.all([
    supabase.rpc("course_reviews", { p_course_id: course.id, p_limit: 20 }),
    user ? supabase.from("enrollments").select("progress_percent").eq("course_id", course.id).eq("user_id", user.id).is("revoked_at", null).maybeSingle() : Promise.resolve({ data: null }),
    user ? supabase.from("favorites").select("course_id").eq("course_id", course.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    user ? supabase.from("cart_items").select("id").eq("course_id", course.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    user ? supabase.from("reviews").select("rating, comment").eq("course_id", course.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const reviews = reviewsRes.data ?? [];
  const enrolled = Boolean(enrollmentRes.data) || user?.role === "admin";
  const totalLessons = course.modules.reduce((s, m) => s + m.lessons.length, 0);
  const instructor = course.instructor_full;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    description: course.subtitle ?? course.description,
    provider: { "@type": "Organization", name: "NEXUS ACADEMY" },
    inLanguage: "es",
    offers: { "@type": "Offer", price: (course.price_cents / 100).toFixed(2), priceCurrency: course.currency, category: course.price_cents === 0 ? "Free" : "Paid" },
    ...(course.rating_count > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(course.rating_avg), reviewCount: course.rating_count } } : {}),
  };

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      {/* Encabezado */}
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="pointer-events-none absolute -top-32 left-1/3 h-96 w-[700px] rounded-full blur-[140px]" style={{ background: `${course.category?.color ?? "#3b74ff"}40` }} />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-8 lg:py-16">
          <div>
            <nav className="text-sm text-mist-400" aria-label="Ruta de navegación">
              <Link href="/cursos" className="hover:text-white">Cursos</Link>
              {course.category && (
                <>
                  <span className="mx-2" aria-hidden>/</span>
                  <Link href={`/cursos?categoria=${course.category.slug}`} className="hover:text-white">{course.category.name}</Link>
                </>
              )}
            </nav>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">{course.title}</h1>
            {course.subtitle && <p className="mt-4 max-w-2xl text-lg text-mist-300">{course.subtitle}</p>}
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-mist-300">
              <Rating value={Number(course.rating_avg)} count={course.rating_count} size="md" />
              {course.students_count > 0 && (
                <span className="inline-flex items-center gap-1.5"><Users className="size-4" aria-hidden />{course.students_count.toLocaleString("es-MX")} alumnos</span>
              )}
              <Badge tone="blue">{levelLabel[course.level]}</Badge>
            </div>
            {instructor && (
              <p className="mt-5 flex items-center gap-3 text-sm text-mist-300">
                <Avatar name={instructor.name} url={instructor.avatar_url} size={32} />
                Creado por <Link href={`/instructores#${instructor.slug}`} className="font-medium text-white hover:text-electric-300">{instructor.name}</Link>
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-mist-400">
              <span className="inline-flex items-center gap-1.5"><Clock className="size-4" aria-hidden />{formatDuration(course.duration_minutes)}</span>
              <span className="inline-flex items-center gap-1.5"><BookOpen className="size-4" aria-hidden />{totalLessons} lecciones</span>
              <span className="inline-flex items-center gap-1.5"><Globe className="size-4" aria-hidden />Español</span>
              <span>Actualizado {formatDate(course.updated_at, { month: "long", year: "numeric" })}</span>
            </div>
          </div>

          {/* Tarjeta de compra */}
          <aside className="lg:row-span-2">
            <div className="glass-strong glow-border overflow-hidden rounded-3xl lg:sticky lg:top-24">
              <CourseCover title={course.title} slug={course.slug} coverUrl={course.cover_url} color={course.category?.color} icon={course.category?.icon} className="aspect-video" priority sizes="380px" />
              <div className="space-y-5 p-6">
                <PriceTag price={course.price_cents} compareAt={course.compare_at_price_cents} currency={course.currency} size="lg" />
                <PurchaseActions
                  courseId={course.id}
                  slug={course.slug}
                  isFree={course.price_cents === 0}
                  enrolled={enrolled}
                  inCart={Boolean(cartRes.data)}
                  favorite={Boolean(favoriteRes.data)}
                  signedIn={Boolean(user)}
                />
                <ul className="space-y-2.5 border-t border-white/[0.06] pt-5 text-sm text-mist-300">
                  <li className="flex items-center gap-2.5"><InfinityIcon className="size-4 text-electric-300" aria-hidden />Acceso de por vida</li>
                  <li className="flex items-center gap-2.5"><Award className="size-4 text-electric-300" aria-hidden />Certificado verificable al completar</li>
                  <li className="flex items-center gap-2.5"><Bot className="size-4 text-electric-300" aria-hidden />Tutor NEXUS AI en cada lección</li>
                  <li className="flex items-center gap-2.5"><Smartphone className="size-4 text-electric-300" aria-hidden />Aprende desde el móvil o la computadora</li>
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-8">
        <div className="min-w-0 space-y-12">
          {course.what_you_will_learn.length > 0 && (
            <section className="glass rounded-3xl p-6 sm:p-8">
              <h2 className="text-2xl font-semibold text-white">Lo que aprenderás</h2>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {course.what_you_will_learn.map((item) => (
                  <li key={item} className="flex gap-3 text-sm text-mist-200"><Check className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden />{item}</li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="contenido-curso">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 id="contenido-curso" className="text-2xl font-semibold text-white">Contenido del curso</h2>
              <p className="text-sm text-mist-400">{course.modules.length} módulos · {totalLessons} lecciones · {formatDuration(course.duration_minutes)}</p>
            </div>
            <div className="mt-5 space-y-3">
              {course.modules.map((m, mi) => (
                <details key={m.id} className="group glass overflow-hidden rounded-2xl" open={mi === 0}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
                    <span>
                      <span className="text-xs text-mist-400">Módulo {mi + 1}</span>
                      <span className="block font-medium text-white">{m.title}</span>
                    </span>
                    <span className="flex items-center gap-3 text-xs text-mist-400">
                      {m.lessons.length} lecciones
                      <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
                    </span>
                  </summary>
                  <ul className="border-t border-white/[0.06]">
                    {m.lessons.map((l) => {
                      const Icon = typeIcon[l.type];
                      const canOpen = enrolled || l.is_preview;
                      const inner = (
                        <>
                          <Icon className="size-4 shrink-0 text-mist-400" aria-hidden />
                          <span className="flex-1 text-sm text-mist-200">{l.title}</span>
                          {l.is_preview && !enrolled && <Badge tone="violet">Vista previa</Badge>}
                          <span className="hidden text-xs text-mist-400 sm:inline">{lessonTypeLabel[l.type]}</span>
                          <span className="w-14 text-right text-xs text-mist-400">{formatSeconds(l.duration_seconds)}</span>
                        </>
                      );
                      return (
                        <li key={l.id} className="border-b border-white/[0.04] last:border-0">
                          {canOpen ? (
                            <Link href={`/aprender/${course.slug}/${l.id}`} className="flex min-h-12 items-center gap-3 px-5 py-2.5 transition hover:bg-white/[0.04]">{inner}</Link>
                          ) : (
                            <div className="flex min-h-12 items-center gap-3 px-5 py-2.5">{inner}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </details>
              ))}
            </div>
          </section>

          {course.description && (
            <section>
              <h2 className="text-2xl font-semibold text-white">Descripción</h2>
              <Markdown className="mt-4">{course.description}</Markdown>
            </section>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            {course.requirements.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold text-white">Requisitos</h2>
                <ul className="mt-4 space-y-2 text-sm text-mist-300">
                  {course.requirements.map((r) => <li key={r} className="flex gap-2"><span className="text-electric-400" aria-hidden>•</span>{r}</li>)}
                </ul>
              </section>
            )}
            {course.target_audience.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold text-white">¿Para quién es este curso?</h2>
                <ul className="mt-4 space-y-2 text-sm text-mist-300">
                  {course.target_audience.map((r) => <li key={r} className="flex gap-2"><span className="text-violet-400" aria-hidden>•</span>{r}</li>)}
                </ul>
              </section>
            )}
          </div>

          {instructor && (
            <section id="instructor" className="glass rounded-3xl p-6 sm:p-8">
              <h2 className="text-xl font-semibold text-white">Instructor</h2>
              <div className="mt-5 flex items-start gap-4">
                <Avatar name={instructor.name} url={instructor.avatar_url} size={64} />
                <div>
                  <p className="text-lg font-medium text-white">{instructor.name}</p>
                  {instructor.headline && <p className="text-sm text-electric-300">{instructor.headline}</p>}
                  {instructor.bio && <p className="mt-3 text-sm leading-relaxed text-mist-300">{instructor.bio}</p>}
                </div>
              </div>
            </section>
          )}

          <section aria-labelledby="opiniones">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="opiniones" className="text-2xl font-semibold text-white">Opiniones</h2>
              <Rating value={Number(course.rating_avg)} count={course.rating_count} size="md" />
            </div>
            {enrollmentRes.data && (
              <div className="mt-5"><ReviewForm courseId={course.id} slug={course.slug} initial={myReviewRes.data} /></div>
            )}
            {reviews.length > 0 ? (
              <ul className="mt-6 space-y-4">
                {reviews.map((r) => (
                  <li key={r.id} className="glass rounded-2xl p-5">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.author_name} url={r.author_avatar} size={36} />
                      <div>
                        <p className="text-sm font-medium text-white">{r.author_name}</p>
                        <p className="text-xs text-mist-400">{formatDate(r.created_at)}</p>
                      </div>
                      <Rating value={r.rating} count={1} className="ml-auto [&>span:last-child]:hidden" />
                    </div>
                    {r.comment && <p className="mt-3 text-sm leading-relaxed text-mist-200">{r.comment}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-5 text-sm text-mist-400">Este curso aún no tiene reseñas. Solo los alumnos inscritos pueden publicar una.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
