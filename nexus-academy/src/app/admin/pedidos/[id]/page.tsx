import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminHeader, Panel, Table, Td } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import { refundOrderAction } from "@/lib/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Field, Input } from "@/components/ui/field";
import { formatDate, formatMoney, orderStatusLabel, providerLabel } from "@/lib/utils";

export const metadata: Metadata = { title: "Pedido" };

export default async function AdminOrder({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ reembolso?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { reembolso } = await searchParams;
  const supabase = await createClient();
  const [{ data: o }, { data: events }, { data: refunds }] = await Promise.all([
    supabase.from("orders").select("*, order_items(*), profiles(id, full_name, email)").eq("id", id).maybeSingle(),
    supabase.from("payment_events").select("id, event_type, processed_at, error, created_at").eq("order_id", id).order("created_at"),
    supabase.from("refunds").select("*").eq("order_id", id).order("created_at"),
  ]);
  if (!o) notFound();
  const refundable = o.total_cents - o.refunded_cents;
  const billing = o.billing_details as { rfc?: string; razon_social?: string } | null;

  return (
    <>
      <Link href="/admin/pedidos" className="mb-3 inline-flex items-center gap-1 text-sm text-mist-400 hover:text-white"><ArrowLeft className="size-4" /> Pedidos</Link>
      <AdminHeader title={`Pedido ${o.order_number}`} description={`${formatDate(o.created_at, { dateStyle: "long", timeStyle: "short" })} · ${providerLabel[o.provider]}`} actions={<Badge tone={o.status === "paid" ? "green" : o.status === "pending" ? "amber" : "neutral"}>{orderStatusLabel[o.status]}</Badge>} />
      {reembolso && (
        <p role="status" className="mb-4 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {reembolso === "total" ? "Reembolso total registrado. El acceso a los cursos comprados en este pedido fue retirado." : "Reembolso parcial registrado. El alumno conserva el acceso."}
        </p>
      )}
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Panel title="Detalle">
            <Table head={["Producto", "Precio", "Descuento", "Total"]}>
              {o.order_items.map((i) => (
                <tr key={i.id}><Td>{i.title}</Td><Td>{formatMoney(i.unit_price_cents, o.currency)}</Td><Td>{i.discount_cents ? `−${formatMoney(i.discount_cents, o.currency)}` : "—"}</Td><Td>{formatMoney(i.total_cents, o.currency)}</Td></tr>
              ))}
            </Table>
            <dl className="mt-4 grid gap-1 text-sm sm:grid-cols-2">
              <dt className="text-mist-400">Cliente</dt><dd><Link className="text-electric-300" href={`/admin/alumnos/${o.profiles?.id}`}>{o.profiles?.full_name || o.customer_email}</Link></dd>
              <dt className="text-mist-400">Correo</dt><dd className="text-mist-100">{o.customer_email}</dd>
              <dt className="text-mist-400">Cupón</dt><dd className="text-mist-100">{o.coupon_code ?? "—"}</dd>
              <dt className="text-mist-400">Total</dt><dd className="font-semibold text-white">{formatMoney(o.total_cents, o.currency)}</dd>
              <dt className="text-mist-400">Reembolsado</dt><dd className="text-mist-100">{formatMoney(o.refunded_cents, o.currency)}</dd>
              <dt className="text-mist-400">ID de sesión</dt><dd className="break-all font-mono text-xs text-mist-300">{o.provider_session_id ?? "—"}</dd>
              <dt className="text-mist-400">ID de pago</dt><dd className="break-all font-mono text-xs text-mist-300">{o.provider_payment_id ?? "—"}</dd>
              <dt className="text-mist-400">Pagado</dt><dd className="text-mist-100">{o.paid_at ? formatDate(o.paid_at, { dateStyle: "medium", timeStyle: "short" }) : "—"}</dd>
              {billing?.rfc && (<><dt className="text-mist-400">Facturación</dt><dd className="text-mist-100">RFC {billing.rfc} · {billing.razon_social}</dd></>)}
              {o.failure_reason && (<><dt className="text-mist-400">Motivo</dt><dd className="text-red-300">{o.failure_reason}</dd></>)}
            </dl>
          </Panel>
          <Panel title="Eventos del proveedor" subtitle="Webhooks verificados recibidos para este pedido">
            <ul className="space-y-2 text-sm">
              {(events ?? []).map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2">
                  <span className="font-mono text-xs text-mist-200">{e.event_type}</span>
                  <span className="text-xs text-mist-500">{formatDate(e.created_at, { dateStyle: "short", timeStyle: "medium" })}</span>
                  {e.error ? <Badge tone="red">{e.error.slice(0, 60)}</Badge> : e.processed_at ? <Badge tone="green">procesado</Badge> : <Badge tone="amber">pendiente</Badge>}
                </li>
              ))}
              {(events ?? []).length === 0 && <li className="text-xs text-mist-500">Sin eventos.</li>}
            </ul>
          </Panel>
        </div>
        <div className="space-y-4">
          <Panel title="Reembolsar" subtitle={`Disponible: ${formatMoney(refundable, o.currency)}`}>
            {refundable > 0 && ["paid", "partially_refunded"].includes(o.status) ? (
              <ActionForm action={refundOrderAction} submitLabel="Procesar reembolso" pendingLabel="Procesando…">
                <input type="hidden" name="order_id" value={o.id} />
                <Field label="Monto (MXN)" htmlFor="amount"><Input id="amount" name="amount" type="number" step="0.01" min={0.01} max={refundable / 100} defaultValue={refundable / 100} /></Field>
                <Field label="Motivo" htmlFor="reason"><Input id="reason" name="reason" maxLength={300} /></Field>
                <label className="flex items-start gap-2 text-xs text-mist-300"><input type="checkbox" name="manual" className="mt-0.5 size-4 accent-electric-500" /> Reembolso manual (ya lo hice en el panel del proveedor; solo registrarlo)</label>
                <p className="text-xs text-mist-400">El reembolso total retira el acceso a los cursos de este pedido.</p>
              </ActionForm>
            ) : (
              <p className="text-sm text-mist-400">Este pedido no admite reembolsos.</p>
            )}
          </Panel>
          {(refunds ?? []).length > 0 && (
            <Panel title="Historial de reembolsos">
              <ul className="space-y-2 text-sm">
                {(refunds ?? []).map((r) => <li key={r.id} className="rounded-lg bg-white/[0.03] px-3 py-2"><span className="text-white">{formatMoney(r.amount_cents, o.currency)}</span> <span className="text-xs text-mist-400">· {formatDate(r.created_at, { dateStyle: "short" })} · {r.reason}</span></li>)}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
