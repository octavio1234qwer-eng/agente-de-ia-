import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { verifyReturn } from "@/lib/commerce/verify";
import { AutoRefresh } from "@/components/checkout/auto-refresh";
import { LinkButton } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Estado de tu pago", robots: { index: false } };

type SP = { order?: string; session_id?: string; payment_id?: string; collection_id?: string; error?: string };

export default async function SuccessPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await requireUser("/cuenta/compras");
  const orderId = sp.order && /^[0-9a-f-]{36}$/i.test(sp.order) ? sp.order : null;
  if (!orderId) {
    return <Shell icon={<XCircle className="size-10 text-red-300" />} title="Pedido no encontrado" text="No encontramos el pedido. Revisa tu historial de compras." />;
  }

  const supabase = await createClient();
  const load = () =>
    supabase.from("orders").select("id, order_number, status, total_cents, currency, order_items(title, course_id, courses(slug))").eq("id", orderId).maybeSingle();
  let { data: order } = await load();
  if (!order) {
    return <Shell icon={<XCircle className="size-10 text-red-300" />} title="Pedido no encontrado" text="Este pedido no pertenece a tu cuenta." />;
  }
  if (order.status === "pending") {
    await verifyReturn(order.id, { sessionId: sp.session_id, paymentId: sp.payment_id ?? sp.collection_id });
    ({ data: order } = await load());
  }
  if (!order) return null;

  if (order.status === "paid") {
    const firstCourse = order.order_items.find((i) => i.courses?.slug)?.courses?.slug;
    return (
      <Shell icon={<CheckCircle2 className="size-10 text-emerald-300" />} title="¡Pago confirmado!" text={`Pedido ${order.order_number} · ${formatMoney(order.total_cents, order.currency)}. Ya tienes acceso y te enviamos la confirmación a ${user.email}.`}>
        <ul className="mx-auto mt-6 max-w-md space-y-2 text-left text-sm text-mist-200">
          {order.order_items.map((i) => <li key={i.title} className="glass rounded-xl px-4 py-3">{i.title}</li>)}
        </ul>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          {firstCourse && <LinkButton href={`/aprender/${firstCourse}`}>Empezar a aprender</LinkButton>}
          <LinkButton href="/cuenta/cursos" variant="secondary">Ir a mis cursos</LinkButton>
        </div>
      </Shell>
    );
  }

  if (order.status === "pending") {
    return (
      <Shell icon={<Clock className="size-10 animate-pulse text-amber-300" />} title="Estamos confirmando tu pago" text="El proveedor de pagos todavía no nos confirma la transacción. Esta página se actualiza sola; no cierres ni vuelvas a pagar.">
        {sp.error === "capture" && <p className="mt-4 text-sm text-red-300">No pudimos completar la captura con PayPal. Si se realizó un cargo, se confirmará automáticamente.</p>}
        <AutoRefresh />
      </Shell>
    );
  }

  return (
    <Shell icon={<XCircle className="size-10 text-red-300" />} title="El pago no se completó" text="No se realizó ningún cargo por este pedido. Puedes intentarlo de nuevo o elegir otro método de pago.">
      <div className="mt-8 flex justify-center gap-3"><LinkButton href="/checkout">Intentar de nuevo</LinkButton><LinkButton href="/carrito" variant="secondary">Ver carrito</LinkButton></div>
    </Shell>
  );
}

function Shell({ icon, title, text, children }: { icon: React.ReactNode; title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <div className="mx-auto grid size-20 place-items-center rounded-full bg-white/[0.05]">{icon}</div>
      <h1 className="mt-6 text-3xl font-semibold text-white">{title}</h1>
      <p className="mx-auto mt-3 max-w-lg text-mist-300">{text}</p>
      {children}
      <p className="mt-10 text-sm text-mist-400"><Link href="/cuenta/compras" className="hover:text-white">Ver historial de compras</Link></p>
    </div>
  );
}
