import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AdminHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
        {description && <p className="mt-1 text-sm text-mist-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, subtitle, children, className, actions }: { title?: string; subtitle?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={cn("glass rounded-2xl p-5", className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="font-semibold text-white">{title}</h2>}
            {subtitle && <p className="text-xs text-mist-400">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-mist-400">
          <tr>{head.map((h, i) => <th key={i} scope="col" className="px-4 py-3 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05] text-mist-200">{children}</tbody>
      </table>
      {empty && <p className="px-4 py-8 text-center text-sm text-mist-400">{empty}</p>}
    </div>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>;
}
