import nodemailer from 'nodemailer';
import { t } from '../i18n.js';

const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function createMailer(mailConfig, { logger, isProduction }) {
  const transport = mailConfig.enabled
    ? nodemailer.createTransport({
      host: mailConfig.host,
      port: mailConfig.port,
      secure: mailConfig.secure,
      auth: mailConfig.user ? { user: mailConfig.user, pass: mailConfig.pass } : undefined,
    })
    : null;

  return {
    enabled: Boolean(transport),
    async send({ to, subject, text, html }) {
      if (!transport) {
        // En desarrollo se imprime el correo (con sus enlaces) para poder probar los flujos sin SMTP.
        if (isProduction) logger.warn('correo no enviado: SMTP sin configurar', { subject });
        else logger.info('correo (modo desarrollo, no enviado)', { to, subject, text });
        return false;
      }
      await transport.sendMail({ from: mailConfig.from, to, subject, text, html });
      return true;
    },
  };
}

function layout(appName, locale, title, paragraphs, action) {
  const text = [title, '', ...paragraphs, '', action ? `${action.label}: ${action.url}` : '', '', `— ${appName}`].join('\n');
  const html = `<!doctype html><html lang="${locale}"><body style="font-family:Arial,sans-serif;color:#1c1917;line-height:1.5">
<h2 style="color:#0f5e57">${escapeHtml(title)}</h2>
${paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n')}
${action ? `<p><a href="${escapeHtml(action.url)}" style="background:#0f766e;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">${escapeHtml(action.label)}</a></p><p style="font-size:12px;color:#57534e">${escapeHtml(t(locale, 'mail.button_fallback'))} ${escapeHtml(action.url)}</p>` : ''}
<p style="font-size:12px;color:#57534e">— ${escapeHtml(appName)}</p></body></html>`;
  return { text, html };
}

/** Construye un correo traducido: `kind` es verify | reset | changed | failed. */
function build(kind, { appName, locale, name, url }) {
  const key = (part) => `mail.${kind}.${part}`;
  return {
    subject: t(locale, key('subject'), { app: appName }),
    ...layout(appName, locale, t(locale, 'mail.hello', { name }), [t(locale, key('p1')), t(locale, key('p2'))],
      url ? { label: t(locale, key('action')), url } : null),
  };
}

export const emails = {
  verifyEmail: (opts) => build('verify', opts),
  resetPassword: (opts) => build('reset', opts),
  passwordChanged: (opts) => build('changed', opts),
  paymentFailed: (opts) => build('failed', opts),
};
