import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminHeader, Panel, Table, Td } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import { saveCouponAction, toggleCouponAction } from "@/lib/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/field";
import { formatDate, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Cupones" };

export default async function AdminCoupons() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: coupons }, { data: courses }] = await Promise.all([
    supabase.from("coupons").select("*").order("created_at", { ascending: false }),
    supabase.from("courses").select("id, title").gt("price_cents", 0).order("title"),
  ]);
  return (
    <>
      <AdminHeader title="Cupones y descuentos" description="Los descuentos se validan y calculan siempre en el servidor." />
      <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
        <Table head={["Código", "Descuento", "Usos", "Vigencia", "Estado", ""]} empty={coupons?.length ? undefined : "Aún no hay cupones."}>
          {(coupons ?? []).map((c) => (
            <tr key={c.id}>
              <Td><p className="font-mono text-white">{c.code}</p><p className="text-xs text-mist-400">{c.description}</p></Td>
              <Td>{c.discount_type === "percent" ? `${c.discount_value}%` : formatMoney(c.discount_value, c.currency)}{c.course_ids?.length ? <span className="block text-xs text-mist-400">{c.course_ids.length} curso(s)</span> : null}</Td>
              <Td>{c.redemptions_count}{c.max_redemptions ? ` / ${c.max_redemptions}` : ""}</Td>
              <Td className="text-xs">{c.expires_at ? `Hasta ${formatDate(c.expires_at, { dateStyle: "medium" })}` : "Sin vencimiento"}</Td>
              <Td><Badge tone={c.is_active ? "green" : "neutral"}>{c.is_active ? "Activo" : "Inactivo"}</Badge></Td>
              <Td><form action={toggleCouponAction}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="active" value={String(!c.is_active)} /><button className="rounded-lg px-2 py-1 text-xs text-mist-200 hover:bg-white/[0.06]">{c.is_active ? "Desactivar" : "Activar"}</button></form></Td>
            </tr>
          ))}
        </Table>
        <Panel title="Nuevo cupón">
          <ActionForm action={saveCouponAction} submitLabel="Crear cupón">
            <Field label="Código" htmlFor="code"><Input id="code" name="code" required className="uppercase" placeholder="BIENVENIDA10" /></Field>
            <Field label="Descripción interna" htmlFor="description"><Input id="description" name="description" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo" htmlFor="discount_type"><Select id="discount_type" name="discount_type"><option value="percent">Porcentaje</option><option value="fixed">Monto fijo (MXN)</option></Select></Field>
              <Field label="Valor" htmlFor="discount_value"><Input id="discount_value" name="discount_value" type="number" step="0.01" min={0.01} required /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Usos máximos" htmlFor="max_redemptions"><Input id="max_redemptions" name="max_redemptions" type="number" min={1} placeholder="Ilimitado" /></Field>
              <Field label="Por usuario" htmlFor="per_user_limit"><Input id="per_user_limit" name="per_user_limit" type="number" min={1} defaultValue={1} /></Field>
            </div>
            <Field label="Compra mínima (MXN)" htmlFor="min_subtotal"><Input id="min_subtotal" name="min_subtotal" type="number" min={0} step="0.01" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Inicia" htmlFor="starts_at"><Input id="starts_at" name="starts_at" type="datetime-local" /></Field>
              <Field label="Vence" htmlFor="expires_at"><Input id="expires_at" name="expires_at" type="datetime-local" /></Field>
            </div>
            <fieldset>
              <legend className="mb-1 text-sm text-mist-200">Limitar a cursos (opcional)</legend>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-white/[0.07] p-2">
                {(courses ?? []).map((c) => <label key={c.id} className="flex items-center gap-2 px-1 py-1 text-xs text-mist-200"><input type="checkbox" name="course_ids" value={c.id} className="accent-electric-500" />{c.title}</label>)}
              </div>
            </fieldset>
            <label className="flex items-center gap-2 text-sm text-mist-200"><input type="checkbox" name="is_active" defaultChecked className="size-4 accent-electric-500" /> Activo</label>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
