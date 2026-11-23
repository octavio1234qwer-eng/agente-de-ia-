import type { ReactNode } from "react";

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="glass-strong glow-border rounded-3xl p-7 shadow-[0_40px_120px_-40px_rgb(59_116_255_/_0.6)] sm:p-9">
      <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-mist-300">{subtitle}</p>}
      <div className="mt-7">{children}</div>
      {footer && <div className="mt-7 border-t border-white/[0.06] pt-5 text-center text-sm text-mist-400">{footer}</div>}
    </div>
  );
}
