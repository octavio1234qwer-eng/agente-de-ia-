"use client";
import { useEffect, useRef, useState } from "react";
import { Bot, LoaderCircle, Send, Sparkles, X } from "lucide-react";
import { Markdown } from "@/components/ui/markdown";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

type Msg = { role: "user" | "assistant"; content: string };

const lessonActions = [
  { label: "Explícame esta lección", prompt: "Explícame los conceptos clave de esta lección con un ejemplo sencillo." },
  { label: "Resumen", prompt: "Hazme un resumen de esta lección en viñetas y 2 preguntas para comprobar que entendí." },
  { label: "Preguntas de práctica", prompt: "Genera 5 preguntas de práctica sobre esta lección, con las soluciones al final." },
  { label: "¿Qué estudio después?", prompt: "Según lo que estoy aprendiendo, ¿qué cursos del catálogo me recomiendas después y en qué orden?" },
];
const generalActions = [
  { label: "Arma mi ruta", prompt: "Quiero una ruta de aprendizaje. Pregúntame mi objetivo y mi nivel actual y propón un plan con cursos del catálogo." },
  { label: "Recomiéndame cursos", prompt: "Soy principiante y quiero trabajar en tecnología. ¿Con qué cursos del catálogo empiezo?" },
  { label: "Explícame un concepto", prompt: "Explícame qué es una API con una analogía y un ejemplo." },
];

export function NexusChat({ lessonId, variant = "drawer", initialConversationId, initialMessages = [] }: {
  lessonId?: string;
  variant?: "drawer" | "page";
  initialConversationId?: string | null;
  initialMessages?: Msg[];
}) {
  const [open, setOpen] = useState(variant === "page");
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationId = useRef<string | null>(initialConversationId ?? null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setError(null);
    setBusy(true);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: message }, { role: "assistant", content: "" }]);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, lessonId, conversationId: conversationId.current ?? undefined }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({ error: `No se pudo conectar con ${BRAND.aiName}.` }));
        setMessages((m) => m.slice(0, -1));
        setError(data.error);
        return;
      }
      conversationId.current = res.headers.get("X-Conversation-Id") ?? conversationId.current;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: copy[copy.length - 1].content + chunk };
          return copy;
        });
      }
    } catch {
      setMessages((m) => m.slice(0, -1));
      setError("Se perdió la conexión. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const actions = lessonId ? lessonActions : generalActions;

  const panel = (
    <div className={cn("flex h-full flex-col", variant === "page" ? "glass rounded-3xl" : "")}>
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
        <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-electric-500 to-violet-600"><Bot className="size-4.5 text-white" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white">{BRAND.aiName}</p>
          <p className="text-xs text-mist-400">{lessonId ? "Conoce el contenido de esta lección" : "Tu tutor de aprendizaje"}</p>
        </div>
        {variant === "drawer" && (
          <button type="button" onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-xl text-mist-300 hover:bg-white/[0.06]" aria-label={`Cerrar ${BRAND.aiName}`}><X className="size-5" /></button>
        )}
      </div>
      <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto px-5 py-5" aria-live="polite">
        {messages.length === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-mist-300">Pregúntame lo que quieras. Puedo explicar, resumir, crear ejercicios y recomendarte cursos del catálogo.</p>
            <div className="flex flex-wrap gap-2">
              {actions.map((a) => (
                <button key={a.label} type="button" onClick={() => send(a.prompt)} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs text-mist-200 hover:border-violet-400/40 hover:text-white">
                  <Sparkles className="size-3.5 text-violet-300" aria-hidden /> {a.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[92%] rounded-2xl px-4 py-3 text-sm", m.role === "user" ? "bg-electric-600/30 text-white" : "bg-white/[0.04] text-mist-100")}>
              {m.role === "assistant" ? (
                m.content ? <Markdown className="text-sm [&_pre]:text-xs">{m.content}</Markdown> : <LoaderCircle className="size-4 animate-spin text-mist-400" aria-label="Pensando" />
              ) : (
                <p className="whitespace-pre-wrap">{m.content}</p>
              )}
            </div>
          </div>
        ))}
        {error && <p role="alert" className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{error}</p>}
      </div>
      <form
        className="border-t border-white/[0.06] p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2 focus-within:border-electric-400/60">
          <label htmlFor="nexus-input" className="sr-only">Escribe tu pregunta</label>
          <textarea
            id="nexus-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder="Escribe tu pregunta…"
            className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-white placeholder:text-mist-400 focus:outline-none"
          />
          <button type="submit" disabled={busy || !input.trim()} className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-electric-500 to-violet-600 text-white disabled:opacity-40" aria-label="Enviar">
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </div>
        <p className="mt-2 px-1 text-[11px] text-mist-500">{BRAND.aiName} puede equivocarse. Verifica la información importante.</p>
      </form>
    </div>
  );

  if (variant === "page") return <div className="h-[70dvh] min-h-[480px]">{panel}</div>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-30 flex h-12 items-center gap-2 rounded-2xl bg-gradient-to-r from-electric-500 to-violet-600 px-4 text-sm font-medium text-white shadow-[0_10px_40px_-10px_rgb(139_92_246_/_0.8)]"
        aria-expanded={open}
      >
        <Bot className="size-4.5" aria-hidden /> {BRAND.aiName}
      </button>
      <div className={cn("fixed inset-0 z-50 transition", open ? "pointer-events-auto" : "pointer-events-none")} inert={!open}>
        <button type="button" tabIndex={-1} className={cn("absolute inset-0 bg-black/50 transition-opacity", open ? "opacity-100" : "opacity-0")} onClick={() => setOpen(false)} aria-label="Cerrar" />
        <aside
          role="dialog"
          aria-label={BRAND.aiName}
          className={cn("absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-ink-900 shadow-2xl transition-transform duration-300 sm:border-l sm:border-white/[0.06]", open ? "translate-x-0" : "translate-x-full")}
        >
          {panel}
        </aside>
      </div>
    </>
  );
}
