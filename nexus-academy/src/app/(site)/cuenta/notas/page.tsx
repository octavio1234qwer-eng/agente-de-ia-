import type { Metadata } from "next";
import Link from "next/link";
import { Download, NotebookPen } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getMyNotes, type NoteRow } from "@/lib/data/notes";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { splitTimestamps } from "@/lib/notes";

export const metadata: Metadata = { title: "Mis notas", robots: { index: false } };

export default async function MyNotesPage() {
  const user = await requireUser("/cuenta/notas");
  const notes = await getMyNotes(user.id);

  if (notes.length === 0) {
    return (
      <EmptyState
        icon={<NotebookPen className="size-6" />}
        title="Aún no tienes notas"
        description="En cada lección encontrarás «Mis notas»: escribe lo que quieras recordar y aparecerá aquí, ordenado por curso. Solo tú puedes verlas."
        action={<LinkButton href="/cuenta/cursos">Ir a mis cursos</LinkButton>}
      />
    );
  }

  const groups = new Map<string, { title: string; slug: string | null; items: NoteRow[] }>();
  for (const n of notes) {
    const key = n.course?.id ?? "sin-curso";
    const g = groups.get(key) ?? { title: n.course?.title ?? "Curso no disponible", slug: n.course?.slug ?? null, items: [] };
    g.items.push(n);
    groups.set(key, g);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Mis notas</h2>
          <p className="mt-1 text-sm text-mist-400">{notes.length} {notes.length === 1 ? "nota" : "notas"} · solo tú puedes verlas.</p>
        </div>
        <a href="/api/notes/export" download className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-mist-100 hover:bg-white/[0.06]">
          <Download className="size-4" aria-hidden /> Descargar (.md)
        </a>
      </div>
      {[...groups.values()].map((g) => (
        <section key={g.title} aria-label={g.title} className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-mist-400">{g.title}</h3>
          <ul className="space-y-3">
            {g.items.map((n) => (
              <li key={n.lesson_id} className="glass rounded-2xl p-4" data-testid="note">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    {n.lesson?.module && <p className="text-xs text-mist-400">{n.lesson.module.title}</p>}
                    <p className="font-medium text-white">{n.lesson?.title ?? "Lección no disponible"}</p>
                  </div>
                  {g.slug && n.lesson && (
                    <Link href={`/aprender/${g.slug}/${n.lesson.id}#mis-notas`} className="shrink-0 text-sm text-electric-300 underline-offset-4 hover:underline">Ir a la lección</Link>
                  )}
                </div>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-mist-200">
                  {g.slug && n.lesson?.type === "video"
                    ? splitTimestamps(n.body).map((part, i) =>
                        part.kind === "time" ? (
                          <Link key={i} href={`/aprender/${g.slug}/${n.lesson!.id}?t=${part.seconds}`} className="rounded bg-electric-500/15 px-1 font-mono text-electric-200 hover:bg-electric-500/25" title="Abrir el video en este momento">
                            {part.text}
                          </Link>
                        ) : (
                          <span key={i}>{part.text}</span>
                        ),
                      )
                    : n.body}
                </p>
                <p className="mt-3 text-xs text-mist-500">Actualizada el {formatDate(n.updated_at, { dateStyle: "medium", timeStyle: "short" })}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
