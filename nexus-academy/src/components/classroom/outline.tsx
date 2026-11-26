"use client";
import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Circle, Dumbbell, FileText, ListChecks, Lock, Megaphone, PlayCircle, PanelLeft, X } from "lucide-react";
import type { OutlineModule } from "@/lib/data/classroom";
import { cn, formatDate, formatSeconds } from "@/lib/utils";
import { LessonSearchForm } from "@/components/search/lesson-search-form";

const icons = { video: PlayCircle, article: FileText, quiz: ListChecks, exercise: Dumbbell } as const;

export function Outline({ slug, modules, currentId, searchable = false, unseenAnnouncements }: { slug: string; modules: OutlineModule[]; currentId: string; searchable?: boolean; unseenAnnouncements?: number }) {
  const [open, setOpen] = useState(false);
  const avisosActive = currentId === "avisos";
  const list = (
    <nav aria-label="Contenido del curso" className="space-y-5 p-4">
      {searchable && <LessonSearchForm course={slug} compact />}
      {unseenAnnouncements !== undefined && (
        <Link
          href={`/aprender/${slug}/avisos`}
          onClick={() => setOpen(false)}
          aria-current={avisosActive ? "page" : undefined}
          className={cn("flex min-h-11 items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition", avisosActive ? "bg-electric-500/15 text-white ring-1 ring-electric-400/30" : "text-mist-200 hover:bg-white/[0.04]")}
        >
          <Megaphone className="size-4 shrink-0 text-electric-300" aria-hidden />
          <span className="flex-1">Avisos del curso</span>
          {unseenAnnouncements > 0 && (
            <span className="rounded-full bg-electric-500 px-2 py-0.5 text-[11px] font-semibold text-white">
              {unseenAnnouncements}<span className="sr-only"> {unseenAnnouncements === 1 ? "nuevo" : "nuevos"}</span>
            </span>
          )}
        </Link>
      )}
      {modules.map((m, mi) => (
        <div key={m.id}>
          <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-mist-400">Módulo {mi + 1}</p>
          <p className="px-2 pb-2 text-sm font-medium text-white">{m.title}</p>
          {m.releaseAt && (
            <p className="mx-2 mb-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
              <Lock className="size-3" aria-hidden /> Se libera el {formatDate(m.releaseAt, { dateStyle: "medium" })}
            </p>
          )}
          <ul className="space-y-1">
            {m.lessons.map((l) => {
              const Icon = icons[l.type];
              const active = l.id === currentId;
              const content = (
                <>
                  {l.completed ? <CheckCircle2 className="size-4 shrink-0 text-emerald-400" aria-label="Completada" /> : l.canView ? <Circle className="size-4 shrink-0 text-mist-500" aria-hidden /> : <Lock className="size-4 shrink-0 text-mist-500" aria-label="Bloqueada" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{l.title}</span>
                    <span className="flex items-center gap-1 text-[11px] text-mist-400"><Icon className="size-3" aria-hidden />{formatSeconds(l.duration_seconds)}</span>
                  </span>
                </>
              );
              return (
                <li key={l.id}>
                  {l.canView ? (
                    <Link
                      href={`/aprender/${slug}/${l.id}`}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn("flex min-h-12 items-center gap-3 rounded-xl px-2.5 py-2 transition", active ? "bg-electric-500/15 text-white ring-1 ring-electric-400/30" : "text-mist-200 hover:bg-white/[0.04]")}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="flex min-h-12 items-center gap-3 rounded-xl px-2.5 py-2 text-mist-500">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="fixed bottom-4 left-4 z-30 flex h-12 items-center gap-2 rounded-2xl border border-white/10 bg-ink-850/95 px-4 text-sm text-white shadow-xl backdrop-blur lg:hidden">
        <PanelLeft className="size-4" aria-hidden /> Contenido
      </button>
      <aside className="hidden w-80 shrink-0 overflow-y-auto border-r border-white/[0.06] bg-ink-950/60 lg:block lg:h-[calc(100dvh-3.5rem)] lg:sticky lg:top-14">{list}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Contenido del curso">
          <button type="button" className="absolute inset-0 bg-black/60" aria-label="Cerrar" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[85%] max-w-sm overflow-y-auto bg-ink-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.06] p-4">
              <p className="font-medium text-white">Contenido del curso</p>
              <button type="button" onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-xl hover:bg-white/[0.06]" aria-label="Cerrar"><X className="size-5" /></button>
            </div>
            {list}
          </div>
        </div>
      )}
    </>
  );
}
