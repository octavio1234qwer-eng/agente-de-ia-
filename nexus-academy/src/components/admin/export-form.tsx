import { Download } from "lucide-react";
import { orderStatusLabel } from "@/lib/utils";

/**
 * Descarga CSV (formulario GET: funciona sin JavaScript). Las fechas son
 * inclusivas y en hora de Ciudad de México; vacías = sin límite.
 */
export function ExportForm({ kind, statuses }: { kind: "pedidos" | "alumnos"; statuses?: readonly string[] }) {
  const id = `export-${kind}`;
  return (
    <details className="mb-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm text-mist-100 hover:text-white">
        <Download className="size-4 text-electric-300" aria-hidden /> Exportar {kind} a CSV
        <span className="text-xs text-mist-500">· para Excel o contabilidad</span>
      </summary>
      <form action={`/api/admin/export/${kind}`} method="get" className="flex flex-wrap items-end gap-3 border-t border-white/[0.06] px-4 py-4">
        <label className="text-xs text-mist-400" htmlFor={`${id}-desde`}>
          {kind === "pedidos" ? "Creados desde" : "Registrados desde"}
          <input id={`${id}-desde`} type="date" name="desde" className="mt-1 block h-10 rounded-xl border border-white/10 bg-ink-850 px-3 text-sm text-white [color-scheme:dark]" />
        </label>
        <label className="text-xs text-mist-400" htmlFor={`${id}-hasta`}>
          hasta
          <input id={`${id}-hasta`} type="date" name="hasta" className="mt-1 block h-10 rounded-xl border border-white/10 bg-ink-850 px-3 text-sm text-white [color-scheme:dark]" />
        </label>
        {statuses && (
          <label className="text-xs text-mist-400" htmlFor={`${id}-estado`}>
            Estado
            <select id={`${id}-estado`} name="estado" defaultValue="" className="mt-1 block h-10 rounded-xl border border-white/10 bg-ink-850 px-3 text-sm text-white">
              <option value="">Todos</option>
              {statuses.map((s) => <option key={s} value={s}>{orderStatusLabel[s]}</option>)}
            </select>
          </label>
        )}
        <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-electric-500 to-violet-500 px-4 text-sm font-medium text-white hover:opacity-95">
          <Download className="size-4" aria-hidden /> Descargar CSV
        </button>
        <p className="w-full text-xs text-mist-500">Fechas inclusivas, hora de Ciudad de México. Sin fechas se exporta todo. Cada descarga queda registrada en la auditoría.</p>
      </form>
    </details>
  );
}
