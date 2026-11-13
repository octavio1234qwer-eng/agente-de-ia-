import nodemailer from 'nodemailer';

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

function layout(appName, title, paragraphs, action) {
  const text = [title, '', ...paragraphs, '', action ? `${action.label}: ${action.url}` : '', '', `— ${appName}`].join('\n');
  const html = `<!doctype html><html lang="es"><body style="font-family:Arial,sans-serif;color:#1c1917;line-height:1.5">
<h2 style="color:#0f5e57">${escapeHtml(title)}</h2>
${paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n')}
${action ? `<p><a href="${escapeHtml(action.url)}" style="background:#0f766e;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">${escapeHtml(action.label)}</a></p><p style="font-size:12px;color:#57534e">Si el botón no funciona, copia esta dirección: ${escapeHtml(action.url)}</p>` : ''}
<p style="font-size:12px;color:#57534e">— ${escapeHtml(appName)}</p></body></html>`;
  return { text, html };
}

export const emails = {
  verifyEmail: (appName, name, url) => ({
    subject: `Confirma tu correo en ${appName}`,
    ...layout(appName, `Hola, ${name}`, [
      'Gracias por crear tu cuenta. Confirma tu correo para empezar a usar las herramientas.',
      'El enlace vence en 48 horas. Si no creaste esta cuenta, ignora este mensaje.',
    ], { label: 'Confirmar correo', url }),
  }),
  resetPassword: (appName, name, url) => ({
    subject: `Restablece tu contraseña de ${appName}`,
    ...layout(appName, `Hola, ${name}`, [
      'Recibimos una solicitud para restablecer tu contraseña. El enlace vence en 1 hora y solo funciona una vez.',
      'Si no la solicitaste, ignora este mensaje: tu contraseña no cambiará.',
    ], { label: 'Crear nueva contraseña', url }),
  }),
  passwordChanged: (appName, name) => ({
    subject: `Tu contraseña de ${appName} cambió`,
    ...layout(appName, `Hola, ${name}`, [
      'La contraseña de tu cuenta se cambió y cerramos las demás sesiones abiertas.',
      'Si no fuiste tú, restablece tu contraseña de inmediato y escríbenos.',
    ]),
  }),
  paymentFailed: (appName, name, url) => ({
    subject: `No pudimos cobrar tu suscripción de ${appName}`,
    ...layout(appName, `Hola, ${name}`, [
      'Tu banco rechazó el último cobro de tu suscripción. Reintentaremos automáticamente en los próximos días.',
      'Para evitar que tu plan regrese a Gratis, actualiza tu método de pago.',
    ], { label: 'Actualizar método de pago', url }),
  }),
};
