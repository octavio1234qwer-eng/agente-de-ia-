import type { Metadata } from "next";
import Link from "next/link";
import { Layers } from "lucide-react";
import { getBundles } from "@/lib/data/catalog";
import { PriceTag } from "@/components/course/price-tag";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Paquetes de cursos", description: "Rutas de aprendizaje con varios cursos a un precio especial." };

export default async function BundlesPage() {
  const bundles = await getBundles();
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">Paquetes</h1>
      <p className="mt-3 max-w-2xl text-mist-300">Rutas completas con varios cursos a un precio especial. Un solo pago, acceso de por vida a todos los cursos del paquete.</p>
      {bundles.length === 0 ? (
        <EmptyState className="mt-10" icon={<Layers className="size-6" />} title="Aún no hay paquetes" action={<LinkButton href="/cursos">Ver cursos</LinkButton>} />
      ) : (
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {bundles.map((b) => {
            const courses = [...b.bundle_courses].sort((x, y) => x.position - y.position).map((bc) => bc.courses).filter(Boolean);
            const separate = courses.reduce((s, c) => s + (c?.price_cents ?? 0), 0);
            return (
              <Link key={b.id} href={`/paquetes/${b.slug}`} className="group glass glow-border flex flex-col rounded-3xl p-7 transition hover:-translate-y-1">
                <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-electric-500/30 to-violet-600/30 text-violet-200"><Layers className="size-6" /></span>
                <h2 className="mt-5 text-2xl font-semibold text-white group-hover:text-electric-300">{b.title}</h2>
                <p className="mt-2 text-sm text-mist-300">{b.description}</p>
                <ul className="mt-5 space-y-2 text-sm text-mist-200">
                  {courses.map((c) => <li key={c!.id} className="flex items-center gap-2"><span className="size-1.5 rounded-full" style={{ background: c!.category?.color ?? "#6b95ff" }} />{c!.title}</li>)}
                </ul>
                <div className="mt-auto pt-6">
                  <PriceTag price={b.price_cents} compareAt={b.compare_at_price_cents} currency={b.currency} size="lg" />
                  {separate > b.price_cents && <p className="mt-1 text-xs text-mist-400">Por separado: {new Intl.NumberFormat("es-MX", { style: "currency", currency: b.currency }).format(separate / 100)}</p>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
