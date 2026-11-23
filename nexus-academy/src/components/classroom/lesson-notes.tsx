"use client";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Clock, LoaderCircle, NotebookPen, Play, Trash2 } from "lucide-react";
import { saveLessonNoteAction } from "@/lib/actions/learning";
import { formatTimestamp, NOTE_MAX, parseTimestamps } from "@/lib/notes";
import { cn, formatDate } from "@/lib/utils";

const lessonVideo = () => document.querySelector<HTMLVideoElement>("video[data-lesson-video]");

/**
 * Bloc de notas privado del alumno para una lección. En lecciones con video
 * propio permite insertar marcas de tiempo ([1:15]) que saltan a ese segundo.
 */
export function LessonNotes({ lessonId, initial, updatedAt, withVideo = false }: { lessonId: string; initial: string; updatedAt: string | null; withVideo?: boolean }) {
  const [state, formAction, pending] = useActionState(saveLessonNoteAction, null);
  const [value, setValue] = useState(initial);
  const formRef = useRef<HTMLFormElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const stamps = withVideo ? parseTimestamps(value) : [];

  function insertTimestamp() {
    const video = lessonVideo();
    const el = textRef.current;
    if (!video || !el) return;
    const stamp = `[${formatTimestamp(video.currentTime)}] `;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? start;
    const prefix = start > 0 && value[start - 1] !== "\n" ? "\n" : "";
    const next = value.slice(0, start) + prefix + stamp + value.slice(end);
    // Síncrono: si el alumno sigue escribiendo justo después del clic, ninguna
    // tecla se pierde ni cae antes de la marca.
    flushSync(() => setValue(next));
    const cursor = start + prefix.length + stamp.length;
    el.focus();
    el.setSelectionRange(cursor, cursor);
  }

  function seek(seconds: number) {
    const video = lessonVideo();
    if (!video) return;
    video.currentTime = seconds;
    video.scrollIntoView({ block: "center", behavior: "smooth" });
    void video.play().catch(() => {});
  }
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
          ref={textRef}
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
          placeholder={withVideo ? "Escribe lo que quieras recordar. Con «Marca de tiempo» guardas el segundo exacto del video…" : "Escribe lo que quieras recordar de esta lección…"}
          className="block w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-white placeholder:text-mist-500 focus:border-electric-400/60 focus:outline-none"
        />
        {stamps.length > 0 && (
          <ul aria-label="Marcas de tiempo de tu nota" className="flex flex-wrap gap-2">
            {stamps.map((t, i) => (
              <li key={`${t.seconds}-${i}`}>
                <button type="button" onClick={() => seek(t.seconds)} className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-xs text-mist-100 hover:bg-white/[0.1]" title={`Ir a ${t.label} del video`}>
                  <Play className="size-3 shrink-0 text-electric-300" aria-hidden />
                  <span className="font-mono tabular-nums text-white">{t.label}</span>
                  {t.text && <span className="max-w-48 truncate text-mist-300">{t.text}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {withVideo && (
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={insertTimestamp} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-sm text-mist-100 hover:bg-white/[0.06]">
              <Clock className="size-4" aria-hidden /> Marca de tiempo
            </button>
          )}
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
