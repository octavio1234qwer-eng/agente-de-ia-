import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Pago cancelado", robots: { index: false } };

export default async function CancelledPage() {
  await requireUser("/carrito");
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-3xl font-semibold text-white">Pago cancelado</h1>
      <p className="mt-3 text-mist-300">No se realizó ningún cargo. Tus cursos siguen en el carrito para cuando quieras continuar.</p>
      <div className="mt-8 flex justify-center gap-3">
        <LinkButton href="/checkout">Volver al pago</LinkButton>
        <LinkButton href="/carrito" variant="secondary">Ver carrito</LinkButton>
      </div>
    </div>
  );
}
