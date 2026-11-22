import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({ icon, title, description, action, className }: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("glass flex flex-col items-center rounded-2xl px-6 py-14 text-center", className)}>
      {icon && <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-white/[0.05] text-electric-300">{icon}</div>}
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm text-mist-300">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
