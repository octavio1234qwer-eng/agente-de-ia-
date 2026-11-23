"use client";
import { useState } from "react";
import { Check, Link2 } from "lucide-react";

export function CopyLink({ url, label = "Copiar enlace de verificación" }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("Copia el enlace:", url);
        }
      }}
      className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-mist-100 hover:bg-white/[0.06]"
    >
      {copied ? <Check className="size-4 text-emerald-300" /> : <Link2 className="size-4" />} {copied ? "¡Copiado!" : label}
    </button>
  );
}
