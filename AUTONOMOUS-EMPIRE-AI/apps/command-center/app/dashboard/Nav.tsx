"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const SECTIONS: [string, string][] = [
  ["/dashboard", "Dashboard ejecutivo"], ["/dashboard/businesses", "Negocios"], ["/dashboard/agents", "Agentes"],
  ["/dashboard/tasks", "Tareas"], ["/dashboard/leads", "Clientes potenciales"], ["/dashboard/products", "Productos"],
  ["/dashboard/content", "Publicaciones"], ["/dashboard/finance", "Ventas e ingresos"], ["/dashboard/finance#gastos", "Gastos"],
  ["/dashboard/finance#rentabilidad", "Rentabilidad"], ["/dashboard/affiliates", "Afiliados"], ["/dashboard/automations", "Automatizaciones"],
  ["/dashboard/alerts", "Alertas"], ["/dashboard/decisions", "Decisiones y autorizaciones"], ["/dashboard/settings", "Configuración"],
  ["/dashboard/security", "Seguridad"],
];

export function Nav() {
  const p = usePathname();
  return (
    <nav className="nav">
      {SECTIONS.map(([href, label]) => (
        <Link key={href} href={href} className={p === href.split("#")[0] && !href.includes("#") ? "active" : ""}>{label}</Link>
      ))}
    </nav>
  );
}
