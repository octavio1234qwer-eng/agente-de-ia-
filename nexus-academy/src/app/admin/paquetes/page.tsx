import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import { saveBundleAction } from "@/lib/actions/admin";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "Paquetes" };

type Bundle = { id: string; title: string; slug: string; description: string; price_cents: number; compare_at_price_cents: number | null; status: string; bundle_courses: { course_id: string }[] };

function Fields({ b, courses }: { b?: Bundle; courses: { id: string; title: string; price_cents: number }[] }) {
  const k = b?.id ?? "new";
  const selected = new Set(b?.bundle_courses.map((x) => x.course_id));
  return (
    <>
      {b && <input type="hidden" name="id" value={b.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Título" htmlFor={`t-${k}`}><Input id={`t-${k}`} name="title" defaultValue={b?.title} required /></Field>
        <Field label="Slug" htmlFor={`s-${k}`}><Input id={`s-${k}`} name="slug" defaultValue={b?.slug} /></Field>
      </div>
      <Field label="Descripción" htmlFor={`d-${k}`}><Textarea id={`d-${k}`} name="description" defaultValue={b?.description} /></Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Precio (MXN)" htmlFor={`p-${k}`}><Input id={`p-${k}`} name="price" type="number" step="0.01" min={1} defaultValue={b ? b.price_cents / 100 : ""} required /></Field>
        <Field label="Precio de referencia" htmlFor={`c-${k}`}><Input id={`c-${k}`} name="compare_at" type="number" step="0.01" min={0} defaultValue={b?.compare_at_price_cents ? b.compare_at_price_cents / 100 : ""} /></Field>
        <Field label="Estado" htmlFor={`e-${k}`}><Select id={`e-${k}`} name="status" defaultValue={b?.status ?? "draft"}><option value="draft">Borrador</option><option value="published">Publicado</option><option value="archived">Archivado</option></Select></Field>
      </div>
      <fieldset className="min-w-0">
        <legend className="mb-2 text-sm font-medium text-mist-200">Cursos incluidos (mínimo 2)</legend>
        <div className="grid max-h-56 grid-cols-[minmax(0,1fr)] gap-1 overflow-y-auto rounded-xl border border-white/[0.07] p-2 sm:grid-cols-2">
          {courses.map((c) => (
            <label key={c.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-mist-200 hover:bg-white/[0.04]">
              <input type="checkbox" name="course_ids" value={c.id} defaultChecked={selected.has(c.id)} className="size-4 accent-electric-500" />
              <span className="min-w-0 flex-1 truncate">{c.title}</span><span className="shrink-0 text-xs text-mist-500">{formatPrice(c.price_cents)}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}

export default async function AdminBundles() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: bundles }, { data: courses }] = await Promise.all([
    supabase.from("bundles").select("id, title, slug, description, price_cents, compare_at_price_cents, status, bundle_courses(course_id)").order("created_at"),
    supabase.from("courses").select("id, title, price_cents").gt("price_cents", 0).order("title"),
  ]);
  return (
    <>
      <AdminHeader title="Paquetes" description="Vende varios cursos juntos a un precio especial." />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_460px]">
        <div className="space-y-3">
          {(bundles ?? []).map((b) => (
            <details key={b.id} className="glass rounded-2xl">
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 p-4">
                <span className="min-w-0 flex-1 basis-40 font-medium text-white">{b.title}</span>
                <span className="text-xs text-mist-400">{b.bundle_courses.length} cursos · {formatPrice(b.price_cents)} · {b.status}</span>
              </summary>
              <div className="border-t border-white/[0.06] p-4"><ActionForm action={saveBundleAction} submitLabel="Guardar"><Fields b={b} courses={courses ?? []} /></ActionForm></div>
            </details>
          ))}
        </div>
        <Panel title="Nuevo paquete"><ActionForm action={saveBundleAction} submitLabel="Crear paquete"><Fields courses={courses ?? []} /></ActionForm></Panel>
      </div>
    </>
  );
}
