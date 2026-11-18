/**
 * Textos del servidor en varios idiomas. Para agregar un idioma, agrega su código a
 * SUPPORTED_LOCALES y un bloque con las mismas claves en `messages`.
 */
export const SUPPORTED_LOCALES = ['es', 'en'];
export const DEFAULT_LOCALE = 'es';

const messages = {
  es: {
    'err.internal': 'Ocurrió un error inesperado. Intenta de nuevo.',
    'err.not_found': 'No encontrado.',
    'err.route_not_found': 'Ruta no encontrada.',
    'err.unauthorized': 'Inicia sesión para continuar.',
    'err.forbidden': 'No tienes permiso para realizar esta acción.',
    'err.bad_request': 'Revisa los datos enviados.',
    'err.payload_too_large': 'El texto enviado es demasiado grande.',
    'err.invalid_json': 'JSON inválido.',
    'err.csrf': 'Origen no permitido.',
    'err.json_only': 'Envía los datos como JSON.',
    'err.rate_limited': 'Demasiados intentos. Intenta de nuevo en {minutes} min.',
    'err.account_suspended': 'Tu cuenta está suspendida. Escríbenos para revisarla.',
    'err.email_not_verified': 'Confirma tu correo para usar las herramientas. Revisa tu bandeja o pide un nuevo enlace.',

    'auth.email_taken': 'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.',
    'auth.invalid_credentials': 'Correo o contraseña incorrectos.',
    'auth.invalid_verify_token': 'El enlace no es válido o ya venció. Pide uno nuevo desde tu cuenta.',
    'auth.already_verified': 'Tu correo ya está confirmado.',
    'auth.reset_sent': 'Si existe una cuenta con ese correo, te enviamos un enlace para restablecer tu contraseña.',
    'auth.invalid_reset_token': 'El enlace no es válido o ya venció. Solicita uno nuevo.',

    'v.required': 'Este campo es obligatorio.',
    'v.min_chars': 'Usa al menos {min} caracteres.',
    'v.max_chars': 'Máximo {max} caracteres.',
    'v.max_chars_plan': 'Máximo {max} caracteres en tu plan.',
    'v.option': 'Elige una opción de la lista.',
    'v.email': 'Escribe un correo válido.',
    'v.name': 'Escribe tu nombre.',
    'v.terms': 'Debes aceptar los términos y el aviso de privacidad.',
    'v.password_contains_email': 'La contraseña no debe contener tu correo.',
    'v.current_password': 'La contraseña actual no es correcta.',
    'v.password_wrong': 'La contraseña no es correcta.',
    'v.confirm_delete': 'Escribe ELIMINAR para confirmar.',
    'v.unknown_field': 'Campo no permitido.',
    'v.invalid': 'Valor no válido.',
    'v.future_date': 'La fecha debe ser futura.',
    'v.plan': 'Plan no válido.',

    'tools.not_found': 'Herramienta no encontrada.',
    'tools.upgrade_required': '"{tool}" está disponible en los planes de pago.',
    'tools.input_too_long': 'Tu plan permite {max} caracteres por solicitud. Reduce el texto o mejora tu plan.',
    'tools.quota_exceeded': 'No te alcanzan los créditos de este mes (esta herramienta usa {credits}). Se renuevan el {date} o puedes mejorar tu plan.',
    'tools.ai_unavailable': 'La IA no respondió en este momento. No se descontaron créditos; intenta de nuevo.',
    'gen.not_found': 'No encontramos ese resultado.',

    'account.last_admin': 'Eres el único administrador. Nombra a otro antes de eliminar tu cuenta.',
    'account.currency_locked': 'No puedes cambiar la moneda mientras tengas una suscripción activa.',

    'billing.disabled': 'Los pagos aún no están habilitados en esta plataforma.',
    'billing.price_missing': 'No existe en Stripe un precio con lookup_key "{key}". Ejecuta npm run stripe:setup.',
    'billing.already_subscribed': 'Ya tienes una suscripción. Cambia de plan desde "Administrar suscripción".',
    'billing.no_customer': 'Aún no tienes una suscripción de pago.',
    'billing.bad_signature': 'Firma de webhook inválida.',

    'admin.user_not_found': 'Usuario no encontrado.',
    'admin.self_change': 'No puedes suspenderte ni quitarte el rol de administrador.',

    'mail.hello': 'Hola, {name}',
    'mail.button_fallback': 'Si el botón no funciona, copia esta dirección:',
    'mail.verify.subject': 'Confirma tu correo en {app}',
    'mail.verify.p1': 'Gracias por crear tu cuenta. Confirma tu correo para empezar a usar las herramientas.',
    'mail.verify.p2': 'El enlace vence en 48 horas. Si no creaste esta cuenta, ignora este mensaje.',
    'mail.verify.action': 'Confirmar correo',
    'mail.reset.subject': 'Restablece tu contraseña de {app}',
    'mail.reset.p1': 'Recibimos una solicitud para restablecer tu contraseña. El enlace vence en 1 hora y solo funciona una vez.',
    'mail.reset.p2': 'Si no la solicitaste, ignora este mensaje: tu contraseña no cambiará.',
    'mail.reset.action': 'Crear nueva contraseña',
    'mail.changed.subject': 'Tu contraseña de {app} cambió',
    'mail.changed.p1': 'La contraseña de tu cuenta se cambió y cerramos las demás sesiones abiertas.',
    'mail.changed.p2': 'Si no fuiste tú, restablece tu contraseña de inmediato y escríbenos.',
    'mail.failed.subject': 'No pudimos cobrar tu suscripción de {app}',
    'mail.failed.p1': 'Tu banco rechazó el último cobro de tu suscripción. Reintentaremos automáticamente en los próximos días.',
    'mail.failed.p2': 'Para evitar que tu plan regrese a Gratis, actualiza tu método de pago.',
    'mail.failed.action': 'Actualizar método de pago',

    'plan.free': 'Gratis',
    'plan.pro': 'Pro',
    'plan.negocio': 'Negocio',
    'plan.credits': '{credits} créditos al mes',
    'plan.essential_tools': 'Herramientas esenciales',
    'plan.all_tools_detail': 'Todas las herramientas, incluidas cotizaciones, cobranza y análisis de documentos',
    'plan.all_tools': 'Todas las herramientas',
    'plan.chars': 'Textos de hasta {chars} caracteres por solicitud',
    'plan.documents': 'Documentos de hasta {chars} caracteres',
    'plan.history_days': 'Historial de {days} días',
    'plan.history_years': 'Historial de {years, plural}',
    'plan.languages': 'Respuestas en 6 idiomas',
  },
  en: {
    'err.internal': 'Something went wrong. Please try again.',
    'err.not_found': 'Not found.',
    'err.route_not_found': 'Route not found.',
    'err.unauthorized': 'Please sign in to continue.',
    'err.forbidden': "You don't have permission to do this.",
    'err.bad_request': 'Please check the information you entered.',
    'err.payload_too_large': 'The text you sent is too large.',
    'err.invalid_json': 'Invalid JSON.',
    'err.csrf': 'Origin not allowed.',
    'err.json_only': 'Send the data as JSON.',
    'err.rate_limited': 'Too many attempts. Try again in {minutes} min.',
    'err.account_suspended': 'Your account is suspended. Contact us to review it.',
    'err.email_not_verified': 'Confirm your email to use the tools. Check your inbox or request a new link.',

    'auth.email_taken': 'An account with that email already exists. Sign in or reset your password.',
    'auth.invalid_credentials': 'Incorrect email or password.',
    'auth.invalid_verify_token': 'This link is invalid or has expired. Request a new one from your account.',
    'auth.already_verified': 'Your email is already confirmed.',
    'auth.reset_sent': 'If an account exists for that email, we sent you a link to reset your password.',
    'auth.invalid_reset_token': 'This link is invalid or has expired. Request a new one.',

    'v.required': 'This field is required.',
    'v.min_chars': 'Use at least {min} characters.',
    'v.max_chars': 'Maximum {max} characters.',
    'v.max_chars_plan': 'Maximum {max} characters on your plan.',
    'v.option': 'Choose an option from the list.',
    'v.email': 'Enter a valid email.',
    'v.name': 'Enter your name.',
    'v.terms': 'You must accept the terms and the privacy policy.',
    'v.password_contains_email': 'The password must not contain your email.',
    'v.current_password': 'The current password is incorrect.',
    'v.password_wrong': 'The password is incorrect.',
    'v.confirm_delete': 'Type DELETE to confirm.',
    'v.unknown_field': 'Field not allowed.',
    'v.invalid': 'Invalid value.',
    'v.future_date': 'The date must be in the future.',
    'v.plan': 'Invalid plan.',

    'tools.not_found': 'Tool not found.',
    'tools.upgrade_required': '"{tool}" is available on paid plans.',
    'tools.input_too_long': 'Your plan allows {max} characters per request. Shorten the text or upgrade your plan.',
    'tools.quota_exceeded': "You don't have enough credits left this month (this tool uses {credits}). They renew on {date}, or you can upgrade your plan.",
    'tools.ai_unavailable': "The AI didn't respond right now. No credits were used; please try again.",
    'gen.not_found': "We couldn't find that result.",

    'account.last_admin': "You're the only administrator. Appoint another one before deleting your account.",
    'account.currency_locked': "You can't change the currency while you have an active subscription.",

    'billing.disabled': 'Payments are not enabled on this platform yet.',
    'billing.price_missing': 'There is no Stripe price with lookup_key "{key}". Run npm run stripe:setup.',
    'billing.already_subscribed': 'You already have a subscription. Change plans from "Manage subscription".',
    'billing.no_customer': "You don't have a paid subscription yet.",
    'billing.bad_signature': 'Invalid webhook signature.',

    'admin.user_not_found': 'User not found.',
    'admin.self_change': "You can't suspend yourself or remove your own admin role.",

    'mail.hello': 'Hi {name},',
    'mail.button_fallback': "If the button doesn't work, copy this address:",
    'mail.verify.subject': 'Confirm your email for {app}',
    'mail.verify.p1': 'Thanks for creating your account. Confirm your email to start using the tools.',
    'mail.verify.p2': "The link expires in 48 hours. If you didn't create this account, ignore this message.",
    'mail.verify.action': 'Confirm email',
    'mail.reset.subject': 'Reset your {app} password',
    'mail.reset.p1': 'We received a request to reset your password. The link expires in 1 hour and works only once.',
    'mail.reset.p2': "If you didn't request it, ignore this message: your password won't change.",
    'mail.reset.action': 'Create a new password',
    'mail.changed.subject': 'Your {app} password changed',
    'mail.changed.p1': 'Your account password was changed and we signed you out of your other sessions.',
    'mail.changed.p2': "If this wasn't you, reset your password right away and contact us.",
    'mail.failed.subject': "We couldn't charge your {app} subscription",
    'mail.failed.p1': "Your bank declined the latest charge for your subscription. We'll retry automatically over the next few days.",
    'mail.failed.p2': 'To keep your plan from going back to Free, update your payment method.',
    'mail.failed.action': 'Update payment method',

    'plan.free': 'Free',
    'plan.pro': 'Pro',
    'plan.negocio': 'Business',
    'plan.credits': '{credits} credits per month',
    'plan.essential_tools': 'Essential tools',
    'plan.all_tools_detail': 'All tools, including quotes, payment reminders and document analysis',
    'plan.all_tools': 'All tools',
    'plan.chars': 'Up to {chars} characters per request',
    'plan.documents': 'Documents up to {chars} characters',
    'plan.history_days': '{days}-day history',
    'plan.history_years': '{years, plural} history',
    'plan.languages': 'Replies in 6 languages',
  },
};

const NUMBER_LOCALE = { es: 'es-MX', en: 'en-US' };

export function isSupportedLocale(value) {
  return SUPPORTED_LOCALES.includes(value);
}

/** Elige el idioma: el que pide la interfaz, el guardado del usuario o el del navegador. */
export function resolveLocale({ header, userLocale, acceptLanguage, fallback = DEFAULT_LOCALE } = {}) {
  if (isSupportedLocale(header)) return header;
  if (isSupportedLocale(userLocale)) return userLocale;
  for (const part of String(acceptLanguage ?? '').split(',')) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (isSupportedLocale(code)) return code;
  }
  return fallback;
}

export function formatNumber(locale, value) {
  return Number(value).toLocaleString(NUMBER_LOCALE[locale] ?? 'en-US');
}

/** Fecha AAAA-MM-DD legible en el idioma (sin desfase de zona horaria). */
export function formatDay(locale, ymd) {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Intl.DateTimeFormat(NUMBER_LOCALE[locale] ?? 'en-US', { dateStyle: 'long', timeZone: 'UTC' })
    .format(Date.UTC(year, month - 1, day));
}

const YEARS = { es: (n) => (n === 1 ? '1 año' : `${n} años`), en: (n) => (n === 1 ? '1-year' : `${n}-year`) };

/** Traduce una clave con parámetros {nombre}. Si la clave no existe, devuelve la clave. */
export function t(locale, key, params = {}) {
  const dict = messages[locale] ?? messages[DEFAULT_LOCALE];
  const template = dict[key] ?? messages[DEFAULT_LOCALE][key] ?? key;
  return template.replace(/\{(\w+)(, plural)?\}/g, (_, name, plural) => {
    const value = params[name];
    if (value === undefined) return `{${name}}`;
    if (plural) return (YEARS[locale] ?? YEARS.en)(value);
    return typeof value === 'number' ? formatNumber(locale, value) : String(value);
  });
}

export function hasMessage(key) {
  return key in messages[DEFAULT_LOCALE];
}
