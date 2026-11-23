"use client";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { LoaderCircle, NotebookPen, Trash2 } from "lucide-react";
import { saveLessonNoteAction } from "@/lib/actions/learning";
import { NOTE_MAX } from "@/lib/notes";
import { cn, formatDate } from "@/lib/utils";

/** Bloc de notas privado del alumno para una lección. */
export function LessonNotes({ lessonId, initial, updatedAt }: { lessonId: string; initial: string; updatedAt: string | null }) {
  const [state, formAction, pending] = useActionState(saveLessonNoteAction, null);
  const [value, setValue] = useState(initial);
  const formRef = useRef<HTMLFormElement>(null);
  // Lo último que confirmó el servidor (se ajusta durante el render al llegar una respuesta).
  const [saved, setSaved] = useState(initial);
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state?.success) setSaved(state.values?.body ?? "");
  }
  const dirty = value.trim() !== saved.trim();
  const tooLong = value.length > NOTE_MAX;

  // Avisa antes de salir si hay cambios sin guardar.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  let status: React.ReactNode = null;
  if (pending) status = <span className="inline-flex items-center gap-1 text-mist-300"><LoaderCircle className="size-3.5 animate-spin" aria-hidden /> Guardando…</span>;
  else if (state?.error) status = <span className="text-red-300">{state.error}</span>;
  else if (dirty) status = <span className="text-amber-200">Cambios sin guardar</span>;
  else if (state?.success) status = <span className="text-emerald-300">{state.success}</span>;
  else if (updatedAt && saved) status = <span className="text-mist-400">Guardada el {formatDate(updatedAt, { dateStyle: "medium", timeStyle: "short" })}</span>;

  return (
    <section className="glass rounded-2xl p-5" aria-labelledby="mis-notas">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="mis-notas" className="inline-flex items-center gap-2 font-semibold text-white">
          <NotebookPen className="size-5 text-electric-300" aria-hidden /> Mis notas
        </h2>
        <Link href="/cuenta/notas" className="text-xs text-electric-300 underline-offset-4 hover:underline">Ver todas mis notas</Link>
      </div>
      <p className="mt-1 text-xs text-mist-400">Solo tú puedes verlas.</p>
      <form ref={formRef} action={formAction} className="mt-3 space-y-2">
        <input type="hidden" name="lesson_id" value={lessonId} />
        <label htmlFor="lesson-note" className="sr-only">Nota sobre esta lección</label>
        <textarea
          id="lesson-note"
          name="body"
          rows={5}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              if (dirty && !tooLong) formRef.current?.requestSubmit();
            }
          }}
          aria-describedby="lesson-note-status"
          placeholder="Escribe lo que quieras recordar de esta lección…"
          className="block w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-white placeholder:text-mist-500 focus:border-electric-400/60 focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending || !dirty || tooLong}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-electric-500 to-violet-500 px-4 text-sm font-medium text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Guardar nota
          </button>
          {saved && (
            <button
              type="submit"
              name="intent"
              value="delete"
              disabled={pending}
              onClick={(e) => {
                if (!window.confirm("¿Borrar tu nota de esta lección?")) e.preventDefault();
                else setValue("");
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm text-mist-300 hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
            >
              <Trash2 className="size-4" aria-hidden /> Borrar
            </button>
          )}
          <span id="lesson-note-status" role="status" className="text-xs">{status}</span>
          <span className={cn("ml-auto text-xs tabular-nums", tooLong ? "text-red-300" : "text-mist-500")}>{value.length}/{NOTE_MAX}</span>
        </div>
      </form>
    </section>
  );
}
