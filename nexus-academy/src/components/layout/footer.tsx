import Link from "next/link";
import { Logo } from "./logo";
import { NewsletterForm } from "./newsletter-form";

const columns = [
  {
    title: "Aprender",
    links: [
      { href: "/cursos", label: "Catálogo de cursos" },
      { href: "/cursos?precio=gratis", label: "Cursos gratuitos" },
      { href: "/paquetes", label: "Paquetes" },
      { href: "/instructores", label: "Instructores" },
      { href: "/nexus-ai", label: "NEXUS AI" },
    ],
  },
  {
    title: "Cuenta",
    links: [
      { href: "/registro", label: "Crear cuenta" },
      { href: "/login", label: "Iniciar sesión" },
      { href: "/cuenta/cursos", label: "Mis cursos" },
      { href: "/verificar", label: "Verificar certificado" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terminos", label: "Términos y condiciones" },
      { href: "/privacidad", label: "Aviso de privacidad" },
      { href: "/reembolsos", label: "Política de reembolsos" },
      { href: "/#faq", label: "Preguntas frecuentes" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative mt-24 border-t border-white/[0.06] bg-ink-950">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-electric-500/40 to-transparent" />
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.3fr_2fr] lg:px-8">
        <div className="space-y-5">
          <Logo />
          <p className="max-w-sm text-sm leading-relaxed text-mist-400">
            Aprende hoy. Domina el mañana. Cursos prácticos, aula virtual inteligente y certificados verificables.
          </p>
          <NewsletterForm />
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {columns.map((col) => (
            <div key={col.title}>
              <h2 className="text-sm font-semibold text-white">{col.title}</h2>
              <ul className="mt-4 space-y-3">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-mist-400 transition hover:text-white">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-mist-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} NEXUS ACADEMY. Todos los derechos reservados.</p>
          <p>Pagos seguros con Stripe, Mercado Pago y PayPal. Nunca almacenamos datos de tarjetas.</p>
        </div>
      </div>
    </footer>
  );
}
