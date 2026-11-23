"use client";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Botón de envío que pide confirmación antes de acciones destructivas. */
export function ConfirmButton({ message, children, className, danger = true }: { message: string; children: ReactNode; className?: string; danger?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition disabled:opacity-50", danger ? "text-red-300 hover:bg-red-500/10" : "text-mist-200 hover:bg-white/[0.06]", className)}
    >
      {pending && <LoaderCircle className="size-3.5 animate-spin" />} {children}
    </button>
  );
}

export function IconSubmit({ label, children }: { label: string; children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-label={label} title={label} className="grid size-8 place-items-center rounded-lg text-mist-400 hover:bg-white/[0.06] hover:text-white disabled:opacity-40">
      {children}
    </button>
  );
}
