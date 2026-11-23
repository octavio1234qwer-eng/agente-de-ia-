"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, LoaderCircle, RotateCcw, XCircle } from "lucide-react";
import { submitQuizAction, type QuizResult } from "@/lib/actions/learning";
import { cn } from "@/lib/utils";

type Question = { id: string; prompt: string; options: string[] };

export function QuizRunner({ lessonId, questions, passPercent, alreadyPassed, canSubmit }: {
  lessonId: string;
  questions: Question[];
  passPercent: number;
  alreadyPassed: boolean;
  canSubmit: boolean;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const answered = Object.keys(answers).length;
  const byId = new Map(result?.results.map((r) => [r.question_id, r]));

  const submit = () =>
    start(async () => {
      setError(null);
      const res = await submitQuizAction(lessonId, answers);
      if (res.error || !res.result) return setError(res.error ?? "No se pudo enviar.");
      setResult(res.result);
      if (res.result.passed) router.refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-5 text-sm text-mist-300">
        {questions.length} preguntas · Necesitas {passPercent}% para aprobar.
        {alreadyPassed && !result && <span className="ml-2 font-medium text-emerald-300">Ya aprobaste esta evaluación.</span>}
      </div>

      {result && (
        <div role="status" className={cn("rounded-2xl border p-5", result.passed ? "border-emerald-400/30 bg-emerald-500/10" : "border-amber-400/30 bg-amber-500/10")}>
          <p className="flex items-center gap-2 text-lg font-semibold text-white">
            {result.passed ? <CheckCircle2 className="size-5 text-emerald-300" /> : <XCircle className="size-5 text-amber-300" />}
            {result.passed ? "¡Aprobado!" : "Aún no apruebas"} · {result.score}/{result.total}
          </p>
          <p className="mt-1 text-sm text-mist-200">
            {result.passed ? "La evaluación quedó registrada como completada." : "Revisa las preguntas marcadas e inténtalo de nuevo. Las respuestas correctas se muestran al aprobar."}
          </p>
        </div>
      )}

      <ol className="space-y-5">
        {questions.map((q, qi) => {
          const r = byId.get(q.id);
          return (
            <li key={q.id} className="glass rounded-2xl p-5">
              <p className="font-medium text-white"><span className="mr-2 text-mist-400">{qi + 1}.</span>{q.prompt}</p>
              <div className="mt-4 grid gap-2" role="radiogroup" aria-label={`Pregunta ${qi + 1}`}>
                {q.options.map((opt, oi) => {
                  const selected = answers[q.id] === oi;
                  const isCorrect = r?.correct_index === oi;
                  const wrongPick = r && selected && !r.correct;
                  return (
                    <label
                      key={oi}
                      className={cn(
                        "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 text-sm transition",
                        selected ? "border-electric-400/60 bg-electric-500/10 text-white" : "border-white/10 text-mist-200 hover:border-white/20",
                        isCorrect && "border-emerald-400/60 bg-emerald-500/10",
                        wrongPick && "border-red-400/50 bg-red-500/10",
                      )}
                    >
                      <input type="radio" name={q.id} checked={selected} disabled={pending || Boolean(result?.passed)} onChange={() => { setAnswers((a) => ({ ...a, [q.id]: oi })); setResult(null); }} className="size-4 accent-electric-500" />
                      {opt}
                    </label>
                  );
                })}
              </div>
              {r && (
                <p className={cn("mt-3 text-sm", r.correct ? "text-emerald-300" : "text-amber-200")}>
                  {r.correct ? "Correcto." : "Incorrecto."} {r.explanation && (result?.passed || r.correct) ? r.explanation : ""}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {canSubmit ? (
        result && !result.passed ? (
          <button type="button" onClick={() => { setResult(null); setAnswers({}); }} className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/10 px-5 text-sm text-white hover:bg-white/[0.06]">
            <RotateCcw className="size-4" /> Reintentar
          </button>
        ) : !result?.passed ? (
          <button type="button" onClick={submit} disabled={pending || answered < questions.length} className="inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-electric-500 to-violet-600 px-6 text-sm font-medium text-white disabled:opacity-50">
            {pending && <LoaderCircle className="size-4 animate-spin" />} Enviar respuestas ({answered}/{questions.length})
          </button>
        ) : null
      ) : (
        <p className="text-sm text-mist-400">Inscríbete en el curso para enviar la evaluación.</p>
      )}
    </div>
  );
}
