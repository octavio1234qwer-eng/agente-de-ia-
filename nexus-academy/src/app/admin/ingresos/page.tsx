import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminHeader, Table, Td } from "@/components/admin/ui";
import { dateRange } from "@/lib/csv";
import { cn, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Ingresos por producto" };

const TZ = "America/Mexico_City";
const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);

/** Atajos de periodo en fechas locales de la academia (inclusivas). */
function presets(now = new Date()) {
  const [y, m] = ymd(now).split("-").map(Number);
  const first = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, "0")}-01`;
  const lastOf = (yy: number, mm: number) => ymd(new Date(Date.UTC(yy, mm, 0, 12)));
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  return [
    { label: "Este mes", desde: first(y, m), hasta: ymd(now) },
    { label: "Mes pasado", desde: first(prevY, prevM), hasta: lastOf(prevY, prevM) },
    { label: "Últimos 30 días", desde: ymd(new Date(now.getTime() - 29 * 86400000)), hasta: ymd(now) },
    { label: "Este año", desde: `${y}-01-01`, hasta: ymd(now) },
    { label: "Todo", desde: "", hasta: "" },
  ];
}

export default async function RevenuePage({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const quick = presets();
  const explicit = sp.desde !== undefined || sp.hasta !== undefined;
  const desde = explicit ? (sp.desde ?? "") : quick[0].desde;
  const hasta = explicit ? (sp.hasta ?? "") : quick[0].hasta;
  const range = dateRange(desde || null, hasta || null);

  const supabase = await createClient();
  const { data, error } = range ? await supabase.rpc("admin_revenue_by_product", { p_from: range.from ?? undefined, p_to: range.to ?? undefined }) : { data: null, error: null };
  const rows = data ?? [];
  const sum = (k: "orders" | "units" | "gross_cents" | "discount_cents" | "refunded_cents" | "net_cents") => rows.reduce((s, r) => s + Number(r[k]), 0);
  const qs = new URLSearchParams({ desde, hasta }).toString();

  return (
    <>
      <AdminHeader
        title="Ingresos por producto"
        description="Pedidos cobrados por fecha de pago (hora de Ciudad de México). Los reembolsos se reparten entre los artículos de cada pedido."
        actions={
          range ? (
            <a href={`/api/admin/export/ingresos?${qs}`} className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm text-mist-200 hover:bg-white/[0.06]">
              <Download className="size-4" aria-hidden /> Exportar CSV
            </a>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap gap-2" aria-label="Periodos rápidos">
        {quick.map((p) => {
          const active = p.desde === desde && p.hasta === hasta;
          return (
            <Link key={p.label} href={`/admin/ingresos?${new URLSearchParams({ desde: p.desde, hasta: p.hasta })}`} aria-current={active ? "true" : undefined} className={cn("rounded-xl px-3 py-1.5 text-sm", active ? "bg-electric-500/15 text-white ring-1 ring-electric-400/30" : "bg-white/[0.04] text-mist-300 hover:text-white")}>
              {p.label}
            </Link>
          );
        })}
      </div>
      <form className="mb-6 flex flex-wrap items-end gap-3" aria-label="Periodo personalizado">
        <label className="text-xs text-mist-400" htmlFor="rev-desde">Desde<input id="rev-desde" type="date" name="desde" defaultValue={desde} className="mt-1 block h-10 rounded-xl border border-white/10 bg-ink-850 px-3 text-sm text-white [color-scheme:dark]" /></label>
        <label className="text-xs text-mist-400" htmlFor="rev-hasta">Hasta<input id="rev-hasta" type="date" name="hasta" defaultValue={hasta} className="mt-1 block h-10 rounded-xl border border-white/10 bg-ink-850 px-3 text-sm text-white [color-scheme:dark]" /></label>
        <button className="h-10 rounded-xl bg-white/[0.06] px-4 text-sm text-white hover:bg-white/[0.1]">Aplicar</button>
      </form>

      {!range ? (
        <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">El periodo no es válido: «desde» no puede ser posterior a «hasta».</p>
      ) : error ? (
        <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">No se pudo calcular el reporte.</p>
      ) : (
        <>
          <dl className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" data-testid="revenue-summary">
            {[
              ["Neto", formatMoney(sum("net_cents"))],
              ["Bruto", formatMoney(sum("gross_cents"))],
              ["Descuentos", formatMoney(sum("discount_cents"))],
              ["Reembolsos", formatMoney(sum("refunded_cents"))],
              ["Unidades", String(sum("units"))],
            ].map(([label, value]) => (
              <div key={label} className="glass rounded-2xl p-4">
                <dt className="text-xs text-mist-400">{label}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums text-white">{value}</dd>
              </div>
            ))}
          </dl>
          <Table label="Ingresos por producto" head={["Producto", "Tipo", "Pedidos", "Unidades", "Bruto", "Descuentos", "Reembolsos", "Neto"]} empty={rows.length ? undefined : "Sin ventas cobradas en este periodo."}>
            {rows.map((r) => (
              <tr key={`${r.item_type}-${r.product_id ?? r.title}-${r.currency}`} data-testid="revenue-row">
                <Td>{r.item_type === "course" && r.product_id ? <Link href={`/admin/cursos/${r.product_id}`} className="text-white hover:underline">{r.title}</Link> : <span className="text-white">{r.title}</span>}</Td>
                <Td>{r.item_type === "course" ? "Curso" : "Paquete"}</Td>
                <Td className="tabular-nums">{r.orders}</Td>
                <Td className="tabular-nums">{r.units}</Td>
                <Td className="tabular-nums">{formatMoney(Number(r.gross_cents), r.currency)}</Td>
                <Td className="tabular-nums">{formatMoney(Number(r.discount_cents), r.currency)}</Td>
                <Td className="tabular-nums">{formatMoney(Number(r.refunded_cents), r.currency)}</Td>
                <Td className="tabular-nums font-semibold text-white">{formatMoney(Number(r.net_cents), r.currency)}</Td>
              </tr>
            ))}
            {rows.length > 1 && (
              <tr className="bg-white/[0.03] font-semibold text-white" data-testid="revenue-total">
                <Td>Total</Td><Td>{""}</Td>
                <Td className="tabular-nums">{sum("orders")}</Td>
                <Td className="tabular-nums">{sum("units")}</Td>
                <Td className="tabular-nums">{formatMoney(sum("gross_cents"))}</Td>
                <Td className="tabular-nums">{formatMoney(sum("discount_cents"))}</Td>
                <Td className="tabular-nums">{formatMoney(sum("refunded_cents"))}</Td>
                <Td className="tabular-nums">{formatMoney(sum("net_cents"))}</Td>
              </tr>
            )}
          </Table>
          <p className="mt-3 text-xs text-mist-500">«Pedidos» del total puede contar dos veces un pedido con varios productos. Montos en MXN.</p>
        </>
      )}
    </>
  );
}
