import "server-only";

/**
 * Lectura centralizada de variables de entorno del servidor.
 * Las integraciones externas son opcionales: si faltan credenciales, la
 * función correspondiente queda desactivada y la interfaz lo comunica con
 * honestidad (nunca se simula un pago, un correo o una respuesta de IA).
 */

function read(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : undefined;
}

export function requireEnv(name: string): string {
  const value = read(name);
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}

export const siteUrl = (read("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000").replace(/\/$/, "");

export const integrations = {
  stripe: () => Boolean(read("STRIPE_SECRET_KEY") && read("STRIPE_WEBHOOK_SECRET")),
  mercadopago: () => Boolean(read("MERCADOPAGO_ACCESS_TOKEN") && read("MERCADOPAGO_WEBHOOK_SECRET")),
  paypal: () => Boolean(read("PAYPAL_CLIENT_ID") && read("PAYPAL_CLIENT_SECRET") && read("PAYPAL_WEBHOOK_ID")),
  email: () => Boolean(read("RESEND_API_KEY") && read("EMAIL_FROM")),
  ai: () => Boolean(read("ANTHROPIC_API_KEY")),
  serviceRole: () => Boolean(read("SUPABASE_SERVICE_ROLE_KEY")),
} as const;

export type PaymentProviderId = "stripe" | "mercadopago" | "paypal";

export function enabledPaymentProviders(): PaymentProviderId[] {
  return (["stripe", "mercadopago", "paypal"] as const).filter((p) => integrations[p]());
}

export const config = {
  get anthropicModel() {
    return read("ANTHROPIC_MODEL") ?? "claude-opus-5-5";
  },
  get aiDailyLimit() {
    const n = Number(read("AI_DAILY_MESSAGE_LIMIT") ?? 60);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 60;
  },
  get paypalBaseUrl() {
    return read("PAYPAL_ENV") === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  },
  get emailFrom() {
    return read("EMAIL_FROM");
  },
  get emailReplyTo() {
    return read("EMAIL_REPLY_TO");
  },
  get cronSecret() {
    return read("CRON_SECRET");
  },
  get unsubscribeSecret() {
    return read("UNSUBSCRIBE_SECRET") ?? read("SUPABASE_SERVICE_ROLE_KEY");
  },
};

export { read as readEnv };
