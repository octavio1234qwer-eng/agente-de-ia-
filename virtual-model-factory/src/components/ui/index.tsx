import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function Card({ className, children, ...rest }: ComponentProps<"section">) {
  return (
    <section
      className={cx("rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_0_0_1px_rgb(255_255_255/0.02)] backdrop-blur", className)}
      {...rest}
    >
      {children}
    </section>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

const buttonStyles = {
  primary: "bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-lg shadow-violet-900/30 hover:from-violet-500 hover:to-blue-500",
  secondary: "border border-white/15 bg-white/5 text-slate-100 hover:bg-white/10",
  danger: "bg-rose-600/90 text-white hover:bg-rose-500",
  ghost: "text-slate-300 hover:bg-white/5 hover:text-white",
} as const;
export type ButtonVariant = keyof typeof buttonStyles;

export function buttonClass(variant: ButtonVariant = "primary", className?: string) {
  return cx(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
    buttonStyles[variant],
    className,
  );
}

export function Button({ variant = "primary", className, ...rest }: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button className={buttonClass(variant, className)} {...rest} />;
}

export function ButtonLink({ variant = "primary", className, ...rest }: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={buttonClass(variant, className)} {...rest} />;
}

const badgeTones = {
  violet: "bg-violet-500/15 text-violet-200 ring-violet-400/30",
  blue: "bg-blue-500/15 text-blue-200 ring-blue-400/30",
  green: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30",
  amber: "bg-amber-500/15 text-amber-200 ring-amber-400/30",
  red: "bg-rose-500/15 text-rose-200 ring-rose-400/30",
  gray: "bg-white/5 text-slate-300 ring-white/15",
} as const;
export type BadgeTone = keyof typeof badgeTones;

export function Badge({ tone = "gray", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", badgeTones[tone])}>
      {children}
    </span>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "default" | "alert" | "ok" }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={cx("mt-2 text-2xl font-semibold tabular-nums", tone === "alert" ? "text-rose-300" : tone === "ok" ? "text-emerald-300" : "text-white")}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </Card>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 p-6 text-center">
      <p className="font-medium text-slate-200">{title}</p>
      {children ? <div className="mt-1 text-sm text-slate-400">{children}</div> : null}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warning" | "error" | "success"; children: ReactNode }) {
  const styles = {
    info: "border-blue-400/30 bg-blue-500/10 text-blue-100",
    warning: "border-amber-400/30 bg-amber-500/10 text-amber-100",
    error: "border-rose-400/30 bg-rose-500/10 text-rose-100",
    success: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("rounded-xl border px-4 py-3 text-sm", styles[tone])}>
      {children}
    </div>
  );
}

export const inputClass =
  "block w-full min-h-11 rounded-xl border border-white/10 bg-ink-900/80 px-3 py-2 text-base text-slate-100 placeholder:text-slate-500 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 sm:text-sm";

export function Field({ label, name, hint, error, children }: { label: string; name: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-slate-200">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${name}-error`} className="text-xs text-rose-300">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function formatMoney(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(cents / 100);
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)) + " UTC";
}
