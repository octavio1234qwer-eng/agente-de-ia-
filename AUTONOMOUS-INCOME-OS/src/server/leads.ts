import { z } from "zod";
import { audit } from "./audit.ts";
import { randomToken, sha256 } from "./crypto.ts";
import type { Db } from "./db/types.ts";
import { appUrl } from "./env.ts";
import { emailConfigured, sendEmail } from "./notifications.ts";

export const CONSENT_TEXT =
  "Acepto recibir por correo guías y novedades de CotizaFácil MX (máximo 1 correo por semana). Puedo darme de baja en cualquier momento con un clic.";

export const leadSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo inválido.").max(254),
  name: z.string().trim().max(80).optional(),
  source: z.string().trim().max(60).regex(/^[a-z0-9_-]*$/).default("web"),
  segment: z.string().trim().max(40).regex(/^[a-z0-9_-]*$/).optional(),
  consent: z.literal(true, { message: "Necesitamos tu consentimiento para escribirte." }),
});

/** Guarda un prospecto con consentimiento explícito y registro del texto aceptado. */
export async function captureLead(db: Db, businessId: string, raw: unknown): Promise<{ created: boolean }> {
  const input = leadSchema.parse(raw);
  const unsubscribeToken = randomToken(24);
  const { rows } = await db.query<{ inserted: boolean }>(
    `INSERT INTO leads (business_id, email, name, source, segment, consent, consent_text, consent_at, unsubscribe_token_hash, next_contact_at)
     VALUES ($1, $2, $3, $4, $5, true, $6, now(), $7, now())
     ON CONFLICT (business_id, (lower(email))) DO UPDATE SET
       status = CASE WHEN leads.status = 'unsubscribed' THEN 'new' ELSE leads.status END,
       consent_text = EXCLUDED.consent_text, consent_at = now(), updated_at = now()
     RETURNING (xmax = 0) AS inserted`,
    [businessId, input.email, input.name ?? null, input.source, input.segment ?? null, CONSENT_TEXT, sha256(unsubscribeToken)],
  );
  await db.tx((q) => audit(q, { actorType: "anonymous", action: "lead.captured", metadata: { source: input.source } }));
  return { created: !!rows[0]?.inserted };
}

export async function unsubscribe(db: Db, token: string): Promise<boolean> {
  if (!token || token.length > 100) return false;
  const r = await db.query("UPDATE leads SET status = 'unsubscribed', next_contact_at = NULL, updated_at = now() WHERE unsubscribe_token_hash = $1", [sha256(token)]);
  return r.rowCount > 0;
}

/** Secuencia de bienvenida (consentida). Cada paso: días de espera + asunto + texto. */
export const NURTURE_SEQUENCE = [
  {
    waitDays: 0,
    subject: "Tu guía: cómo hacer una cotización que sí cierre ventas",
    body: (url: string) => `Hola,

Gracias por suscribirte. Tres cosas que más ayudan a cerrar una cotización:

1. Vigencia clara (15 días es lo común): crea urgencia sin presionar.
2. Separa materiales y mano de obra: el cliente entiende qué paga.
3. Escribe las condiciones de pago (por ejemplo, 50 % de anticipo).

Haz tu siguiente cotización gratis en ${url}/app

CotizaFácil MX`,
  },
  {
    waitDays: 3,
    subject: "¿Cobras lo suficiente? Calcula tu margen en 1 minuto",
    body: (url: string) => `Hola,

Un error común: confundir margen con recargo. Si algo te cuesta $100 y quieres ganar 30 % de margen, el precio es $142.86, no $130.

En CotizaFácil puedes poner el costo interno de cada concepto y ver tu margen real antes de enviar la cotización (tu cliente nunca ve el costo).

${url}/app

CotizaFácil MX`,
  },
  {
    waitDays: 7,
    subject: "Tus cotizaciones con tu logo (opcional)",
    body: (url: string) => `Hola,

Si CotizaFácil te está sirviendo, la versión Pro agrega tu logo y tu color, quita la marca de CotizaFácil del PDF y te deja respaldar tus datos. Es un solo pago.

Detalles: ${url}/precios

Si no te interesa, no pasa nada: la versión gratis seguirá siendo gratis.

CotizaFácil MX`,
  },
];

/**
 * Envía el siguiente paso de la secuencia a prospectos con consentimiento.
 * Sin proveedor de correo no envía nada (y no avanza la secuencia).
 */
export async function runNurture(db: Db, limit = 20): Promise<{ sent: number; skipped: number; failed: number }> {
  const stats = { sent: 0, skipped: 0, failed: 0 };
  if (!emailConfigured()) return { ...stats, skipped: -1 };
  const { rows } = await db.query<{ id: string; email: string; sequence_step: number }>(
    `SELECT id, email, sequence_step FROM leads
     WHERE status IN ('new','nurturing') AND consent = true AND next_contact_at <= now() AND sequence_step < $1
     ORDER BY next_contact_at LIMIT $2`,
    [NURTURE_SEQUENCE.length, limit],
  );
  for (const lead of rows) {
    const step = NURTURE_SEQUENCE[lead.sequence_step]!;
    // Nuevo token de baja en cada correo (el hash anterior se reemplaza).
    const token = randomToken(24);
    await db.query("UPDATE leads SET unsubscribe_token_hash = $2 WHERE id = $1", [lead.id, sha256(token)]);
    const unsub = `${appUrl()}/baja?t=${token}`;
    const r = await sendEmail({ to: lead.email, subject: step.subject, text: `${step.body(appUrl())}\n\n—\nDarte de baja: ${unsub}` });
    if (!r.sent) {
      stats.failed++;
      continue;
    }
    stats.sent++;
    const next = NURTURE_SEQUENCE[lead.sequence_step + 1];
    await db.query(
      `UPDATE leads SET status = 'nurturing', sequence_step = sequence_step + 1, updated_at = now(),
         next_contact_at = CASE WHEN $2::int IS NULL THEN NULL ELSE now() + make_interval(days => $2::int) END WHERE id = $1`,
      [lead.id, next ? next.waitDays - step.waitDays : null],
    );
  }
  return stats;
}
