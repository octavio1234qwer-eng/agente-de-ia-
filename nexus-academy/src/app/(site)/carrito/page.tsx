import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingCart, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getMyCart } from "@/lib/data/user";
import { removeFromCartAction } from "@/lib/actions/commerce";
import { CourseCover } from "@/components/course/course-cover";
import { PriceTag } from "@/components/course/price-tag";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Carrito" };

export default async function CartPage() {
  const user = await requireUser("/carrito");
  const items = await getMyCart(user.id);
  const lines = items
    .map((i) => {
      const p = i.course ?? i.bundle;
      if (!p) return null;
      return { id: i.id, type: i.item_type, product: p, href: i.course ? `/cursos/${i.course.slug}` : `/paquetes/${i.bundle!.slug}`, color: i.course?.category?.color, icon: i.course?.category?.icon };
    })
    .filter((l): l is NonNullable<typeof l> => Boolean(l));
  const currency = lines[0]?.product.currency ?? "MXN";
  const subtotal = lines.reduce((s, l) => s + l.product.price_cents, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight text-white">Tu carrito</h1>
      {lines.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={<ShoppingCart className="size-6" />}
          title="Tu carrito está vacío"
          description="Explora el catálogo y añade los cursos que quieras aprender."
          action={<LinkButton href="/cursos">Explorar cursos</LinkButton>}
        />
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
          <ul className="space-y-3">
            {lines.map((l) => (
              <li key={l.id} className="glass flex items-center gap-4 rounded-2xl p-3 sm:p-4">
                <CourseCover title={l.product.title} slug={l.product.slug} coverUrl={l.product.cover_url} color={l.color} icon={l.icon} className="aspect-video w-28 shrink-0 rounded-xl sm:w-40" sizes="160px" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-mist-400">{l.type === "bundle" ? "Paquete" : "Curso"}</p>
                  <Link href={l.href} className="line-clamp-2 font-medium text-white hover:text-electric-300">{l.product.title}</Link>
                  <PriceTag className="mt-1" price={l.product.price_cents} compareAt={l.product.compare_at_price_cents} currency={l.product.currency} />
                </div>
                <form action={removeFromCartAction}>
                  <input type="hidden" name="id" value={l.id} />
                  <button type="submit" className="grid size-11 place-items-center rounded-xl text-mist-400 hover:bg-white/[0.06] hover:text-red-300" aria-label={`Quitar ${l.product.title} del carrito`}>
                    <Trash2 className="size-4" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <aside className="glass h-fit rounded-2xl p-6 lg:sticky lg:top-24">
            <div className="flex justify-between text-sm text-mist-300"><span>Subtotal ({lines.length})</span><span>{formatMoney(subtotal, currency)}</span></div>
            <p className="mt-2 text-xs text-mist-400">Podrás aplicar cupones en el siguiente paso.</p>
            <LinkButton href="/checkout" size="lg" className="mt-6 w-full">Continuar al pago</LinkButton>
            <Link href="/cursos" className="mt-3 block text-center text-sm text-mist-400 hover:text-white">Seguir explorando</Link>
          </aside>
        </div>
      )}
    </div>
  );
}
