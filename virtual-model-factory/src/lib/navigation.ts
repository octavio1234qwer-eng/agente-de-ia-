/**
 * Secciones del panel. `phase` indica en qué fase del roadmap se construye; las
 * secciones aún no construidas se muestran deshabilitadas (sin enlaces vacíos).
 */
export type NavItem = { href: string; label: string; icon: string; phase: number; ready: boolean };

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "◈", phase: 2, ready: true },
  { href: "/models", label: "Modelos virtuales", icon: "✦", phase: 2, ready: true },
  { href: "/studio", label: "Estudio creativo", icon: "✎", phase: 3, ready: false },
  { href: "/library", label: "Biblioteca", icon: "▤", phase: 3, ready: false },
  { href: "/calendar", label: "Calendario", icon: "▦", phase: 5, ready: false },
  { href: "/social", label: "Redes sociales", icon: "⌁", phase: 5, ready: false },
  { href: "/conversations", label: "Conversaciones", icon: "✉", phase: 7, ready: false },
  { href: "/revenue", label: "Monetización", icon: "$", phase: 6, ready: false },
  { href: "/analytics", label: "Analíticas", icon: "↗", phase: 6, ready: false },
  { href: "/automations", label: "Automatizaciones", icon: "⟳", phase: 7, ready: false },
  { href: "/security", label: "Seguridad", icon: "⛨", phase: 1, ready: true },
  { href: "/settings", label: "Configuración", icon: "⚙", phase: 2, ready: true },
];
