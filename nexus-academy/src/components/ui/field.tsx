import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const inputBase =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-[15px] text-white placeholder:text-mist-400/70 transition focus:border-electric-400/70 focus:bg-white/[0.06] focus:outline-none focus:ring-4 focus:ring-electric-500/15 disabled:opacity-60";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputBase, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(inputBase, "min-h-28 py-3 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(inputBase, "h-12 appearance-none bg-[length:16px] pr-10", className)} {...props}>
      {children}
    </select>
  );
}

export function Field({ label, htmlFor, error, hint, children, className }: {
  label: string;
  htmlFor: string;
  error?: string | null;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-mist-200">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-mist-400">{hint}</p>
      ) : null}
    </div>
  );
}

export function FormMessage({ state }: { state?: { error?: string | null; success?: string | null } | null }) {
  if (!state) return null;
  if (state.error)
    return (
      <div role="alert" className="rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
        {state.error}
      </div>
    );
  if (state.success)
    return (
      <div role="status" className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
        {state.success}
      </div>
    );
  return null;
}
