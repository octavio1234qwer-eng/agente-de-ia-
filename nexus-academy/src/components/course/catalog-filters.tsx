"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Search, SlidersHorizontal, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

export function CatalogFilters({ categories }: { categories: Option[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("pagina");
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  const groups: { key: string; title: string; options: Option[] }[] = [
    { key: "categoria", title: "Categoría", options: categories },
    { key: "precio", title: "Precio", options: [{ value: "gratis", label: "Gratis" }, { value: "pago", label: "De pago" }] },
    {
      key: "nivel",
      title: "Nivel",
      options: [
        { value: "beginner", label: "Principiante" },
        { value: "intermediate", label: "Intermedio" },
        { value: "advanced", label: "Avanzado" },
      ],
    },
    {
      key: "max",
      title: "Precio máximo",
      options: [
        { value: "500", label: "Hasta $500" },
        { value: "1000", label: "Hasta $1,000" },
        { value: "1500", label: "Hasta $1,500" },
      ],
    },
  ];

  const active = groups.some((g) => params.get(g.key)) || params.get("q");

  return (
    <aside className="lg:sticky lg:top-24">
      <details className="group glass rounded-2xl lg:open:bg-transparent" open>
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 lg:hidden [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2 font-medium text-white"><SlidersHorizontal className="size-4" aria-hidden /> Filtros</span>
          {pending && <LoaderCircle className="size-4 animate-spin text-mist-400" aria-label="Cargando" />}
        </summary>
        <div className="space-y-6 px-5 pb-5 lg:pt-5">
          <div className="hidden items-center justify-between lg:flex">
            <span className="flex items-center gap-2 font-medium text-white"><SlidersHorizontal className="size-4" aria-hidden /> Filtros</span>
            {active ? (
              <button type="button" onClick={() => startTransition(() => router.push(pathname))} className="text-xs text-mist-400 hover:text-white">
                Limpiar todo
              </button>
            ) : pending ? <LoaderCircle className="size-4 animate-spin text-mist-400" /> : null}
          </div>
          {groups.map((g) => (
            <fieldset key={g.key} className="space-y-1.5">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-mist-400">{g.title}</legend>
              {g.options.map((o) => {
                const checked = params.get(g.key) === o.value;
                return (
                  <label key={o.value} className={cn("flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm transition hover:bg-white/[0.04]", checked ? "text-white" : "text-mist-300")}>
                    <input
                      type="radio"
                      name={g.key}
                      value={o.value}
                      checked={checked}
                      onChange={() => update(g.key, o.value)}
                      onClick={() => checked && update(g.key, null)}
                      className="size-4 accent-electric-500"
                    />
                    {o.label}
                  </label>
                );
              })}
            </fieldset>
          ))}
        </div>
      </details>
    </aside>
  );
}

export function CatalogSearch({ defaultValue, sort }: { defaultValue: string; sort: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function go(updates: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("pagina");
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  return (
    <form
      role="search"
      className="flex flex-col gap-3 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        const q = new FormData(e.currentTarget).get("q");
        go({ q: String(q ?? "").trim() });
      }}
    >
      <label className="relative flex-1">
        <span className="sr-only">Buscar cursos</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-mist-400" aria-hidden />
        <input
          name="q"
          type="search"
          defaultValue={defaultValue}
          placeholder="¿Qué quieres aprender? Escribe y presiona Enter"
          className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-11 pr-10 text-[15px] text-white placeholder:text-mist-400/70 focus:border-electric-400/70 focus:outline-none focus:ring-4 focus:ring-electric-500/15"
        />
        {pending && <LoaderCircle className="absolute right-4 top-1/2 size-4 -translate-y-1/2 animate-spin text-mist-400" aria-label="Buscando" />}
      </label>
      <label className="sm:w-56">
        <span className="sr-only">Ordenar por</span>
        <select
          value={sort}
          onChange={(e) => go({ orden: e.target.value })}
          className="h-12 w-full rounded-xl border border-white/10 bg-ink-850 px-4 text-[15px] text-white focus:border-electric-400/70 focus:outline-none"
        >
          <option value="populares">Más populares</option>
          <option value="recientes">Más recientes</option>
          <option value="valorados">Mejor valorados</option>
          <option value="precio-asc">Precio: menor a mayor</option>
          <option value="precio-desc">Precio: mayor a menor</option>
        </select>
      </label>
    </form>
  );
}
