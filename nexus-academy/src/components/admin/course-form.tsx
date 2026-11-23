"use client";
import { useActionState, useState } from "react";
import { saveCourseAction } from "@/lib/actions/admin";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { CourseCover } from "@/components/course/course-cover";
import { UploadField } from "./upload-field";
import { MarkdownEditor } from "./markdown-editor";

type Option = { id: string; name: string };
type Course = {
  id: string; title: string; slug: string; subtitle: string | null; description: string; category_id: string | null; instructor_id: string | null;
  level: string; price_cents: number; compare_at_price_cents: number | null; status: string; is_featured: boolean;
  what_you_will_learn: string[]; requirements: string[]; target_audience: string[]; cover_url: string | null;
};

export function CourseForm({ course, categories, instructors }: { course?: Course; categories: Option[]; instructors: Option[] }) {
  const [state, action] = useActionState(saveCourseAction, null);
  const [cover, setCover] = useState(course?.cover_url ?? "");
  return (
    <form action={action} className="space-y-6">
      {course && <input type="hidden" name="id" value={course.id} />}
      <input type="hidden" name="cover_url" value={cover} />
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Título" htmlFor="title"><Input id="title" name="title" required defaultValue={course?.title} maxLength={140} /></Field>
        <Field label="Slug (URL)" htmlFor="slug" hint="Se genera del título si lo dejas vacío."><Input id="slug" name="slug" defaultValue={course?.slug} maxLength={80} /></Field>
      </div>
      <Field label="Subtítulo" htmlFor="subtitle"><Input id="subtitle" name="subtitle" defaultValue={course?.subtitle ?? ""} maxLength={240} /></Field>
      <MarkdownEditor id="description" name="description" rows={8} defaultValue={course?.description ?? ""} label="Descripción completa" />
      <div className="grid gap-5 md:grid-cols-3">
        <Field label="Categoría" htmlFor="category_id">
          <Select id="category_id" name="category_id" defaultValue={course?.category_id ?? ""}><option value="">Sin categoría</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        </Field>
        <Field label="Instructor" htmlFor="instructor_id">
          <Select id="instructor_id" name="instructor_id" defaultValue={course?.instructor_id ?? ""}><option value="">Sin instructor</option>{instructors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        </Field>
        <Field label="Nivel" htmlFor="level">
          <Select id="level" name="level" defaultValue={course?.level ?? "beginner"}>
            <option value="beginner">Principiante</option><option value="intermediate">Intermedio</option><option value="advanced">Avanzado</option><option value="all">Todos los niveles</option>
          </Select>
        </Field>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        <Field label="Precio (MXN)" htmlFor="price" hint="0 = curso gratuito"><Input id="price" name="price" type="number" min={0} step="0.01" required defaultValue={course ? course.price_cents / 100 : 0} /></Field>
        <Field label="Precio de referencia (MXN)" htmlFor="compare_at" hint="Opcional, para mostrar % de descuento"><Input id="compare_at" name="compare_at" type="number" min={0} step="0.01" defaultValue={course?.compare_at_price_cents ? course.compare_at_price_cents / 100 : ""} /></Field>
        <Field label="Estado" htmlFor="status">
          <Select id="status" name="status" defaultValue={course?.status ?? "draft"}><option value="draft">Borrador</option><option value="published">Publicado</option><option value="archived">Archivado</option></Select>
        </Field>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        <Field label="Lo que aprenderás (una por línea)" htmlFor="learn"><Textarea id="learn" name="learn" rows={5} defaultValue={course?.what_you_will_learn.join("\n")} /></Field>
        <Field label="Requisitos (uno por línea)" htmlFor="requirements"><Textarea id="requirements" name="requirements" rows={5} defaultValue={course?.requirements.join("\n")} /></Field>
        <Field label="¿Para quién es? (uno por línea)" htmlFor="audience"><Textarea id="audience" name="audience" rows={5} defaultValue={course?.target_audience.join("\n")} /></Field>
      </div>
      <div className="grid items-start gap-5 md:grid-cols-[280px_1fr]">
        <CourseCover title={course?.title ?? "Nuevo curso"} slug={course?.slug ?? "nuevo"} coverUrl={cover || null} className="aspect-video rounded-xl" sizes="280px" />
        <div className="space-y-3">
          <p className="text-sm font-medium text-mist-200">Portada</p>
          <p className="text-xs text-mist-400">Sin imagen se usa una portada generativa con el color de la categoría. Recomendado 1600×900 px.</p>
          <UploadField bucket="course-covers" pathPrefix={course?.id ?? "nuevos"} accept="image/png,image/jpeg,image/webp" maxMb={5} label="Subir portada" onUploaded={({ publicUrl }) => setCover(publicUrl ?? "")} />
          {cover && <button type="button" onClick={() => setCover("")} className="text-xs text-mist-400 underline hover:text-white">Quitar portada</button>}
        </div>
      </div>
      <label className="flex items-center gap-3 text-sm text-mist-200"><input type="checkbox" name="is_featured" defaultChecked={course?.is_featured} className="size-4 accent-electric-500" /> Mostrar como curso destacado en la portada</label>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Guardando…">{course ? "Guardar curso" : "Crear curso"}</SubmitButton>
    </form>
  );
}
