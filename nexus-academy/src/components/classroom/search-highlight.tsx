"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { matchWords } from "@/lib/search";

const NAME = "nexus-search";
const SEP = "\u0000";
// El compilador de CSS del proyecto descarta ::highlight() (selector que aún no
// reconoce), así que la regla se inserta aquí; React la sube al <head> una vez.
const HIGHLIGHT_CSS = `::highlight(${NAME}){background-color:rgb(59 116 255 / 0.4);color:#fff}`;

/**
 * Resalta en la lección las palabras que encontró la búsqueda. Usa la CSS
 * Custom Highlight API: no modifica el DOM que pinta React, así que no hay
 * conflictos al navegar. Si el navegador no la soporta, igual informa cuántas
 * coincidencias hay.
 */
export function SearchHighlight({ query, terms, clearHref, children }: { query: string; terms: string[]; clearHref: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{ count: number; supported: boolean } | null>(null);
  const key = terms.join(SEP);

  useEffect(() => {
    const root = ref.current;
    const list = key ? key.split(SEP) : [];
    if (!root || list.length === 0) return;
    const ranges: Range[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement?.closest("[data-search-banner], script, style, textarea") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      for (const [start, end] of matchWords(n.nodeValue ?? "", list)) {
        const r = new Range();
        r.setStart(n, start);
        r.setEnd(n, end);
        ranges.push(r);
      }
    }
    const supported = typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight !== "undefined";
    if (supported) CSS.highlights.set(NAME, new Highlight(...ranges));
    const frame = requestAnimationFrame(() => {
      setState({ count: ranges.length, supported });
      const first = ranges[0]?.startContainer.parentElement;
      if (first && first.getBoundingClientRect().top > window.innerHeight * 0.6) first.scrollIntoView({ block: "center" });
    });
    return () => {
      cancelAnimationFrame(frame);
      if (supported) CSS.highlights.delete(NAME);
    };
  }, [key]);

  const back = `/cuenta/buscar?q=${encodeURIComponent(query)}`;
  return (
    <div ref={ref} className="space-y-6">
      <style href="nexus-search-highlight" precedence="default">{HIGHLIGHT_CSS}</style>
      <div data-search-banner role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-electric-400/25 bg-electric-500/10 px-4 py-2.5 text-sm text-mist-100">
        <Search className="size-4 shrink-0 text-electric-300" aria-hidden />
        <span className="min-w-0 flex-1">
          {state === null
            ? <>Buscando «{query}» en esta lección…</>
            : state.count === 0
              ? <>«{query}» no aparece en el texto visible de esta lección; puede estar en el resumen o en sus recursos.</>
              : <>{state.count} {state.count === 1 ? "coincidencia" : "coincidencias"} de «{query}»{state.supported ? " resaltadas" : " (tu navegador no permite resaltarlas; usa Ctrl+F)"}.</>}
        </span>
        <Link href={back} className="text-electric-300 underline-offset-4 hover:underline">Volver a los resultados</Link>
        <Link href={clearHref} className="inline-flex items-center gap-1 text-mist-300 hover:text-white" aria-label="Quitar resaltado"><X className="size-4" aria-hidden /> Quitar</Link>
      </div>
      {children}
    </div>
  );
}
