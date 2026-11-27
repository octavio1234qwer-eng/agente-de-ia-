import "server-only";

/** Configuración leída del entorno. Nunca devuelve valores secretos al cliente. */
export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export interface IntegrationStatus {
  key: string;
  name: string;
  configured: boolean;
  required: boolean;
  missing: string[];
  note: string;
}

function check(vars: string[]): string[] {
  return vars.filter((v) => !process.env[v]);
}

/** Estado de integraciones para el panel (solo nombres de variables, nunca valores). */
export function integrationStatus(): IntegrationStatus[] {
  const items: Omit<IntegrationStatus, "configured" | "missing">[] & { vars: string[] }[] = [
    { key: "database", name: "PostgreSQL", required: true, vars: ["DATABASE_URL"], note: "Neon Free recomendado. Sin esto, en producción no arranca." },
    { key: "security", name: "Llaves de la app", required: true, vars: ["APP_URL", "APP_ENCRYPTION_KEY", "APP_HASH_SALT", "LICENSE_SECRET"], note: "Generar con `npm run admin:setup-token`." },
    { key: "cron", name: "Programador (GitHub Actions)", required: true, vars: ["CRON_SECRET"], note: "El mismo valor va en los secretos del repositorio." },
    { key: "mercadopago", name: "Mercado Pago", required: true, vars: ["MP_ACCESS_TOKEN", "MP_WEBHOOK_SECRET"], note: "Sin esto, los botones de compra muestran 'próximamente'." },
    { key: "email", name: "Correo (Resend)", required: false, vars: ["RESEND_API_KEY", "EMAIL_FROM"], note: "Sin correo, el acceso se muestra en la página de confirmación." },
    { key: "telegram", name: "Alertas por Telegram", required: false, vars: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"], note: "Alertas push gratis al teléfono." },
    { key: "llm", name: "Modelo de IA", required: false, vars: ["LLM_PROVIDER"], note: "Opcional. Con presupuesto 0 solo se permiten proveedores gratuitos." },
  ];
  return items.map(({ vars, ...rest }) => {
    const missing = check(vars);
    return { ...rest, configured: missing.length === 0, missing };
  });
}

export function paymentsConfigured(): boolean {
  return !!process.env.MP_ACCESS_TOKEN && !!process.env.MP_WEBHOOK_SECRET;
}

/** Pagos con live_mode=false (credenciales de prueba) solo se entregan si se permite explícitamente. */
export function allowTestPayments(): boolean {
  if (process.env.PAYMENTS_ALLOW_TEST) return process.env.PAYMENTS_ALLOW_TEST === "true";
  return !isProduction();
}

/** Reserva estimada de impuestos en puntos base (por defecto IVA contenido: 16/116 ≈ 13.79 %). */
export function taxReserveBp(): number {
  const v = Number(process.env.TAX_RESERVE_BP ?? 1379);
  return Number.isFinite(v) && v >= 0 && v <= 5000 ? Math.round(v) : 1379;
}
