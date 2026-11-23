import type { ReactNode } from "react";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-4xl font-semibold tracking-tight text-white">{title}</h1>
      <p className="mt-2 text-sm text-mist-400">Última actualización: {updated}</p>
      <div className="prose-nexus mt-10">{children}</div>
      <p className="mt-12 rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4 text-xs text-amber-200/80">
        Plantilla base preparada para NEXUS ACADEMY. Antes de operar comercialmente, revísala con un asesor legal y completa los datos del responsable (razón social, domicilio y correo de contacto).
      </p>
    </div>
  );
}
