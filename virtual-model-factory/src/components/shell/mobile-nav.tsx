"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { NavLinks } from "./nav-links";

export function MobileNav({ footer }: { footer: ReactNode }) {
  const [open, setOpen] = useState(false);
  // Cerrar el menú al cambiar de ruta (patrón de estado derivado, sin efecto).
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        className="inline-flex size-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 lg:hidden"
      >
        <span className="sr-only">Abrir menú</span>
        <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
        </svg>
      </button>
      {/* Portal: el header usa backdrop-blur, que confinaría un elemento fixed a su caja. */}
      {open ? createPortal(
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú de navegación">
          <button type="button" aria-label="Cerrar menú" className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <nav id="mobile-menu" className="absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col border-r border-white/10 bg-ink-900 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-semibold text-white">Menú</span>
              <button type="button" onClick={() => setOpen(false)} className="inline-flex size-11 items-center justify-center rounded-xl text-slate-300 hover:bg-white/5">
                <span className="sr-only">Cerrar</span>✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
            <div className="border-t border-white/10 pt-4">{footer}</div>
          </nav>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
