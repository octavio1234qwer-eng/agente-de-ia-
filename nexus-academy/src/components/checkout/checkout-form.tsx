"use client";
import { useActionState, useState } from "react";
import { CreditCard, Lock, Tag, Wallet } from "lucide-react";
import { applyCouponAction, startCheckoutAction, type QuoteState } from "@/lib/actions/commerce";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage, Input } from "@/components/ui/field";
import { cn, formatMoney } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

type Provider = { id: "stripe" | "mercadopago" | "paypal"; label: string; description: string };

const providerMeta: Record<Provider["id"], { icon: typeof CreditCard }> = {
  stripe: { icon: CreditCard },
  mercadopago: { icon: Wallet },
  paypal: { icon: Wallet },
};

export function CheckoutForm({ providers, initial }: { providers: Provider[]; initial: { subtotalCents: number; totalCents: number; currency: string } }) {
  const [couponState, couponAction] = useActionState<QuoteState, FormData>(applyCouponAction, null);
  const [checkoutState, checkoutAction] = useActionState(startCheckoutAction, null);
  const [provider, setProvider] = useState<Provider["id"] | null>(providers[0]?.id ?? null);
  const [wantsInvoice, setWantsInvoice] = useState(false);
  const quote = couponState?.quote;
  const subtotal = quote?.subtotalCents ?? initial.subtotalCents;
  const discount = quote?.discountCents ?? 0;
  const total = quote?.totalCents ?? initial.totalCents;
  const currency = quote?.currency ?? initial.currency;

  return (
    <div className="space-y-6">
      <form action={couponAction} className="glass rounded-2xl p-5">
        <label htmlFor="coupon" className="flex items-center gap-2 text-sm font-medium text-white"><Tag className="size-4" aria-hidden /> Cupón de descuento</label>
        <div className="mt-3 flex gap-2">
          <Input id="coupon" name="coupon" placeholder="CÓDIGO" autoCapitalize="characters" className="h-11 uppercase" defaultValue={quote?.coupon ?? ""} />
          <SubmitButton variant="secondary" className="h-11">Aplicar</SubmitButton>
        </div>
        <div className="mt-3"><FormMessage state={couponState} /></div>
      </form>

      <form action={checkoutAction} className="space-y-6">
        <input type="hidden" name="coupon" value={quote?.coupon ?? ""} />
        <fieldset className="glass rounded-2xl p-5">
          <legend className="sr-only">Método de pago</legend>
          <p className="text-sm font-medium text-white">Método de pago</p>
          {providers.length === 0 ? (
            <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              Los pagos en línea aún no están activados en esta instalación. Ningún cargo puede realizarse hasta que el administrador configure Stripe, Mercado Pago o PayPal.
            </p>
          ) : (
            <div className="mt-3 grid gap-3">
              {providers.map((p) => {
                const Icon = providerMeta[p.id].icon;
                return (
                  <label key={p.id} className={cn("flex min-h-16 cursor-pointer items-center gap-4 rounded-xl border px-4 py-3 transition", provider === p.id ? "border-electric-400/60 bg-electric-500/10" : "border-white/10 hover:border-white/20")}>
                    <input type="radio" name="provider" value={p.id} checked={provider === p.id} onChange={() => setProvider(p.id)} className="size-4 accent-electric-500" />
                    <Icon className="size-5 text-mist-300" aria-hidden />
                    <span><span className="block text-sm font-medium text-white">{p.label}</span><span className="text-xs text-mist-400">{p.description}</span></span>
                  </label>
                );
              })}
            </div>
          )}
        </fieldset>

        <div className="glass space-y-4 rounded-2xl p-5">
          <label className="flex items-center gap-3 text-sm text-mist-200">
            <input type="checkbox" checked={wantsInvoice} onChange={(e) => setWantsInvoice(e.target.checked)} className="size-4 accent-electric-500" />
            Necesito factura (CFDI)
          </label>
          {wantsInvoice && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="rfc" className="text-xs text-mist-300">RFC</label>
                <Input id="rfc" name="rfc" maxLength={13} className="mt-1 h-11 uppercase" placeholder="XAXX010101000" />
              </div>
              <div>
                <label htmlFor="businessName" className="text-xs text-mist-300">Nombre o razón social</label>
                <Input id="businessName" name="businessName" maxLength={200} className="mt-1 h-11" />
              </div>
            </div>
          )}
        </div>

        <div className="glass rounded-2xl p-5">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between text-mist-300"><dt>Subtotal</dt><dd>{formatMoney(subtotal, currency)}</dd></div>
            {discount > 0 && <div className="flex justify-between text-emerald-300"><dt>Descuento ({quote?.coupon})</dt><dd>−{formatMoney(discount, currency)}</dd></div>}
            <div className="flex justify-between border-t border-white/[0.06] pt-3 text-lg font-semibold text-white"><dt>Total</dt><dd>{formatMoney(total, currency)}</dd></div>
          </dl>
          <label className="mt-5 flex items-start gap-3 text-sm text-mist-300">
            <input type="checkbox" name="terms" required className="mt-0.5 size-4 accent-electric-500" />
            <span>Acepto los <a href="/terminos" className="text-electric-300 underline">términos</a> y la <a href="/reembolsos" className="text-electric-300 underline">política de reembolsos</a>.</span>
          </label>
          <div className="mt-4"><FormMessage state={checkoutState} /></div>
          <SubmitButton size="lg" className="mt-4 w-full" disabled={!provider && total > 0} pendingLabel="Conectando con el pago seguro…">
            <Lock className="size-4" aria-hidden /> {total === 0 ? "Obtener acceso" : `Pagar ${formatMoney(total, currency)}`}
          </SubmitButton>
          <p className="mt-3 text-center text-xs text-mist-400">Serás redirigido a la página segura del proveedor. {BRAND.name} no ve ni guarda los datos de tu tarjeta.</p>
        </div>
      </form>
    </div>
  );
}
