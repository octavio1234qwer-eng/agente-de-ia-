import type { Metadata } from "next";
import { Receipt } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatMoney, orderStatusLabel, providerLabel } from "@/lib/utils";

export const metadata: Metadata = { title: "Historial de compras" };

const tone = { paid: "green", pending: "amber", failed: "red", cancelled: "neutral", expired: "neutral", refunded: "violet", partially_refunded: "violet" } as const;

export default async function PurchasesPage() {
  const user = await requireUser("/cuenta/compras");
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, status, provider, currency, subtotal_cents, discount_cents, total_cents, refunded_cents, coupon_code, created_at, paid_at, billing_details, order_items(id, title, total_cents)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!orders || orders.length === 0) {
    return (
      <EmptyState
        icon={<Receipt className="size-6" />}
        title="Sin compras todavía"
        description="Cuando compres un curso, aquí verás tu historial, el estado del pago y tus comprobantes."
        action={<LinkButton href="/cursos">Ver cursos</LinkButton>}
      />
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((o) => {
        const billing = o.billing_details as { rfc?: string; razon_social?: string } | null;
        return (
          <article key={o.id} className="glass rounded-2xl p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm text-white">{o.order_number}</p>
                <p className="mt-0.5 text-xs text-mist-400">
                  {formatDate(o.created_at, { dateStyle: "medium", timeStyle: "short" })} · {providerLabel[o.provider]}
                </p>
              </div>
              <Badge tone={tone[o.status]}>{orderStatusLabel[o.status]}</Badge>
            </div>
            <ul className="mt-4 divide-y divide-white/[0.06] border-y border-white/[0.06] text-sm">
              {o.order_items.map((i) => (
                <li key={i.id} className="flex justify-between gap-4 py-2.5"><span className="text-mist-200">{i.title}</span><span className="text-white">{formatMoney(i.total_cents, o.currency)}</span></li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 text-sm">
              {o.discount_cents > 0 && (
                <div className="flex justify-between text-mist-400"><dt>Descuento{o.coupon_code ? ` (${o.coupon_code})` : ""}</dt><dd>−{formatMoney(o.discount_cents, o.currency)}</dd></div>
              )}
              {o.refunded_cents > 0 && (
                <div className="flex justify-between text-mist-400"><dt>Reembolsado</dt><dd>−{formatMoney(o.refunded_cents, o.currency)}</dd></div>
              )}
              <div className="flex justify-between font-semibold text-white"><dt>Total</dt><dd>{formatMoney(o.total_cents, o.currency)}</dd></div>
            </dl>
            {billing?.rfc && <p className="mt-3 text-xs text-mist-400">Datos de facturación: RFC {billing.rfc}{billing.razon_social ? ` · ${billing.razon_social}` : ""}</p>}
          </article>
        );
      })}
    </div>
  );
}
