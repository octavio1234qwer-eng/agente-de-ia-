import { Award, BookOpen, Clock, GraduationCap, Layers, Users } from "lucide-react";

type Stats = { courses?: number; students?: number; lessons?: number; hours?: number; certificates?: number; instructors?: number };

/** Estadísticas reales calculadas en la base de datos (se ocultan las que son cero). */
export function AcademyStats({ stats }: { stats: Stats }) {
  const items = [
    { label: "Cursos publicados", value: stats.courses, icon: BookOpen },
    { label: "Lecciones", value: stats.lessons, icon: Layers },
    { label: "Horas de contenido", value: stats.hours, icon: Clock },
    { label: "Alumnos inscritos", value: stats.students, icon: Users },
    { label: "Certificados emitidos", value: stats.certificates, icon: Award },
    { label: "Equipos docentes", value: stats.instructors, icon: GraduationCap },
  ].filter((i) => (i.value ?? 0) > 0);
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="stats-title" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <h2 id="stats-title" className="sr-only">La academia en números</h2>
      <div className="glass grid grid-cols-2 divide-white/[0.06] rounded-3xl sm:grid-cols-3 lg:flex lg:divide-x">
        {items.map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex flex-1 items-center gap-4 p-6">
            <span className="grid size-11 place-items-center rounded-xl bg-white/[0.05] text-electric-300"><Icon className="size-5" aria-hidden /></span>
            <div>
              <p className="text-2xl font-semibold tracking-tight text-white">{(value ?? 0).toLocaleString("es-MX")}</p>
              <p className="text-xs text-mist-400">{label}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-mist-400">Cifras calculadas en tiempo real a partir de la plataforma.</p>
    </section>
  );
}
