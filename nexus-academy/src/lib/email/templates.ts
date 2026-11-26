import { escapeHtml, formatMoney, formatDate } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

/**
 * Plantillas HTML de correo. Estilos en línea (los clientes de correo no
 * soportan hojas de estilo) con la identidad oscura de NEXUS ACADEMY.
 */

export type EmailContent = { subject: string; html: string; text: string };

type LayoutOptions = { preheader: string; body: string; unsubscribe?: string; siteUrl: string };

function layout({ preheader, body, unsubscribe, siteUrl }: LayoutOptions) {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${BRAND.name}</title></head>
<body style="margin:0;padding:0;background:#05060b;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#e5e7f0;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#05060b;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:0 8px 20px 8px;">
<a href="${siteUrl}" style="text-decoration:none;color:#fff;font-weight:700;letter-spacing:4px;font-size:14px;">
<span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);margin-right:8px;"></span>${BRAND.name}</a>
</td></tr>
<tr><td style="background:#0b0e1a;border:1px solid #1d2340;border-radius:20px;padding:32px 28px;">
${body}
</td></tr>
<tr><td style="padding:20px 8px;color:#6b7290;font-size:12px;line-height:18px;">
Recibes este correo por tu cuenta en ${BRAND.name}.${unsubscribe ? ` <a href="${unsubscribe}" style="color:#8b93b8;">Dejar de recibir estos correos</a>.` : ""}
</td></tr>
</table></td></tr></table></body></html>`;
}

const h1 = (t: string) => `<h1 style="margin:0 0 12px;font-size:24px;line-height:30px;color:#ffffff;">${escapeHtml(t)}</h1>`;
const p = (t: string) => `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#c3c8dc;">${t}</p>`;
const button = (label: string, href: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;"><tr><td style="border-radius:12px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);">
<a href="${href}" style="display:inline-block;padding:13px 22px;color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;">${escapeHtml(label)}</a></td></tr></table>`;

export function welcomeEmail(o: { name: string; siteUrl: string }): EmailContent {
  const name = o.name || "estudiante";
  return {
    subject: `Bienvenido a ${BRAND.name}`,
    html: layout({
      siteUrl: o.siteUrl,
      preheader: "Tu cuenta está lista. Empieza a aprender hoy.",
      body:
        h1(`Hola, ${name}`) +
        p(`Tu cuenta en <strong style="color:#fff">${BRAND.name}</strong> está lista. ${BRAND.tagline}`) +
        p(`Explora el catálogo, inscríbete a los cursos gratuitos y usa ${BRAND.aiName} para resolver dudas mientras estudias.`) +
        button("Explorar cursos", `${o.siteUrl}/cursos`),
    }),
    text: `Hola, ${name}. Tu cuenta en ${BRAND.name} está lista. Explora los cursos: ${o.siteUrl}/cursos`,
  };
}

export type OrderEmailLine = { title: string; totalCents: number };

export function purchaseEmail(o: {
  name: string;
  orderNumber: string;
  currency: string;
  lines: OrderEmailLine[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  paidAt: string;
  providerLabel: string;
  courses: { title: string; slug: string }[];
  siteUrl: string;
}): EmailContent {
  const rows = o.lines
    .map(
      (l) =>
        `<tr><td style="padding:8px 0;color:#e5e7f0;font-size:14px;">${escapeHtml(l.title)}</td><td align="right" style="padding:8px 0;color:#e5e7f0;font-size:14px;">${formatMoney(l.totalCents, o.currency)}</td></tr>`,
    )
    .join("");
  const courseLinks = o.courses
    .map((c) => `<li style="margin:0 0 6px;"><a href="${o.siteUrl}/aprender/${c.slug}" style="color:#93b4ff;">${escapeHtml(c.title)}</a></li>`)
    .join("");
  return {
    subject: `Compra confirmada · ${o.orderNumber}`,
    html: layout({
      siteUrl: o.siteUrl,
      preheader: `Tu pago fue confirmado. Ya tienes acceso a tus cursos.`,
      body:
        h1("¡Pago confirmado!") +
        p(`Gracias, ${escapeHtml(o.name || "estudiante")}. Recibimos tu pago y tu acceso ya está activo.`) +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;border-top:1px solid #1d2340;border-bottom:1px solid #1d2340;">${rows}
<tr><td style="padding:8px 0;color:#8b93b8;font-size:13px;">Subtotal</td><td align="right" style="color:#8b93b8;font-size:13px;">${formatMoney(o.subtotalCents, o.currency)}</td></tr>
${o.discountCents > 0 ? `<tr><td style="padding:4px 0;color:#8b93b8;font-size:13px;">Descuento</td><td align="right" style="color:#8b93b8;font-size:13px;">−${formatMoney(o.discountCents, o.currency)}</td></tr>` : ""}
<tr><td style="padding:8px 0;color:#fff;font-weight:700;">Total pagado</td><td align="right" style="color:#fff;font-weight:700;">${formatMoney(o.totalCents, o.currency)}</td></tr></table>` +
        p(`Pedido <strong style="color:#fff">${escapeHtml(o.orderNumber)}</strong> · ${escapeHtml(o.providerLabel)} · ${formatDate(o.paidAt, { dateStyle: "long", timeStyle: "short" })}`) +
        (courseLinks ? `${p("Accede a tus cursos:")}<ul style="margin:0 0 16px;padding-left:18px;font-size:15px;line-height:22px;">${courseLinks}</ul>` : "") +
        button("Ir a mis cursos", `${o.siteUrl}/cuenta/cursos`) +
        p(`<span style="font-size:13px;color:#8b93b8;">Consulta tu historial y comprobantes en <a href="${o.siteUrl}/cuenta/compras" style="color:#93b4ff;">Mis compras</a>.</span>`),
    }),
    text: `Pago confirmado. Pedido ${o.orderNumber}. Total ${formatMoney(o.totalCents, o.currency)}. Tus cursos: ${o.siteUrl}/cuenta/cursos`,
  };
}

export function passwordResetEmail(o: { link: string; siteUrl: string }): EmailContent {
  return {
    subject: `Restablece tu contraseña de ${BRAND.name}`,
    html: layout({
      siteUrl: o.siteUrl,
      preheader: "Usa este enlace para crear una nueva contraseña.",
      body:
        h1("Restablecer contraseña") +
        p("Recibimos una solicitud para restablecer la contraseña de tu cuenta. El enlace es válido durante 1 hora y solo puede usarse una vez.") +
        button("Crear nueva contraseña", o.link) +
        p('<span style="font-size:13px;color:#8b93b8;">Si no solicitaste este cambio, ignora este correo: tu contraseña no cambiará.</span>'),
    }),
    text: `Restablece tu contraseña (válido 1 hora): ${o.link}`,
  };
}

export function reminderEmail(o: { name: string; courseTitle: string; courseSlug: string; progress: number; siteUrl: string; unsubscribe: string }): EmailContent {
  return {
    subject: `Continúa con «${o.courseTitle}»`,
    html: layout({
      siteUrl: o.siteUrl,
      unsubscribe: o.unsubscribe,
      preheader: `Llevas ${o.progress}% del curso. ¡Sigue así!`,
      body:
        h1(`${escapeHtml(o.name || "Hola")}, tu curso te espera`) +
        p(`Llevas <strong style="color:#fff">${o.progress}%</strong> de <strong style="color:#fff">${escapeHtml(o.courseTitle)}</strong>. Unos minutos hoy marcan la diferencia.`) +
        button("Continuar donde me quedé", `${o.siteUrl}/aprender/${o.courseSlug}`),
    }),
    text: `Llevas ${o.progress}% de ${o.courseTitle}. Continúa: ${o.siteUrl}/aprender/${o.courseSlug}`,
  };
}

export function abandonedCartEmail(o: { name: string; items: { title: string }[]; siteUrl: string; unsubscribe: string }): EmailContent {
  const list = o.items.map((i) => `<li style="margin:0 0 6px;">${escapeHtml(i.title)}</li>`).join("");
  return {
    subject: "Tus cursos siguen en el carrito",
    html: layout({
      siteUrl: o.siteUrl,
      unsubscribe: o.unsubscribe,
      preheader: "Retoma tu compra cuando quieras.",
      body:
        h1("Dejaste algo pendiente") +
        p(`${escapeHtml(o.name || "Hola")}, guardamos estos cursos en tu carrito:`) +
        `<ul style="margin:0 0 16px;padding-left:18px;color:#e5e7f0;font-size:15px;line-height:22px;">${list}</ul>` +
        button("Completar mi compra", `${o.siteUrl}/carrito`),
    }),
    text: `Tus cursos siguen en el carrito: ${o.items.map((i) => i.title).join(", ")}. ${o.siteUrl}/carrito`,
  };
}

export function newCourseEmail(o: { courseTitle: string; subtitle: string | null; courseSlug: string; siteUrl: string; unsubscribe: string }): EmailContent {
  return {
    subject: `Nuevo curso: ${o.courseTitle}`,
    html: layout({
      siteUrl: o.siteUrl,
      unsubscribe: o.unsubscribe,
      preheader: o.subtitle ?? `Nuevo lanzamiento en ${BRAND.name}`,
      body:
        h1("Nuevo lanzamiento") +
        p(`<strong style="color:#fff">${escapeHtml(o.courseTitle)}</strong>`) +
        (o.subtitle ? p(escapeHtml(o.subtitle)) : "") +
        button("Ver el curso", `${o.siteUrl}/cursos/${o.courseSlug}`),
    }),
    text: `Nuevo curso: ${o.courseTitle}. ${o.siteUrl}/cursos/${o.courseSlug}`,
  };
}

export function promotionEmail(o: { subject: string; message: string; ctaLabel: string; ctaUrl: string; siteUrl: string; unsubscribe: string }): EmailContent {
  const paragraphs = o.message.split(/\n{2,}/).map((para) => p(escapeHtml(para).replace(/\n/g, "<br>"))).join("");
  return {
    subject: o.subject,
    html: layout({
      siteUrl: o.siteUrl,
      unsubscribe: o.unsubscribe,
      preheader: o.message.slice(0, 120),
      body: h1(o.subject) + paragraphs + button(o.ctaLabel, o.ctaUrl),
    }),
    text: `${o.subject}\n\n${o.message}\n\n${o.ctaUrl}`,
  };
}

export function certificateEmail(o: { name: string; courseTitle: string; code: string; siteUrl: string }): EmailContent {
  return {
    subject: `¡Felicidades! Tu certificado de «${o.courseTitle}»`,
    html: layout({
      siteUrl: o.siteUrl,
      preheader: "Completaste el curso. Descarga y comparte tu certificado.",
      body:
        h1(`¡Felicidades, ${escapeHtml(o.name || "estudiante")}!`) +
        p(`Completaste <strong style="color:#fff">${escapeHtml(o.courseTitle)}</strong>. Tu certificado tiene el código <strong style="color:#fff">${escapeHtml(o.code)}</strong> y cualquier persona puede verificarlo en línea.`) +
        button("Ver mi certificado", `${o.siteUrl}/certificados/${o.code}`),
    }),
    text: `Completaste ${o.courseTitle}. Certificado ${o.code}: ${o.siteUrl}/certificados/${o.code}`,
  };
}

/** Aviso de racha por perderse: estudió hasta ayer y hoy aún no. */
export function streakReminderEmail(o: { name: string; streak: number; courseTitle: string | null; courseSlug: string | null; siteUrl: string; unsubscribe: string }): EmailContent {
  const first = (o.name || "").trim().split(/\s+/)[0] || "Hola";
  const href = o.courseSlug ? `${o.siteUrl}/aprender/${o.courseSlug}` : `${o.siteUrl}/cuenta/cursos`;
  const label = o.courseTitle ? `Continuar «${o.courseTitle}»` : "Ir a mis cursos";
  return {
    subject: `Tu racha de ${o.streak} días sigue viva hoy`,
    html: layout({
      siteUrl: o.siteUrl,
      unsubscribe: o.unsubscribe,
      preheader: `Estudia hoy y llega a ${o.streak + 1} días seguidos.`,
      body:
        h1(`${first}, no pierdas tu racha de ${o.streak} días`) +
        p(`Llevas <strong style="color:#fff">${o.streak} días seguidos</strong> estudiando y hoy todavía no has avanzado. Basta con ver parte de un video, marcar una lección, presentar una evaluación o guardar una nota para llegar a <strong style="color:#fff">${o.streak + 1}</strong>.`) +
        button(label, href) +
        p(`<span style="font-size:13px;color:#8b93b8;">Te escribimos porque tienes activados los recordatorios de aprendizaje. Puedes desactivarlos en <a href="${o.siteUrl}/cuenta/ajustes" style="color:#8b93b8;">Configuración</a>.</span>`),
    }),
    text: `${first}, llevas ${o.streak} días seguidos estudiando y hoy todavía no has avanzado. Estudia hoy para llegar a ${o.streak + 1}: ${href}\n\nPuedes desactivar estos recordatorios en ${o.siteUrl}/cuenta/ajustes o aquí: ${o.unsubscribe}`,
  };
}
