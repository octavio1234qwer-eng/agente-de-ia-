"use client";
import { useActionState, useState } from "react";
import { saveLessonAction } from "@/lib/actions/admin";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { UploadField } from "./upload-field";

type Lesson = { id: string; title: string; summary: string | null; type: string; duration_seconds: number; is_preview: boolean; pass_percent: number };
type Content = { body: string; video_provider: string | null; video_ref: string | null } | null;

export function LessonEditor({ courseId, lesson, content }: { courseId: string; lesson: Lesson; content: Content }) {
  const [state, action] = useActionState(saveLessonAction, null);
  const [type, setType] = useState(lesson.type);
  const [provider, setProvider] = useState(content?.video_provider ?? "");
  const [videoRef, setVideoRef] = useState(content?.video_ref ?? "");
  const [minutes, setMinutes] = useState(Math.round((lesson.duration_seconds / 60) * 10) / 10);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="id" value={lesson.id} />
      <div className="grid gap-5 md:grid-cols-[1fr_180px_140px]">
        <Field label="Título" htmlFor="title"><Input id="title" name="title" defaultValue={lesson.title} required maxLength={160} /></Field>
        <Field label="Tipo" htmlFor="type">
          <Select id="type" name="type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="video">Video</option><option value="article">Lectura</option><option value="exercise">Ejercicio</option><option value="quiz">Evaluación</option>
          </Select>
        </Field>
        <Field label="Duración (min)" htmlFor="minutes"><Input id="minutes" name="minutes" type="number" min={0} step="0.1" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} /></Field>
      </div>
      <Field label="Resumen corto" htmlFor="summary"><Input id="summary" name="summary" defaultValue={lesson.summary ?? ""} maxLength={500} /></Field>

      {type === "video" && (
        <div className="space-y-4 rounded-xl border border-white/[0.07] p-4">
          <p className="text-sm font-medium text-white">Video</p>
          <div className="grid gap-4 md:grid-cols-[200px_1fr]">
            <Field label="Origen" htmlFor="video_provider">
              <Select id="video_provider" name="video_provider" value={provider} onChange={(e) => setProvider(e.target.value)}>
                <option value="">Sin video</option><option value="storage">Archivo subido (privado)</option><option value="youtube">YouTube (no listado)</option><option value="vimeo">Vimeo</option><option value="url">URL directa (https)</option>
              </Select>
            </Field>
            <Field label={provider === "storage" ? "Ruta del archivo" : "Enlace o ID"} htmlFor="video_ref">
              <Input id="video_ref" name="video_ref" value={videoRef} onChange={(e) => setVideoRef(e.target.value)} readOnly={provider === "storage"} placeholder={provider === "youtube" ? "https://youtu.be/…" : provider === "vimeo" ? "https://vimeo.com/…" : ""} />
            </Field>
          </div>
          {provider === "storage" && (
            <UploadField
              bucket="course-videos"
              pathPrefix={`${courseId}/${lesson.id}`}
              accept="video/mp4,video/webm,video/quicktime"
              maxMb={2048}
              label="Subir video"
              onUploaded={({ path, file }) => {
                setVideoRef(path);
                const v = document.createElement("video");
                v.preload = "metadata";
                v.onloadedmetadata = () => {
                  if (v.duration && Number.isFinite(v.duration)) setMinutes(Math.round((v.duration / 60) * 10) / 10);
                  URL.revokeObjectURL(v.src);
                };
                v.src = URL.createObjectURL(file);
              }}
            />
          )}
          <p className="text-xs text-mist-400">Los archivos subidos son privados: solo los alumnos con acceso reciben un enlace firmado temporal. Después de subir, guarda la lección. El tamaño máximo real depende del límite de archivo de tu plan de Supabase.</p>
        </div>
      )}

      {type === "quiz" ? (
        <Field label="Porcentaje para aprobar" htmlFor="pass_percent"><Input id="pass_percent" name="pass_percent" type="number" min={0} max={100} defaultValue={lesson.pass_percent} /></Field>
      ) : (
        <Field label={type === "video" ? "Notas de la lección (Markdown, opcional)" : "Contenido (Markdown)"} htmlFor="body">
          <Textarea id="body" name="body" rows={14} defaultValue={content?.body ?? ""} className="font-mono text-sm" />
        </Field>
      )}
      <label className="flex items-center gap-3 text-sm text-mist-200"><input type="checkbox" name="is_preview" defaultChecked={lesson.is_preview} className="size-4 accent-electric-500" /> Vista previa gratuita (visible sin comprar)</label>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Guardando…">Guardar lección</SubmitButton>
    </form>
  );
}
