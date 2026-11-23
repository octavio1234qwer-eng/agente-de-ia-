"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, LoaderCircle } from "lucide-react";
import { setLessonCompleteAction } from "@/lib/actions/learning";
import { cn } from "@/lib/utils";

export function LessonActions({ lessonId, completed, isQuiz, canTrack, prevHref, nextHref }: {
  lessonId: string;
  completed: boolean;
  isQuiz: boolean;
  canTrack: boolean;
  prevHref: string | null;
  nextHref: string | null;
}) {
  const router = useRouter();
  const [done, setDone] = useState(completed);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = (goNext: boolean) =>
    start(async () => {
      setError(null);
      const target = goNext ? true : !done;
      const res = await setLessonCompleteAction(lessonId, target);
      if (res?.error) return setError(res.error);
      setDone(target);
      if (goNext && nextHref) router.push(nextHref);
      else router.refresh();
    });

  return (
    <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-2">
        {prevHref && (
          <Link href={prevHref} className="inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm text-mist-300 hover:bg-white/[0.06] hover:text-white"><ArrowLeft className="size-4" aria-hidden /> Anterior</Link>
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {canTrack && !isQuiz && (
          <button
            type="button"
            onClick={() => toggle(false)}
            disabled={pending}
            className={cn("inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm transition", done ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-white/10 text-mist-200 hover:bg-white/[0.06]")}
            aria-pressed={done}
          >
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : done ? <CheckCircle2 className="size-4" /> : <Circle className="size-4" />}
            {done ? "Completada" : "Marcar como completada"}
          </button>
        )}
        {nextHref && (
          canTrack && !isQuiz && !done ? (
            <button type="button" onClick={() => toggle(true)} disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-electric-500 to-violet-600 px-5 text-sm font-medium text-white">
              Completar y continuar <ArrowRight className="size-4" aria-hidden />
            </button>
          ) : (
            <Link href={nextHref} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-electric-500 to-violet-600 px-5 text-sm font-medium text-white">
              Siguiente lección <ArrowRight className="size-4" aria-hidden />
            </Link>
          )
        )}
      </div>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    </div>
  );
}
