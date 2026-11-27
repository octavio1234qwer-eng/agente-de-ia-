import { z } from "zod";

/**
 * Variables de entorno del servidor. Se validan de forma perezosa (en el primer
 * uso) para que `next build` no exija secretos que solo se necesitan en tiempo
 * de ejecución. Nunca importar este módulo desde componentes de cliente.
 */

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalString = z.preprocess(emptyToUndefined, z.string().optional());
const bool = (fallback: boolean) =>
  z.preprocess(
    emptyToUndefined,
    z
      .enum(["true", "false", "1", "0"])
      .optional()
      .transform((v) => (v === undefined ? fallback : v === "true" || v === "1")),
  );

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Base de datos: DATABASE_URL => PostgreSQL (Supabase). Sin ella => PGlite embebido.
  DATABASE_URL: z.preprocess(emptyToUndefined, z.string().startsWith("postgres").optional()),
  DATABASE_SSL_MODE: z.preprocess(emptyToUndefined, z.enum(["disable", "require", "verify-full"]).optional()),
  DATABASE_SSL_CA: optionalString,
  DATABASE_POOL_MAX: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(50).default(5)),
  DB_AUTO_MIGRATE: bool(false),
  PGLITE_DATA_DIR: z.preprocess(emptyToUndefined, z.string().default(".data/pglite")),
  ALLOW_EMBEDDED_DB_IN_PRODUCTION: bool(false),

  // Sesiones y seguridad
  SESSION_TTL_HOURS: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(720).default(168)),
  SESSION_IDLE_HOURS: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(168).default(12)),
  ENCRYPTION_KEY: optionalString,
  SETUP_TOKEN: z.preprocess(emptyToUndefined, z.string().min(24).optional()),
  TRUST_PROXY_HEADERS: bool(false),
  SECURE_COOKIES: z.preprocess(
    emptyToUndefined,
    z.enum(["true", "false", "auto"]).default("auto"),
  ),

  // Integraciones (se validan en cada adaptador cuando se usen)
  TELEGRAM_BOT_TOKEN: optionalString,
  TELEGRAM_WEBHOOK_SECRET: optionalString,
  TELEGRAM_ADMIN_CHAT_IDS: optionalString,
  CRON_SECRET: optionalString,
});

export type ServerEnv = z.infer<typeof envSchema>;

let cached: ServerEnv | undefined;

export function getEnv(): ServerEnv {
  if (!cached) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`Configuración de entorno inválida: ${issues}`);
    }
    cached = parsed.data;
  }
  return cached;
}

/** Solo para pruebas: fuerza a releer process.env. */
export function resetEnvCache(): void {
  cached = undefined;
}

export function shouldUseSecureCookies(env: ServerEnv = getEnv()): boolean {
  if (env.SECURE_COOKIES === "auto") return env.NODE_ENV === "production";
  return env.SECURE_COOKIES === "true";
}
