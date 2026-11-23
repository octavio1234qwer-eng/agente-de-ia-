"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileNav({ links, signedIn, isAdmin }: { links: { href: string; label: string }[]; signedIn: boolean; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    // Cierra el menú al cambiar de ruta (ajuste de estado durante el render).
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const all = [
    ...links,
    ...(signedIn
      ? [{ href: "/cuenta/cursos", label: "Mis cursos" }, { href: "/cuenta", label: "Mi cuenta" }, ...(isAdmin ? [{ href: "/admin", label: "Administración" }] : [])]
      : [{ href: "/login", label: "Iniciar sesión" }, { href: "/registro", label: "Crear cuenta gratis" }]),
  ];

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid size-11 place-items-center rounded-xl text-mist-200 hover:bg-white/[0.06]"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
      <div
        id="mobile-menu"
        className={cn(
          "fixed inset-x-0 top-16 bottom-0 z-40 bg-ink-950/95 backdrop-blur-xl transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <nav className="flex flex-col gap-1 p-4" aria-label="Menú móvil">
          {all.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-xl px-4 py-4 text-lg text-mist-100 transition hover:bg-white/[0.06]",
                pathname === l.href && "bg-white/[0.06] text-white",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
