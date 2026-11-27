"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/navigation";
import { cx } from "@/components/ui";

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const content = (
          <>
            <span aria-hidden className="w-5 text-center text-base">{item.icon}</span>
            <span className="flex-1 truncate">{item.label}</span>
            {!item.ready ? <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-500">Fase {item.phase}</span> : null}
          </>
        );
        return (
          <li key={item.href}>
            {item.ready ? (
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition",
                  active ? "bg-gradient-to-r from-violet-600/30 to-blue-600/20 text-white ring-1 ring-violet-400/30" : "text-slate-300 hover:bg-white/5 hover:text-white",
                )}
              >
                {content}
              </Link>
            ) : (
              <span
                aria-disabled="true"
                title={`Disponible en la fase ${item.phase} del roadmap`}
                className="flex min-h-11 cursor-not-allowed items-center gap-3 rounded-xl px-3 text-sm text-slate-600"
              >
                {content}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
