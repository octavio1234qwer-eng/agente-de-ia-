"use client";
import { useActionState } from "react";
import { Captions, LoaderCircle, Trash2 } from "lucide-react";
import { saveLessonCaptionsAction } from "@/lib/actions/admin";
import { CAPTION_LANGS } from "@/lib/captions";

/** Carga de subtítulos (.vtt o .srt) para una lección de video. */
export function CaptionsForm({ lessonId, hasCaptions, lang, provider }: { lessonId: string; hasCaptions: boolean; lang: string; provider: string | null }) {
  const [state, action, pending] = useActionState(saveLessonCaptionsAction, null);
  const embed = provider === "youtube" || provider === "vimeo";
  // Tras una respuesta, refleja si quedaron o no subtítulos sin esperar a recargar.
  const loaded = state?.success ? !state.success.startsWith("Subtítulos quitados") : hasCaptions;

  return (
    <div className="space-y-3">
      {embed && <p className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">Este video está en {provider === "youtube" ? "YouTube" : "Vimeo"}: sus subtítulos se administran en esa plataforma. Los que subas aquí se usan con videos subidos o con URL directa, y siempre sirven para la búsqueda.</p>}
      <p className="flex items-center gap-2 text-sm text-mist-200" data-testid="captions-status">
        <Captions className="size-4 text-electric-300" aria-hidden />
        {loaded ? `Subtítulos cargados (${CAPTION_LANGS[lang as keyof typeof CAPTION_LANGS] ?? lang})` : "Sin subtítulos"}
      </p>
      <form action={action} className="space-y-3">
        <input type="hidden" name="lesson_id" value={lessonId} />
        <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
          <label className="block">
            <span className="sr-only">Archivo de subtítulos</span>
            <input type="file" name="file" accept=".vtt,.srt,text/vtt,application/x-subrip" required className="block w-full text-sm text-mist-300 file:mr-3 file:h-10 file:rounded-xl file:border-0 file:bg-white/[0.08] file:px-4 file:text-sm file:text-white hover:file:bg-white/[0.12]" />
          </label>
          <label className="block">
            <span className="sr-only">Idioma</span>
            <select name="lang" defaultValue={lang} className="h-10 w-full rounded-xl border border-white/10 bg-ink-900 px-3 text-sm text-white">
              {Object.entries(CAPTION_LANGS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={pending} className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.08] px-4 text-sm text-white hover:bg-white/[0.12] disabled:opacity-60">
            {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />} {loaded ? "Reemplazar subtítulos" : "Subir subtítulos"}
          </button>
          <p className="text-xs text-mist-500">WebVTT o SRT (se convierte solo) · máx. 500 KB</p>
        </div>
      </form>
      {loaded && (
        <form action={action}>
          <input type="hidden" name="lesson_id" value={lessonId} />
          <input type="hidden" name="intent" value="delete" />
          <button type="submit" disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"><Trash2 className="size-3.5" aria-hidden /> Quitar subtítulos</button>
        </form>
      )}
      {state?.error && <p role="alert" className="text-sm text-red-300">{state.error}</p>}
      {state?.success && <p role="status" className="text-sm text-emerald-300">{state.success}</p>}
    </div>
  );
}
