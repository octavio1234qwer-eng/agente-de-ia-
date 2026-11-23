import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getMyCart } from "@/lib/data/user";
import { enabledPaymentProviders } from "@/lib/env";
import { quoteFor, CheckoutError } from "@/lib/commerce/checkout";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { formatMoney } from "@/lib/utils";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Pago", robots: { index: false } };

const labels = {
  stripe: { label: "Tarjeta de crédito o débito", description: "Visa, Mastercard y American Express · procesado por Stripe" },
  mercadopago: { label: "Mercado Pago", description: "Tarjetas, saldo de Mercado Pago y otros medios en México" },
  paypal: { label: "PayPal", description: "Paga con tu cuenta de PayPal o tarjeta" },
} as const;

export default async function CheckoutPage() {
  const user = await requireUser("/checkout");
  const items = await getMyCart(user.id);
  if (items.length === 0) redirect("/carrito");

  let quote;
  try {
    quote = await quoteFor(user.id, items.map((i) => ({ type: i.item_type, id: (i.course?.id ?? i.bundle?.id)! })));
  } catch (e) {
    const message = e instanceof CheckoutError ? e.message : "No pudimos preparar tu pedido.";
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold text-white">Revisa tu carrito</h1>
        <p className="mt-3 text-mist-300">{message}</p>
        <LinkButton href="/carrito" className="mt-8">Volver al carrito</LinkButton>
      </div>
    );
  }

  const providers = enabledPaymentProviders().map((id) => ({ id, ...labels[id] }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight text-white">Finalizar compra</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_420px]">
        <section aria-labelledby="resumen" className="order-2 lg:order-1">
          <h2 id="resumen" className="text-lg font-semibold text-white">Resumen del pedido</h2>
          <ul className="mt-4 divide-y divide-white/[0.06] rounded-2xl border border-white/[0.06]">
            {quote.lines.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="text-xs text-mist-400">{l.type === "bundle" ? "Paquete" : "Curso"}</p>
                  <p className="font-medium text-white">{l.title}</p>
                </div>
                <p className="text-white">{formatMoney(l.unitPriceCents, l.currency)}</p>
              </li>
            ))}
          </ul>
          <ul className="mt-6 space-y-2 text-sm text-mist-400">
            <li>• Acceso inmediato en cuanto el proveedor confirme el pago.</li>
            <li>• Recibirás la confirmación por correo en {user.email}.</li>
            <li>• Precios en {quote.currency}, impuestos incluidos.</li>
          </ul>
        </section>
        <div className="order-1 lg:order-2">
          <CheckoutForm providers={providers} initial={{ subtotalCents: quote.subtotalCents, totalCents: quote.totalCents, currency: quote.currency }} />
        </div>
      </div>
    </div>
  );
}
