"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { saveAnnouncementAction } from "@/lib/actions/announcements";
import { MarkdownEditor } from "@/components/admin/markdown-editor";
import { Field, FormMessage, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

/**
 * Publicar o editar un aviso del curso. Tras publicar uno nuevo el formulario
 * se vacía (se vuelve a montar el editor con otra clave).
 */
export function AnnouncementForm({ courseId, recipients, editing }: {
  courseId: string;
  recipients: number;
  editing?: { id: string; title: string; body: string; emailed: boolean; cancelHref: string };
}) {
  const [state, formAction] = useActionState(saveAnnouncementAction, null);
  const [round, setRound] = useState(0);
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state?.success && !editing) setRound((r) => r + 1);
  }
  const values = state?.error ? state.values : undefined;
  const canEmail = !editing?.emailed;

  return (
    <form action={formAction} className="space-y-4" key={round}>
      <input type="hidden" name="course_id" value={courseId} />
      {editing && <input type="hidden" name="id" value={editing.id} />}
      <Field label="Título" htmlFor="announcement-title">
        <Input id="announcement-title" name="title" required minLength={3} maxLength={140} defaultValue={values?.title ?? editing?.title ?? ""} placeholder="Ej.: Nueva lección sobre ramas" />
      </Field>
      <MarkdownEditor id="announcement-body" name="body" label="Aviso" rows={8} defaultValue={values?.body ?? editing?.body ?? ""} />
      {canEmail ? (
        <label className="flex items-start gap-3 rounded-xl border border-white/[0.08] p-3 text-sm text-mist-200">
          <input type="checkbox" name="send_email" value="1" className="mt-0.5 size-4 accent-electric-500" />
          <span>
            Enviar también por correo
            <span className="block text-xs text-mist-400">
              {recipients === 1 ? "1 alumno" : `${recipients} alumnos`} con acceso al curso y con «Recordatorios y avisos» activados. Se envía una sola vez por aviso.
            </span>
          </span>
        </label>
      ) : (
        <p className="text-xs text-mist-400">Este aviso ya se envió por correo; los cambios solo se verán en el aula.</p>
      )}
      <FormMessage state={state} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel={editing ? "Guardando…" : "Publicando…"}>{editing ? "Guardar cambios" : "Publicar aviso"}</SubmitButton>
        {editing && <Link href={editing.cancelHref} className="text-sm text-mist-300 hover:text-white">Cancelar</Link>}
      </div>
    </form>
  );
}
