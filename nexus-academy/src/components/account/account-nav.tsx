"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, BookOpen, Heart, Receipt, Search, Settings, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/cuenta/cursos", label: "Mis cursos", icon: BookOpen },
  { href: "/cuenta/buscar", label: "Buscar en mis cursos", icon: Search },
  { href: "/cuenta", label: "Perfil", icon: User },
  { href: "/cuenta/favoritos", label: "Favoritos", icon: Heart },
  { href: "/cuenta/certificados", label: "Certificados", icon: Award },
  { href: "/cuenta/compras", label: "Compras", icon: Receipt },
  { href: "/cuenta/ajustes", label: "Configuración", icon: Settings },
];

export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Mi cuenta" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex gap-2 lg:flex-col">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-xl px-4 text-sm transition",
                  active ? "bg-white/[0.07] text-white ring-1 ring-white/10" : "text-mist-300 hover:bg-white/[0.04] hover:text-white",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
