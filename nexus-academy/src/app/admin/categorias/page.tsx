import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { deleteCategoryAction, saveCategoryAction } from "@/lib/actions/admin";
import { CategoryIcon, categoryIconOptions } from "@/components/ui/icon";
import { Field, Input, Select } from "@/components/ui/field";

export const metadata: Metadata = { title: "Categorías" };

function CategoryFields({ c }: { c?: { id: string; name: string; slug: string; description: string | null; icon: string; color: string } }) {
  return (
    <>
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre" htmlFor={`name-${c?.id ?? "new"}`}><Input id={`name-${c?.id ?? "new"}`} name="name" defaultValue={c?.name} required /></Field>
        <Field label="Slug" htmlFor={`slug-${c?.id ?? "new"}`}><Input id={`slug-${c?.id ?? "new"}`} name="slug" defaultValue={c?.slug} /></Field>
      </div>
      <Field label="Descripción" htmlFor={`desc-${c?.id ?? "new"}`}><Input id={`desc-${c?.id ?? "new"}`} name="description" defaultValue={c?.description ?? ""} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ícono" htmlFor={`icon-${c?.id ?? "new"}`}><Select id={`icon-${c?.id ?? "new"}`} name="icon" defaultValue={c?.icon ?? "sparkles"}>{categoryIconOptions.map((i) => <option key={i} value={i}>{i}</option>)}</Select></Field>
        <Field label="Color" htmlFor={`color-${c?.id ?? "new"}`}><Input id={`color-${c?.id ?? "new"}`} name="color" type="color" defaultValue={c?.color ?? "#3b74ff"} className="h-12 p-1" /></Field>
      </div>
    </>
  );
}

export default async function AdminCategories() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*, courses(id)").order("sort_order");
  return (
    <>
      <AdminHeader title="Categorías" description="Organizan el catálogo y los filtros de búsqueda." />
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          {(data ?? []).map((c) => (
            <details key={c.id} className="glass rounded-2xl">
              <summary className="flex cursor-pointer items-center gap-3 p-4">
                <span className="grid size-9 place-items-center rounded-lg bg-white/[0.05]" style={{ color: c.color }}><CategoryIcon name={c.icon} className="size-4" /></span>
                <span className="flex-1 font-medium text-white">{c.name}</span>
                <span className="text-xs text-mist-400">{c.courses?.length ?? 0} cursos</span>
              </summary>
              <div className="border-t border-white/[0.06] p-4">
                <ActionForm action={saveCategoryAction} submitLabel="Guardar"><CategoryFields c={c} /></ActionForm>
                <form action={deleteCategoryAction} className="mt-3"><input type="hidden" name="id" value={c.id} /><ConfirmButton message={`¿Eliminar «${c.name}»? Sus cursos quedarán sin categoría.`}>Eliminar categoría</ConfirmButton></form>
              </div>
            </details>
          ))}
        </div>
        <Panel title="Nueva categoría"><ActionForm action={saveCategoryAction} submitLabel="Crear categoría"><CategoryFields /></ActionForm></Panel>
      </div>
    </>
  );
}
