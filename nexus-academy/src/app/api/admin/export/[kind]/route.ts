import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { centsToDecimal, csvDate, dateRange, toCsv } from "@/lib/csv";
import { orderStatusLabel, providerLabel } from "@/lib/utils";
import type { Database } from "@/lib/database.types";

type OrderStatus = Database["public"]["Enums"]["order_status"];
const PAGE = 1000;
const MAX_ROWS = 50_000;

/**
 * Exportación CSV para el administrador: /api/admin/export/pedidos y /alumnos.
 * Parámetros: desde, hasta (YYYY-MM-DD, inclusive, hora de CDMX) y, en pedidos, estado.
 * Solo administradores (se verifica aquí y además RLS limita las consultas).
 * Cada descarga queda en la bitácora de auditoría.
 */
export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Inicia sesión.", { status: 401 });
  if (user.role !== "admin") return new Response("Solo administradores.", { status: 403 });
  if (kind !== "pedidos" && kind !== "alumnos" && kind !== "ingresos") return new Response("Exportación no encontrada.", { status: 404 });

  const sp = new URL(req.url).searchParams;
  const range = dateRange(sp.get("desde"), sp.get("hasta"));
  if (!range) return new Response("Rango de fechas inválido: usa AAAA-MM-DD y que «desde» no sea posterior a «hasta».", { status: 400 });
  const estado = sp.get("estado") || null;
  if (estado && !(estado in orderStatusLabel)) return new Response("Estado inválido.", { status: 400 });

  const supabase = await createClient();
  let csv: string;
  let count: number;

  if (kind === "ingresos") {
    const { data, error } = await supabase.rpc("admin_revenue_by_product", { p_from: range.from ?? undefined, p_to: range.to ?? undefined });
    if (error) return new Response("No se pudo calcular el reporte.", { status: 500 });
    const rows = data ?? [];
    csv = toCsv(rows, [
      { header: "Producto", value: (r) => r.title },
      { header: "Tipo", value: (r) => (r.item_type === "course" ? "Curso" : "Paquete") },
      { header: "Moneda", value: (r) => r.currency },
      { header: "Pedidos", value: (r) => r.orders },
      { header: "Unidades", value: (r) => r.units },
      { header: "Bruto", value: (r) => centsToDecimal(Number(r.gross_cents)) },
      { header: "Descuentos", value: (r) => centsToDecimal(Number(r.discount_cents)) },
      { header: "Reembolsos", value: (r) => centsToDecimal(Number(r.refunded_cents)) },
      { header: "Neto", value: (r) => centsToDecimal(Number(r.net_cents)) },
    ]);
    count = rows.length;
  } else if (kind === "pedidos") {
    type Row = { order_number: string; status: string; provider: string; currency: string; subtotal_cents: number; discount_cents: number; total_cents: number; refunded_cents: number; coupon_code: string | null; provider_payment_id: string | null; customer_email: string; customer_name: string | null; billing_details: unknown; paid_at: string | null; created_at: string; order_items: { title: string }[] };
    const rows: Row[] = [];
    for (let from = 0; from < MAX_ROWS; from += PAGE) {
      let q = supabase
        .from("orders")
        .select("order_number, status, provider, currency, subtotal_cents, discount_cents, total_cents, refunded_cents, coupon_code, provider_payment_id, customer_email, customer_name, billing_details, paid_at, created_at, order_items(title)")
        .order("created_at", { ascending: true })
        .range(from, from + PAGE - 1);
      if (range.from) q = q.gte("created_at", range.from);
      if (range.to) q = q.lt("created_at", range.to);
      if (estado) q = q.eq("status", estado as OrderStatus);
      const { data, error } = await q;
      if (error) return new Response("No se pudieron leer los pedidos.", { status: 500 });
      rows.push(...((data ?? []) as Row[]));
      if (!data || data.length < PAGE) break;
    }
    const billing = (r: Row) => (r.billing_details ?? {}) as { rfc?: string; razon_social?: string };
    csv = toCsv(rows, [
      { header: "Pedido", value: (r) => r.order_number },
      { header: "Creado", value: (r) => csvDate(r.created_at) },
      { header: "Pagado", value: (r) => csvDate(r.paid_at) },
      { header: "Estado", value: (r) => orderStatusLabel[r.status] ?? r.status },
      { header: "Método", value: (r) => providerLabel[r.provider] ?? r.provider },
      { header: "Cliente", value: (r) => r.customer_name },
      { header: "Correo", value: (r) => r.customer_email },
      { header: "RFC", value: (r) => billing(r).rfc },
      { header: "Razón social", value: (r) => billing(r).razon_social },
      { header: "Artículos", value: (r) => r.order_items.map((i) => i.title).join(" | ") },
      { header: "Cupón", value: (r) => r.coupon_code },
      { header: "Moneda", value: (r) => r.currency },
      { header: "Subtotal", value: (r) => centsToDecimal(r.subtotal_cents) },
      { header: "Descuento", value: (r) => centsToDecimal(r.discount_cents) },
      { header: "Total", value: (r) => centsToDecimal(r.total_cents) },
      { header: "Reembolsado", value: (r) => centsToDecimal(r.refunded_cents) },
      { header: "Neto", value: (r) => centsToDecimal(r.status === "paid" || r.status === "partially_refunded" || r.status === "refunded" ? r.total_cents - r.refunded_cents : 0) },
      { header: "Referencia del pago", value: (r) => r.provider_payment_id },
    ]);
    count = rows.length;
  } else {
    type Row = { full_name: string | null; email: string; created_at: string; enrollments: { completed_at: string | null; revoked_at: string | null }[]; certificates: { revoked_at: string | null }[]; orders: { status: string; total_cents: number; refunded_cents: number }[] };
    const rows: Row[] = [];
    for (let from = 0; from < MAX_ROWS; from += PAGE) {
      let q = supabase
        .from("profiles")
        .select("full_name, email, created_at, enrollments(completed_at, revoked_at), certificates(revoked_at), orders(status, total_cents, refunded_cents)")
        .eq("role", "student")
        .order("created_at", { ascending: true })
        .range(from, from + PAGE - 1);
      if (range.from) q = q.gte("created_at", range.from);
      if (range.to) q = q.lt("created_at", range.to);
      const { data, error } = await q;
      if (error) return new Response("No se pudieron leer los alumnos.", { status: 500 });
      rows.push(...((data ?? []) as Row[]));
      if (!data || data.length < PAGE) break;
    }
    const active = (r: Row) => r.enrollments.filter((e) => !e.revoked_at);
    csv = toCsv(rows, [
      { header: "Nombre", value: (r) => r.full_name },
      { header: "Correo", value: (r) => r.email },
      { header: "Registro", value: (r) => csvDate(r.created_at) },
      { header: "Cursos inscritos", value: (r) => active(r).length },
      { header: "Cursos completados", value: (r) => active(r).filter((e) => e.completed_at).length },
      { header: "Certificados", value: (r) => r.certificates.filter((c) => !c.revoked_at).length },
      { header: "Total pagado neto (MXN)", value: (r) => centsToDecimal(r.orders.filter((o) => ["paid", "partially_refunded", "refunded"].includes(o.status)).reduce((s, o) => s + o.total_cents - o.refunded_cents, 0)) },
    ]);
    count = rows.length;
  }

  await createAdminClient().from("admin_audit_log").insert({
    actor_id: user.id,
    action: "export",
    entity: kind === "pedidos" ? "orders" : kind === "ingresos" ? "revenue" : "students",
    entity_id: null,
    details: { rows: count, desde: sp.get("desde") || null, hasta: sp.get("hasta") || null, estado },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="nexus-${kind}-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
