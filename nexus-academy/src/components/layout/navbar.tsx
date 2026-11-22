import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getCartCount } from "@/lib/data/user";
import { LinkButton } from "@/components/ui/button";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";
import { UserMenu } from "./user-menu";

export const navLinks = [
  { href: "/cursos", label: "Cursos" },
  { href: "/paquetes", label: "Paquetes" },
  { href: "/instructores", label: "Instructores" },
  { href: "/nexus-ai", label: "NEXUS AI" },
];

export async function Navbar() {
  const user = await getCurrentUser();
  const cartCount = await getCartCount(user?.id ?? null);
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-ink-950/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Principal">
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm text-mist-300 transition hover:bg-white/[0.05] hover:text-white">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user && (
            <Link href="/carrito" className="relative grid size-10 place-items-center rounded-xl text-mist-300 transition hover:bg-white/[0.06] hover:text-white" aria-label={`Carrito (${cartCount})`}>
              <ShoppingCart className="size-5" />
              {cartCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-gradient-to-r from-electric-500 to-violet-500 px-1 text-[11px] font-semibold text-white">
                  {cartCount}
                </span>
              )}
            </Link>
          )}
          {user ? (
            <UserMenu name={user.full_name || user.email} email={user.email} avatarUrl={user.avatar_url} isAdmin={user.role === "admin"} />
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <LinkButton href="/login" variant="ghost" size="sm">Iniciar sesión</LinkButton>
              <LinkButton href="/registro" size="sm">Comenzar ahora</LinkButton>
            </div>
          )}
          <MobileNav links={navLinks} signedIn={Boolean(user)} isAdmin={user?.role === "admin"} />
        </div>
      </div>
    </header>
  );
}
