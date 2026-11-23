import { ArrowRight, Bot, CheckCircle2, PlayCircle, Sparkles } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import type { CourseCard } from "@/lib/data/catalog";
import { CourseCover } from "@/components/course/course-cover";
import { formatDuration, levelLabel } from "@/lib/utils";

export function Hero({ signedIn, spotlight }: { signedIn: boolean; spotlight: CourseCard | null }) {
  return (
    <section className="relative overflow-hidden">
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-electric-600/25 blur-[140px] animate-pulse-glow" />
      <div className="pointer-events-none absolute right-[-10%] top-40 h-[380px] w-[380px] rounded-full bg-violet-600/25 blur-[120px]" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:grid-cols-[1.1fr_1fr] lg:px-8 lg:pb-28">
        <div className="animate-fade-up">
          <span className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-mist-200">
            <Sparkles className="size-3.5 text-violet-300" aria-hidden />
            Aula virtual con tutor de inteligencia artificial
          </span>
          <h1 className="mt-6 text-5xl font-semibold leading-[1.02] tracking-[-0.03em] text-white sm:text-6xl lg:text-7xl">
            <span className="text-gradient">Aprende hoy.</span>
            <br />
            <span className="text-gradient-accent">Domina el mañana.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-mist-300">
            Cursos prácticos de desarrollo, inteligencia artificial, datos, diseño y negocios. Aprende a tu ritmo, resuelve dudas con NEXUS AI y obtén certificados verificables.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <LinkButton href="/cursos" size="lg">
              Explorar cursos <ArrowRight className="size-4" aria-hidden />
            </LinkButton>
            <LinkButton href={signedIn ? "/cuenta/cursos" : "/registro"} size="lg" variant="secondary">
              Comenzar ahora
            </LinkButton>
          </div>
          <ul className="mt-9 grid gap-2.5 text-sm text-mist-300 sm:grid-cols-2">
            {["Cursos gratuitos para empezar", "Acceso de por vida a tus compras", "Certificado con código QR", "Pagos seguros en MXN"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-400" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>

        {spotlight && (
          <div className="relative mx-auto w-full max-w-lg animate-fade-up [animation-delay:150ms] lg:max-w-none">
            <div className="glass-strong glow-border relative overflow-hidden rounded-3xl p-3 shadow-[0_40px_120px_-30px_rgb(59_116_255_/_0.6)]">
              <CourseCover
                title={spotlight.title}
                slug={spotlight.slug}
                coverUrl={spotlight.cover_url}
                color={spotlight.category?.color}
                icon={spotlight.category?.icon}
                className="aspect-[16/10] rounded-2xl"
                priority
              />
              <div className="absolute inset-x-3 top-3 grid aspect-[16/10] place-items-center">
                <span className="grid size-16 place-items-center rounded-full border border-white/20 bg-white/10 backdrop-blur-md">
                  <PlayCircle className="size-8 text-white" aria-hidden />
                </span>
              </div>
              <div className="p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-electric-300">Curso destacado</p>
                <h2 className="mt-1 text-xl font-semibold text-white">{spotlight.title}</h2>
                <p className="mt-1 text-sm text-mist-400">
                  {levelLabel[spotlight.level]} · {formatDuration(spotlight.duration_minutes)} · {spotlight.lessons_count} lecciones
                </p>
                <div className="mt-4"><LinkButton href={`/cursos/${spotlight.slug}`} variant="outline" size="sm">Ver curso</LinkButton></div>
              </div>
            </div>
            <div className="glass-strong absolute -left-8 top-16 hidden w-60 rounded-2xl p-4 shadow-2xl animate-float sm:block">
              <div className="flex items-center gap-2 text-xs font-semibold text-violet-300"><Bot className="size-4" aria-hidden /> NEXUS AI</div>
              <p className="mt-2 text-sm text-mist-200">“Explícame este concepto con un ejemplo y hazme 3 preguntas de práctica.”</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
