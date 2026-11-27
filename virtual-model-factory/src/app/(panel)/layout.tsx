import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { MobileNav } from "@/components/shell/mobile-nav";
import { NavLinks } from "@/components/shell/nav-links";
import { Button } from "@/components/ui";
import { requireUser } from "@/server/auth/dal";
import { ROLE_LABELS } from "@/server/auth/permissions";
import { getDb } from "@/server/db";
import { withUserContext } from "@/server/db/context";
import { getSystemState } from "@/server/modules/system/settings";

export default async function PanelLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const [system, db] = await Promise.all([withUserContext(user.id, "panel", (tx) => getSystemState(tx)), getDb()]);

  const userBox = (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white">{user.displayName}</p>
        <p className="truncate text-xs text-slate-400">{ROLE_LABELS[user.role]}</p>
      </div>
      <form action={logoutAction}>
        <Button variant="ghost" type="submit" className="px-3">Salir</Button>
      </form>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-white/10 bg-ink-900/60 p-4 backdrop-blur lg:flex">
        <Link href="/" className="mb-6 flex items-center gap-3 px-2">
          <span className="inline-flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 font-bold text-white">V</span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold text-white">Virtual Model</span>
            <span className="block text-xs text-violet-300">Factory AI</span>
          </span>
        </Link>
        <nav aria-label="Principal" className="flex-1 overflow-y-auto">
          <NavLinks />
        </nav>
        <div className="border-t border-white/10 pt-4">{userBox}</div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-white/10 bg-ink-950/80 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur lg:hidden">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 text-sm font-bold text-white">V</span>
            <span className="text-sm font-semibold text-white">VMF AI</span>
          </Link>
          <MobileNav footer={userBox} />
        </header>

        {system.emergencyStop.active ? (
          <div role="alert" className="border-b border-rose-500/40 bg-rose-600/20 px-4 py-2 text-center text-sm text-rose-100">
            Parada de emergencia activa: todas las automatizaciones están detenidas. {system.emergencyStop.reason ? `Motivo: ${system.emergencyStop.reason}` : ""}
          </div>
        ) : system.operationsPaused.active ? (
          <div role="status" className="border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-100">
            Operaciones en pausa. {system.operationsPaused.reason ?? ""}
          </div>
        ) : null}
        {db.kind === "pglite" ? (
          <div className="border-b border-white/5 bg-white/[0.02] px-4 py-1.5 text-center text-xs text-slate-500">
            Base de datos local embebida (PGlite) — modo desarrollo. Configura DATABASE_URL para usar Supabase.
          </div>
        ) : null}

        <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
