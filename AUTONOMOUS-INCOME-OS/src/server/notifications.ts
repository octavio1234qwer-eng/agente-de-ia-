import type { Db, Queryable } from "./db/types.ts";

export type NotifySeverity = "info" | "warning" | "critical";

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

function telegramConfigured(): boolean {
  return !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_CHAT_ID;
}

/**
 * Aviso al administrador: siempre en el panel y, si están configurados,
 * por Telegram y correo (los envía el despachador con reintentos limitados).
 */
export async function notifyAdmin(
  q: Queryable,
  n: { subject: string; body: string; severity?: NotifySeverity; dedupeKey?: string; relatedType?: string; relatedId?: string },
): Promise<void> {
  const severity = n.severity ?? "info";
  const channels: ("dashboard" | "telegram" | "email")[] = ["dashboard"];
  if (telegramConfigured() && severity !== "info") channels.push("telegram");
  if (emailConfigured() && process.env.ADMIN_EMAIL && severity === "critical") channels.push("email");
  for (const channel of channels) {
    await q.query(
      `INSERT INTO notifications (channel, audience, recipient, subject, body, severity, status, dedupe_key, related_type, related_id)
       VALUES ($1, 'admin', $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (dedupe_key) DO NOTHING`,
      [channel, channel === "email" ? process.env.ADMIN_EMAIL : null, n.subject.slice(0, 200), n.body.slice(0, 4000), severity,
       channel === "dashboard" ? "sent" : "pending", n.dedupeKey ? `${n.dedupeKey}:${channel}` : null, n.relatedType ?? null, n.relatedId ?? null],
    );
  }
}

export interface SendResult {
  sent: boolean;
  skipped?: boolean;
  error?: string;
}

/** Envía un correo con Resend (HTTP). Sin configuración devuelve skipped: nunca finge un envío. */
export async function sendEmail(msg: { to: string; subject: string; text: string; html?: string }): Promise<SendResult> {
  if (!emailConfigured()) return { sent: false, skipped: true };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { sent: false, error: `Resend HTTP ${res.status}` };
    return { sent: true };
  } catch (err) {
    return { sent: false, error: (err as Error).message };
  }
}

async function sendTelegram(text: string): Promise<SendResult> {
  if (!telegramConfigured()) return { sent: false, skipped: true };
  try {
    const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: text.slice(0, 4000), disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok ? { sent: true } : { sent: false, error: `Telegram HTTP ${res.status}` };
  } catch (err) {
    return { sent: false, error: (err as Error).message };
  }
}

/** Despacha notificaciones pendientes (máximo 5 intentos por notificación). */
export async function dispatchNotifications(db: Db, limit = 25): Promise<{ sent: number; failed: number; skipped: number }> {
  const { rows } = await db.query<{ id: string; channel: string; recipient: string | null; subject: string; body: string; severity: string; attempts: number }>(
    `SELECT id, channel, recipient, subject, body, severity, attempts FROM notifications
     WHERE status = 'pending' AND channel IN ('email','telegram') ORDER BY created_at LIMIT $1`,
    [limit],
  );
  const stats = { sent: 0, failed: 0, skipped: 0 };
  for (const n of rows) {
    const prefix = n.severity === "critical" ? "🚨 " : n.severity === "warning" ? "⚠️ " : "";
    const r = n.channel === "telegram"
      ? await sendTelegram(`${prefix}${n.subject}\n\n${n.body}`)
      : await sendEmail({ to: n.recipient ?? "", subject: `${prefix}${n.subject}`, text: n.body });
    const attempts = n.attempts + 1;
    const status = r.sent ? "sent" : r.skipped ? "skipped" : attempts >= 5 ? "failed" : "pending";
    stats[r.sent ? "sent" : r.skipped ? "skipped" : "failed"]++;
    await db.query(
      "UPDATE notifications SET status = $2, attempts = $3, last_error = $4, sent_at = CASE WHEN $2 = 'sent' THEN now() ELSE sent_at END WHERE id = $1",
      [n.id, status, attempts, r.error ?? null],
    );
  }
  return stats;
}
