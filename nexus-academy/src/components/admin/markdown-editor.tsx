"use client";
import { useRef, useState } from "react";
import { Bold, Code, Eye, Heading2, Italic, Link2, List, ListOrdered, Pencil, Quote, SquareCode } from "lucide-react";
import { Markdown } from "@/components/ui/markdown";
import { cn } from "@/lib/utils";

type Action = { label: string; icon: typeof Bold; wrap?: [string, string]; line?: string; block?: string };

const actions: Action[] = [
  { label: "Subtítulo", icon: Heading2, line: "## " },
  { label: "Negritas", icon: Bold, wrap: ["**", "**"] },
  { label: "Cursiva", icon: Italic, wrap: ["*", "*"] },
  { label: "Lista", icon: List, line: "- " },
  { label: "Lista numerada", icon: ListOrdered, line: "1. " },
  { label: "Cita", icon: Quote, line: "> " },
  { label: "Código en línea", icon: Code, wrap: ["`", "`"] },
  { label: "Bloque de código", icon: SquareCode, block: "```js\n\n```" },
  { label: "Enlace", icon: Link2, wrap: ["[", "](https://)"] },
];

/**
 * Editor de Markdown con barra de formato y vista previa con el mismo render
 * que verá el alumno. Envía el valor en un textarea normal (funciona con Server Actions).
 */
export function MarkdownEditor({ id, name, defaultValue = "", rows = 14, label }: { id: string; name: string; defaultValue?: string; rows?: number; label: string }) {
  const [value, setValue] = useState(defaultValue);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const ref = useRef<HTMLTextAreaElement>(null);

  function apply(a: Action) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const selected = value.slice(start, end);
    let next = value;
    let cursorStart = start;
    let cursorEnd = end;
    if (a.wrap) {
      const [before, after] = a.wrap;
      next = value.slice(0, start) + before + (selected || "texto") + after + value.slice(end);
      cursorStart = start + before.length;
      cursorEnd = cursorStart + (selected || "texto").length;
    } else if (a.line) {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const block = value.slice(lineStart, end) || "";
      const prefixed = block.split("\n").map((l, i) => (a.line === "1. " ? `${i + 1}. ` : a.line) + l).join("\n");
      next = value.slice(0, lineStart) + prefixed + value.slice(end);
      cursorStart = cursorEnd = lineStart + prefixed.length;
    } else if (a.block) {
      const prefix = start > 0 && value[start - 1] !== "\n" ? "\n\n" : "";
      const insert = prefix + a.block + "\n";
      next = value.slice(0, start) + insert + value.slice(end);
      // Cursor en la línea vacía dentro del bloque de código.
      cursorStart = cursorEnd = start + prefix.length + a.block.indexOf("\n") + 1;
    }
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursorStart, cursorEnd);
    });
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-mist-200">{label}</label>
        <div className="flex rounded-lg border border-white/10 p-0.5 text-xs xl:hidden" role="tablist" aria-label="Modo del editor">
          <button type="button" role="tab" aria-selected={tab === "write"} onClick={() => setTab("write")} className={cn("inline-flex items-center gap-1 rounded-md px-2.5 py-1", tab === "write" ? "bg-white/[0.08] text-white" : "text-mist-400")}><Pencil className="size-3" /> Escribir</button>
          <button type="button" role="tab" aria-selected={tab === "preview"} onClick={() => setTab("preview")} className={cn("inline-flex items-center gap-1 rounded-md px-2.5 py-1", tab === "preview" ? "bg-white/[0.08] text-white" : "text-mist-400")}><Eye className="size-3" /> Vista previa</button>
        </div>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        <div className={cn("overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] focus-within:border-electric-400/60", tab === "preview" && "hidden xl:block")}>
          <div className="flex flex-wrap gap-0.5 border-b border-white/[0.06] p-1" role="toolbar" aria-label="Formato">
            {actions.map((a) => (
              <button key={a.label} type="button" onClick={() => apply(a)} title={a.label} aria-label={a.label} className="grid size-8 place-items-center rounded-lg text-mist-300 hover:bg-white/[0.06] hover:text-white">
                <a.icon className="size-4" />
              </button>
            ))}
          </div>
          <textarea
            ref={ref}
            id={id}
            name={name}
            rows={rows}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="block w-full resize-y bg-transparent px-4 py-3 font-mono text-sm leading-relaxed text-white placeholder:text-mist-500 focus:outline-none"
            placeholder="Escribe en Markdown: ## títulos, **negritas**, listas, `código`…"
          />
        </div>
        <div className={cn("min-h-40 overflow-auto rounded-xl border border-white/[0.06] bg-ink-950/50 px-5 py-4", tab === "write" && "hidden xl:block")} aria-label="Vista previa" data-testid="markdown-preview">
          {value.trim() ? <Markdown>{value}</Markdown> : <p className="text-sm text-mist-500">La vista previa aparecerá aquí tal como la verá el alumno.</p>}
        </div>
      </div>
    </div>
  );
}
