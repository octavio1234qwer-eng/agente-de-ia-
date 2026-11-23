import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

type CourseOption = { slug: string; title: string };

/**
 * Formulario GET hacia /cuenta/buscar: funciona sin JavaScript y el resultado
 * queda en la URL (se puede compartir o volver con «atrás»).
 */
export function LessonSearchForm({
  q = "",
  course = "",
  courses,
  compact = false,
  autoFocus = false,
  className,
}: {
  q?: string;
  course?: string;
  /** Si se pasa, muestra un selector de curso; si no y hay `course`, la búsqueda queda fija en ese curso. */
  courses?: CourseOption[];
  compact?: boolean;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <form action="/cuenta/buscar" method="get" role="search" aria-label="Buscar en el contenido de mis cursos" className={cn("flex flex-col gap-2 sm:flex-row", compact && "sm:flex-col", className)}>
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Buscar en las lecciones</span>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-mist-400" aria-hidden />
        <input
          type="search"
          name="q"
          defaultValue={q}
          required
          minLength={2}
          maxLength={120}
          autoFocus={autoFocus}
          placeholder={compact ? "Buscar en este curso…" : "Busca un tema, comando o concepto…"}
          className={cn(
            "w-full rounded-xl border border-white/10 bg-white/[0.04] pl-10 pr-3 text-white placeholder:text-mist-500 focus:border-electric-400/60 focus:outline-none",
            compact ? "h-10 text-sm" : "h-11",
          )}
        />
      </label>
      {courses && courses.length > 1 ? (
        <label className="sm:w-56">
          <span className="sr-only">Curso</span>
          <select name="curso" defaultValue={course} className="h-11 w-full rounded-xl border border-white/10 bg-ink-900 px-3 text-sm text-white focus:border-electric-400/60 focus:outline-none">
            <option value="">Todos mis cursos</option>
            {courses.map((c) => (
              <option key={c.slug} value={c.slug}>{c.title}</option>
            ))}
          </select>
        </label>
      ) : course ? (
        <input type="hidden" name="curso" value={course} />
      ) : null}
      {!compact && (
        <button type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-electric-500 to-violet-500 px-5 text-sm font-medium text-white hover:opacity-95">
          Buscar
        </button>
      )}
    </form>
  );
}
