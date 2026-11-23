import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import { saveInstructorAction } from "@/lib/actions/admin";
import { Avatar } from "@/components/ui/avatar";
import { Field, Input, Textarea } from "@/components/ui/field";
import type { Database } from "@/lib/database.types";

export const metadata: Metadata = { title: "Instructores" };
type Instructor = Database["public"]["Tables"]["instructors"]["Row"];

function Fields({ i }: { i?: Instructor }) {
  const k = i?.id ?? "new";
  return (
    <>
      {i && <input type="hidden" name="id" value={i.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre" htmlFor={`n-${k}`}><Input id={`n-${k}`} name="name" defaultValue={i?.name} required /></Field>
        <Field label="Slug" htmlFor={`s-${k}`}><Input id={`s-${k}`} name="slug" defaultValue={i?.slug} /></Field>
      </div>
      <Field label="Titular" htmlFor={`h-${k}`}><Input id={`h-${k}`} name="headline" defaultValue={i?.headline ?? ""} /></Field>
      <Field label="Biografía" htmlFor={`b-${k}`}><Textarea id={`b-${k}`} name="bio" defaultValue={i?.bio ?? ""} /></Field>
      <Field label="URL de foto" htmlFor={`a-${k}`}><Input id={`a-${k}`} name="avatar_url" type="url" defaultValue={i?.avatar_url ?? ""} placeholder="https://…" /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Sitio web" htmlFor={`w-${k}`}><Input id={`w-${k}`} name="website_url" type="url" defaultValue={i?.website_url ?? ""} /></Field>
        <Field label="LinkedIn" htmlFor={`l-${k}`}><Input id={`l-${k}`} name="linkedin_url" type="url" defaultValue={i?.linkedin_url ?? ""} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-mist-200"><input type="checkbox" name="is_active" defaultChecked={i?.is_active ?? true} className="size-4 accent-electric-500" /> Visible en el sitio</label>
    </>
  );
}

export default async function AdminInstructors() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("instructors").select("*, courses(id)").order("name");
  return (
    <>
      <AdminHeader title="Instructores" />
      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <div className="space-y-3">
          {(data ?? []).map((i) => (
            <details key={i.id} className="glass rounded-2xl">
              <summary className="flex cursor-pointer items-center gap-3 p-4">
                <Avatar name={i.name} url={i.avatar_url} size={36} />
                <span className="flex-1"><span className="block font-medium text-white">{i.name}</span><span className="text-xs text-mist-400">{i.headline}</span></span>
                <span className="text-xs text-mist-400">{i.courses?.length ?? 0} cursos{i.is_active ? "" : " · oculto"}</span>
              </summary>
              <div className="border-t border-white/[0.06] p-4"><ActionForm action={saveInstructorAction} submitLabel="Guardar"><Fields i={i} /></ActionForm></div>
            </details>
          ))}
        </div>
        <Panel title="Nuevo instructor"><ActionForm action={saveInstructorAction} submitLabel="Crear instructor"><Fields /></ActionForm></Panel>
      </div>
    </>
  );
}
