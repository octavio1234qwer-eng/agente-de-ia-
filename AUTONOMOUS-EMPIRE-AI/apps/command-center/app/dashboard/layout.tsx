import { requireUser } from "@/lib/server";
import { logoutAction } from "../login/actions";
import { Nav } from "./Nav";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="dot" /> EMPIRE · COMMAND</div>
        <Nav />
      </aside>
      <main className="main">
        <div className="topbar">
          <span className="muted" style={{ fontSize: ".85rem" }}>{u.name || u.email} · <span className="badge info">{u.role}</span></span>
          <form action={logoutAction} className="inline"><button className="btn ghost">Salir</button></form>
        </div>
        {children}
      </main>
    </div>
  );
}
