import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "@/components/admin/admin-nav";
import { Logo } from "@/components/layout/logo";
import { Avatar } from "@/components/ui/avatar";
import { integrations } from "@/lib/env";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: { default: "Administración", template: `%s · Admin ${BRAND.name}` }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const status = [
    { label: "Stripe", ok: integrations.stripe() },
    { label: "Mercado Pago", ok: integrations.mercadopago() },
    { label: "PayPal", ok: integrations.paypal() },
    { label: "Correo (Resend)", ok: integrations.email() },
    { label: BRAND.aiName, ok: integrations.ai() },
  ];
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1500px] items-center gap-4 px-4 sm:px-6">
          <Logo />
          <span className="rounded-md bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-200">Admin</span>
          <Link href="/" className="ml-auto text-sm text-mist-400 hover:text-white">Ver sitio</Link>
          <Avatar name={admin.full_name || admin.email} url={admin.avatar_url} size={30} />
        </div>
      </header>
      <div className="mx-auto grid max-w-[1500px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-6 lg:sticky lg:top-20 lg:h-fit">
          <AdminNav />
          <div className="hidden rounded-2xl border border-white/[0.06] p-4 lg:block">
            <p className="text-xs font-semibold uppercase tracking-wider text-mist-400">Integraciones</p>
            <ul className="mt-3 space-y-2 text-xs">
              {status.map((s) => (
                <li key={s.label} className="flex items-center justify-between gap-2 text-mist-300">
                  {s.label}
                  <span className={s.ok ? "text-emerald-300" : "text-amber-300"}>{s.ok ? "● Activa" : "○ Sin configurar"}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
