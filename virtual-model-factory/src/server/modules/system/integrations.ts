import { getEnv } from "../../config/env";

export type IntegrationStatus = { name: string; state: "configured" | "missing" | "blocked" | "planned"; label: string };

/**
 * Estado declarado de cada integración según la configuración del servidor.
 * "Configurado" significa que existen las credenciales, no que la conexión se haya probado.
 */
export function getIntegrationStatus(): IntegrationStatus[] {
  const env = getEnv();
  return [
    { name: "Base de datos", state: "configured", label: env.DATABASE_URL ? "PostgreSQL" : "PGlite local" },
    { name: "Cifrado de secretos", state: env.ENCRYPTION_KEY ? "configured" : "missing", label: env.ENCRYPTION_KEY ? "Configurado" : "Sin clave" },
    { name: "Telegram (bot admin)", state: env.TELEGRAM_BOT_TOKEN ? "configured" : "planned", label: env.TELEGRAM_BOT_TOKEN ? "Credenciales" : "Fase 4" },
    { name: "Instagram / Facebook", state: "planned", label: "Fase 5" },
    { name: "TikTok", state: "planned", label: "Fase 5" },
    { name: "OnlyFans", state: "blocked", label: "Desactivado" },
    { name: "Pagos", state: "planned", label: "Fase 6" },
  ];
}
