import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminHeader, Table, Td } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatMoney, orderStatusLabel, providerLabel } from "@/lib/utils";

export const metadata: Metadata = { title: "Pedidos" };
const tone = { paid: "green", pending: "amber", failed: "red", cancelled: "neutral", expired: "neutral", refunded: "violet", partially_refunded: "violet" } as const;
const statuses = ["pending", "paid", "failed", "expired", "cancelled", "refunded", "partially_refunded"] as const;

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ estado?: string; q?: string }> }) {
  await requireAdmin();
  const { estado, q } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("orders").select("id, order_number, status, provider, total_cents, currency, customer_email, created_at, failure_reason").order("created_at", { ascending: false }).limit(200);
  const status = statuses.find((s) => s === estado);
  if (status) query = query.eq("status", status);
  const term = (q ?? "").trim().replace(/[%,()]/g, "").slice(0, 80);
  if (term) query = query.or(`order_number.ilike.%${term}%,customer_email.ilike.%${term}%`);
  const { data } = await query;
  return (
    <>
      <AdminHeader title="Pedidos" description="Compras, estado de pago y reembolsos. Los importes se confirman solo por webhooks verificados." />
      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={term} placeholder="Número de pedido o correo" aria-label="Buscar pedidos" className="h-10 w-full max-w-xs rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white placeholder:text-mist-500 focus:outline-none" />
        <select name="estado" defaultValue={status ?? ""} aria-label="Estado" className="h-10 rounded-xl border border-white/10 bg-ink-850 px-3 text-sm text-white">
          <option value="">Todos los estados</option>
          {statuses.map((s) => <option key={s} value={s}>{orderStatusLabel[s]}</option>)}
        </select>
        <button className="h-10 rounded-xl bg-white/[0.06] px-4 text-sm text-white hover:bg-white/[0.1]">Filtrar</button>
      </form>
      <Table head={["Pedido", "Cliente", "Método", "Estado", "Total", "Fecha"]} empty={data?.length ? undefined : "Sin pedidos."}>
        {(data ?? []).map((o) => (
          <tr key={o.id} className="hover:bg-white/[0.02]">
            <Td><Link href={`/admin/pedidos/${o.id}`} className="font-mono text-electric-300 hover:text-white">{o.order_number}</Link>{o.failure_reason?.startsWith("amount_mismatch") && <p className="text-xs text-red-300">Revisar importe</p>}</Td>
            <Td className="text-xs">{o.customer_email}</Td>
            <Td>{providerLabel[o.provider]}</Td>
            <Td><Badge tone={tone[o.status]}>{orderStatusLabel[o.status]}</Badge></Td>
            <Td>{formatMoney(o.total_cents, o.currency)}</Td>
            <Td className="text-xs">{formatDate(o.created_at, { dateStyle: "medium", timeStyle: "short" })}</Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
