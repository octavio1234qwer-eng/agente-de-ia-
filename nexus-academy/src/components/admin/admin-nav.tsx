"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, FolderTree, GraduationCap, LayoutDashboard, Layers, Mail, MessageSquare, Receipt, Ticket, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/cursos", label: "Cursos", icon: BookOpen },
  { href: "/admin/categorias", label: "Categorías", icon: FolderTree },
  { href: "/admin/instructores", label: "Instructores", icon: GraduationCap },
  { href: "/admin/paquetes", label: "Paquetes", icon: Layers },
  { href: "/admin/alumnos", label: "Alumnos", icon: Users },
  { href: "/admin/pedidos", label: "Pedidos", icon: Receipt },
  { href: "/admin/cupones", label: "Cupones", icon: Ticket },
  { href: "/admin/resenas", label: "Reseñas", icon: MessageSquare },
  { href: "/admin/correos", label: "Correos", icon: Mail },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Administración" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex gap-1.5 lg:flex-col">
        {items.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm transition", active ? "bg-electric-500/15 text-white ring-1 ring-electric-400/30" : "text-mist-300 hover:bg-white/[0.04] hover:text-white")}
              >
                <Icon className="size-4" aria-hidden /> {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
