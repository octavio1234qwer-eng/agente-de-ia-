/**
 * Envío de correos comerciales (NIVEL AMARILLO). Reglas:
 *  - Solo correos del outbox en estado 'approved' (aprobados por un humano).
 *  - Solo a leads con consentimiento de contacto.
 *  - Tope diario EMAIL_DAILY_CAP. Sin SMTP configurado no se envía nada.
 */
import type { Db } from "../../core/db";
import { appendAudit } from "../../core/audit-log";

export const smtpConfigured = () => !!(process.env.MAIL_HOST && process.env.MAIL_USER && process.env.MAIL_PASS && process.env.MAIL_FROM);

export async function sendApprovedEmails(db: Db, send?: (m: { to: string; subject: string; text: string }) => Promise<void>) {
  if (!send) {
    if (!smtpConfigured()) return { sent: 0, skipped: "SMTP no configurado" };
    const nodemailer = await import("nodemailer");
    const t = nodemailer.createTransport({ host: process.env.MAIL_HOST, port: Number(process.env.MAIL_PORT ?? 587), secure: process.env.MAIL_SECURE === "true", auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS } });
    send = async (m) => { await t.sendMail({ from: process.env.MAIL_FROM, to: m.to, subject: m.subject, text: m.text }); };
  }
  const cap = Number(process.env.EMAIL_DAILY_CAP ?? 20);
  const today = await db.query<{ n: string }>("select count(*) n from email_outbox where status='sent' and sent_at > now() - interval '24 hours'");
  let budget = cap - Number(today.rows[0]?.n ?? 0);
  const rows = await db.query<{ id: string; to_email: string; subject: string; body: string; consent: boolean | null }>(
    `select o.id, o.to_email, o.subject, o.body, l.consent_contact consent from email_outbox o left join leads l on l.id=o.lead_id
     where o.status='approved' order by o.created_at limit 100`);
  let sent = 0;
  for (const m of rows.rows) {
    if (!m.consent) { await db.query("update email_outbox set status='blocked', error='sin consentimiento' where id=$1", [m.id]); continue; }
    if (budget <= 0) break;
    try {
      await send({ to: m.to_email, subject: m.subject, text: m.body });
      await db.query("update email_outbox set status='sent', sent_at=now() where id=$1", [m.id]);
      sent++; budget--;
      await db.transaction((tx) => appendAudit(tx, { actor: "system:email", action: "email.send_commercial", level: "yellow", target: m.id, result: "sent" }));
    } catch (e) {
      await db.query("update email_outbox set status='failed', error=$2 where id=$1", [m.id, e instanceof Error ? e.message.slice(0, 300) : "error"]);
    }
  }
  return { sent, remainingToday: budget };
}
