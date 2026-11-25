import Link from "next/link";
import { Check, Flame, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { WeeklyGoalForm } from "@/components/account/weekly-goal-form";
import { cn } from "@/lib/utils";
import { WEEKDAYS, dayLabel, dayStatus, goalMessage, goalPercent, plural, streakMessage, utcOffset, type LearningStats } from "@/lib/learning-stats";

const dotStyles = {
  active: "bg-gradient-to-br from-electric-500 to-violet-500 text-white",
  today: "border-2 border-dashed border-electric-300/70 text-electric-200",
  missed: "bg-white/[0.04] text-mist-400",
  future: "border border-white/10 text-mist-400",
} as const;

/** Racha de días con actividad y meta semanal, calculadas con el progreso real del alumno. */
export function LearningStatsCard({ stats }: { stats: LearningStats }) {
  const met = stats.week_lessons >= stats.weekly_goal;
  return (
    <Card className="p-5 sm:p-6" data-testid="learning-stats">
      <h2 className="text-lg font-semibold text-white">Tu ritmo de estudio</h2>
      <div className="mt-5 grid gap-6 md:grid-cols-[1fr_1.3fr]">
        <div className="flex items-start gap-4">
          <div className={cn("grid size-12 shrink-0 place-items-center rounded-2xl", stats.current_streak > 0 ? "bg-amber-400/15 text-amber-300" : "bg-white/[0.05] text-mist-400")}>
            <Flame className="size-6" aria-hidden />
          </div>
          <div>
            <p className="text-sm text-mist-400">Racha actual</p>
            <p className="text-2xl font-semibold text-white" data-testid="current-streak">{plural(stats.current_streak, "día", "días")}</p>
            <p className="mt-1 text-sm text-mist-400" data-testid="longest-streak">Mejor racha: {plural(stats.longest_streak, "día", "días")}</p>
          </div>
        </div>
        <div className="flex items-start gap-4">
          <div className={cn("grid size-12 shrink-0 place-items-center rounded-2xl", met ? "bg-emerald-400/15 text-emerald-300" : "bg-electric-500/15 text-electric-300")}>
            <Target className="size-6" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-mist-400">Meta de esta semana</p>
            <p className="text-2xl font-semibold text-white" data-testid="week-progress">
              {stats.week_lessons} <span className="text-base font-normal text-mist-400">de {plural(stats.weekly_goal, "lección", "lecciones")}</span>
            </p>
            <ProgressBar value={goalPercent(stats)} className="mt-2" label="Avance de la meta semanal" />
            <p className="mt-2 text-sm text-mist-300" data-testid="goal-message">{goalMessage(stats)}</p>
          </div>
        </div>
      </div>

      <ol className="mt-6 grid grid-cols-7 gap-2" aria-label="Actividad de esta semana">
        {stats.week.map((day, i) => {
          const status = dayStatus(day, stats.today);
          return (
            <li key={day.date} className="flex flex-col items-center gap-1.5" data-status={status}>
              <span className={cn("grid size-9 place-items-center rounded-full text-xs font-semibold sm:size-10", dotStyles[status])} aria-hidden>
                {day.lessons > 0 ? day.lessons : status === "active" ? <Check className="size-4" /> : null}
              </span>
              <span className={cn("text-xs", day.date === stats.today ? "font-semibold text-white" : "text-mist-400")} aria-hidden>{WEEKDAYS[i].short}</span>
              <span className="sr-only">{dayLabel(day, i, stats.today)}</span>
            </li>
          );
        })}
      </ol>

      <p className="mt-5 text-sm text-white" data-testid="streak-message">{streakMessage(stats)}</p>
      <div className="mt-4 flex flex-col gap-4 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-md text-xs leading-relaxed text-mist-400">
          Cuenta como estudio avanzar un video, marcar una lección, presentar una evaluación o guardar una nota. Los días se cuentan en tu zona horaria ({stats.time_zone.replace(/_/g, " ")}, {utcOffset(stats.time_zone)}) ·{" "}
          <Link href="/cuenta/ajustes#zona-horaria" className="text-electric-300 underline underline-offset-2 hover:text-electric-200">Cambiar</Link>
        </p>
        <WeeklyGoalForm goal={stats.weekly_goal} />
      </div>
    </Card>
  );
}
