import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { getCategories, searchCatalog, type CatalogFilters as Filters } from "@/lib/data/catalog";
import { getCurrentUser } from "@/lib/auth";
import { getMyEnrollmentMap } from "@/lib/data/user";
import { CourseCard } from "@/components/course/course-card";
import { CatalogFilters, CatalogSearch } from "@/components/course/catalog-filters";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Catálogo de cursos",
  description: "Explora cursos de desarrollo web, inteligencia artificial, ciencia de datos, diseño y negocios.",
};

const sortMap = {
  populares: "popular",
  recientes: "newest",
  valorados: "rating",
  "precio-asc": "price_asc",
  "precio-desc": "price_desc",
} as const;

const levels = ["beginner", "intermediate", "advanced"] as const;

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function CatalogPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const sortKey = (one(sp.orden) in sortMap ? one(sp.orden) : "populares") as keyof typeof sortMap;
  const level = levels.find((l) => l === one(sp.nivel));
  const max = Number(one(sp.max));
  const filters: Filters = {
    q: one(sp.q).slice(0, 100),
    category: one(sp.categoria) || undefined,
    price: one(sp.precio) === "gratis" ? "free" : one(sp.precio) === "pago" ? "paid" : undefined,
    level,
    maxPrice: Number.isFinite(max) && max > 0 ? Math.round(max * 100) : undefined,
    sort: sortMap[sortKey],
    page: Math.max(1, Number(one(sp.pagina)) || 1),
  };

  const [user, categories, result] = await Promise.all([getCurrentUser(), getCategories(), searchCatalog(filters)]);
  const enrollments = await getMyEnrollmentMap(user?.id ?? null);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  const pageHref = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v && k !== "pagina") qs.set(k, v);
    if (p > 1) qs.set("pagina", String(p));
    return `/cursos${qs.toString() ? `?${qs}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-10 sm:px-6 lg:px-8">
      <div className="relative">
        <p className="pointer-events-none absolute -top-6 left-0 select-none text-[clamp(3rem,10vw,7rem)] font-bold leading-none tracking-tighter text-white/[0.03]" aria-hidden>
          Catálogo
        </p>
        <h1 className="relative text-4xl font-semibold tracking-tight text-white sm:text-5xl">Catálogo de cursos</h1>
        <p className="relative mt-3 max-w-2xl text-mist-300">Encuentra tu próxima habilidad. Filtra por categoría, nivel o precio y empieza hoy.</p>
      </div>

      <div className="mt-8 flex gap-2 overflow-x-auto pb-1" role="list" aria-label="Categorías">
        <Link role="listitem" href="/cursos" className={cn("shrink-0 rounded-full border px-4 py-2 text-sm transition", !filters.category ? "border-electric-400/50 bg-electric-500/15 text-white" : "border-white/10 text-mist-300 hover:text-white")}>Todos</Link>
        {categories.map((c) => (
          <Link
            role="listitem"
            key={c.id}
            href={`/cursos?categoria=${c.slug}`}
            className={cn("shrink-0 rounded-full border px-4 py-2 text-sm transition", filters.category === c.slug ? "border-electric-400/50 bg-electric-500/15 text-white" : "border-white/10 text-mist-300 hover:text-white")}
          >
            {c.name}
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr]">
        <CatalogFilters categories={categories.map((c) => ({ value: c.slug, label: c.name }))} />
        <div>
          <CatalogSearch defaultValue={filters.q ?? ""} sort={sortKey} />
          {/* Encabezado para lectores de pantalla: las tarjetas usan h3. */}
          <h2 className="sr-only">Resultados</h2>
          <p className="mt-5 text-sm text-mist-400" aria-live="polite">
            {result.total === 1 ? "1 curso" : `${result.total} cursos`}
            {filters.q ? <> para «<span className="text-white">{filters.q}</span>»</> : null}
          </p>
          {result.courses.length > 0 ? (
            <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {result.courses.map((c, i) => (
                <CourseCard key={c.id} course={c} priority={i < 3} progress={enrollments.get(c.id)?.progress ?? null} />
              ))}
            </div>
          ) : (
            <EmptyState
              className="mt-6"
              icon={<SearchX className="size-6" />}
              title="No encontramos cursos con esos filtros"
              description="Prueba con otras palabras o quita algunos filtros."
              action={<LinkButton href="/cursos" variant="secondary">Ver todos los cursos</LinkButton>}
            />
          )}
          {totalPages > 1 && (
            <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Paginación">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={pageHref(p)}
                  aria-current={p === result.page ? "page" : undefined}
                  className={cn("grid size-10 place-items-center rounded-xl text-sm", p === result.page ? "bg-electric-500/20 text-white ring-1 ring-electric-400/40" : "text-mist-300 hover:bg-white/[0.05]")}
                >
                  {p}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
