"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Award, BookOpen, Heart, LayoutDashboard, LogOut, Receipt, Settings, User } from "lucide-react";
import { signOutAction } from "@/lib/actions/auth";
import { Avatar } from "@/components/ui/avatar";

export function UserMenu({ name, email, avatarUrl, isAdmin }: { name: string; email: string; avatarUrl: string | null; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, []);

  const items = [
    ...(isAdmin ? [{ href: "/admin", label: "Panel de administración", icon: LayoutDashboard }] : []),
    { href: "/cuenta/cursos", label: "Mis cursos", icon: BookOpen },
    { href: "/cuenta", label: "Mi perfil", icon: User },
    { href: "/cuenta/favoritos", label: "Favoritos", icon: Heart },
    { href: "/cuenta/certificados", label: "Certificados", icon: Award },
    { href: "/cuenta/compras", label: "Compras", icon: Receipt },
    { href: "/cuenta/ajustes", label: "Configuración", icon: Settings },
  ];

  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl p-1 pr-2 transition hover:bg-white/[0.06]"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar name={name} url={avatarUrl} size={32} />
        <span className="max-w-32 truncate text-sm text-mist-200">{name}</span>
      </button>
      {open && (
        <div role="menu" className="glass-strong absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl p-1.5 shadow-2xl animate-fade-up">
          <div className="border-b border-white/[0.06] px-3 py-3">
            <p className="truncate text-sm font-medium text-white">{name}</p>
            <p className="truncate text-xs text-mist-400">{email}</p>
          </div>
          <div className="py-1">
            {items.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-mist-200 hover:bg-white/[0.06] hover:text-white">
                <Icon className="size-4 text-mist-400" aria-hidden />
                {label}
              </Link>
            ))}
          </div>
          <form action={signOutAction} className="border-t border-white/[0.06] pt-1">
            <button type="submit" role="menuitem" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-mist-200 hover:bg-white/[0.06] hover:text-white">
              <LogOut className="size-4 text-mist-400" aria-hidden />
              Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
