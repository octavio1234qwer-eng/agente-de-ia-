// Traducciones de la interfaz. Las páginas HTML están escritas en español y marcan sus textos con
// data-i18n="clave"; en otros idiomas se reemplazan con `staticText`. Los textos que arma JavaScript
// usan t('clave'). Para agregar un idioma: súmalo a LOCALES y agrega su bloque en `messages` y `staticText`.

export const LOCALES = { es: 'Español', en: 'English' };
const NUMBER_LOCALES = { es: 'es-MX', en: 'en-US' };

function detectLocale() {
  const stored = localStorage.getItem('locale');
  if (stored && LOCALES[stored]) return stored;
  const query = new URLSearchParams(window.location.search).get('lang');
  if (query && LOCALES[query]) return query;
  for (const language of navigator.languages ?? [navigator.language]) {
    const code = String(language).slice(0, 2).toLowerCase();
    if (LOCALES[code]) return code;
  }
  return 'en';
}

export const locale = detectLocale();
export const numberLocale = NUMBER_LOCALES[locale] ?? 'en-US';
document.documentElement.lang = locale;

export function setLocale(code, { reload = true } = {}) {
  if (!LOCALES[code]) return;
  localStorage.setItem('locale', code);
  if (reload) window.location.reload();
}

/** Moneda preferida para mostrar precios: la guardada, o MXN si el navegador está en México. */
export function preferredCurrency() {
  const stored = localStorage.getItem('currency');
  if (stored === 'mxn' || stored === 'usd') return stored;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  const inMexico = /^America\/(Mexico_City|Cancun|Merida|Monterrey|Matamoros|Chihuahua|Ciudad_Juarez|Ojinaga|Mazatlan|Bahia_Banderas|Hermosillo|Tijuana)$/.test(timeZone);
  return inMexico || navigator.language === 'es-MX' ? 'mxn' : 'usd';
}

export function setPreferredCurrency(currency) {
  localStorage.setItem('currency', currency);
}

const messages = {
  es: {
    'common.loading': 'Cargando…',
    'common.optional': '— Opcional —',
    'common.save': 'Guardar',
    'common.saving': 'Guardando…',
    'common.sending': 'Enviando…',
    'common.wait': 'Un momento…',
    'common.copied': 'Copiado al portapapeles',
    'common.copy_failed': 'No se pudo copiar. Selecciona el texto y cópialo manualmente.',
    'common.network': 'No hay conexión con el servidor. Revisa tu internet.',
    'common.error': 'Ocurrió un error. Intenta de nuevo.',
    'common.signout': 'Cerrar sesión',
    'common.month': '/mes',
    'common.forever': ' para siempre',
    'common.not_found': 'No encontramos esta sección.',
    'common.go_home': 'Ir al inicio',
    'credits.one': '{n} crédito',
    'credits.other': '{n} créditos',

    'nav.tools': 'Herramientas',
    'nav.history': 'Historial',
    'nav.plans': 'Planes y pagos',
    'nav.account': 'Mi cuenta',
    'nav.admin': 'Administración',
    'chrome.available': ' disponibles',
    'chrome.plan_renews': 'Plan {plan} · se renuevan el {date}',
    'chrome.upgrade': 'Mejorar plan',
    'chrome.plan': 'Plan {plan}',
    'chrome.credits_used': 'Créditos usados',

    'verify.title': 'Confirma tu correo para usar las herramientas. ',
    'verify.body': 'Enviamos un enlace a {email}. Revisa también tu carpeta de spam.',
    'verify.resend': 'Reenviar enlace',
    'verify.sent': 'Te enviamos un nuevo enlace a {email}.',

    'home.hello': 'Hola, {name}',
    'home.hello_anon': 'Hola',
    'home.subtitle': '¿Qué necesitas resolver hoy?',
    'home.welcome_title': '¡Bienvenido! ',
    'home.welcome': 'Elige una herramienta y usa el botón "Probar con un ejemplo" para ver cómo funciona.',
    'home.credits': 'Créditos de este mes: {used} de {limit} usados',
    'home.renews': 'Se renuevan el {date}',
    'home.need_more': '¿Necesitas más créditos o las herramientas Pro? ',
    'home.see_plans': 'Mira los planes',
    'home.locked': 'Pro · bloqueada',

    'tool.back': '← Todas las herramientas',
    'tool.locked_title': 'Disponible en los planes de pago',
    'tool.locked_body': 'Mejora a Pro para usar "{tool}" y todas las herramientas, con más créditos al mes.',
    'tool.see_plans': 'Ver planes',
    'tool.chars_total': '{used} de {max} caracteres permitidos por solicitud en tu plan.',
    'tool.generate': 'Generar',
    'tool.example': 'Probar con un ejemplo',
    'tool.uses': 'Usa {credits}',
    'tool.result': 'Resultado',
    'tool.empty': 'Llena el formulario y presiona "Generar". Tu resultado aparecerá aquí y se guardará en tu historial.',
    'tool.used': '{credits} usados',
    'tool.review': 'Revisa cifras, fechas y los datos entre corchetes antes de enviarlo.',
    'tool.copy': 'Copiar',
    'tool.again': 'Generar otra versión',
    'tool.history': 'Ver historial',
    'tool.generating': 'Generando…',
    'tool.generating_long': 'Generando, suele tardar de 5 a 30 segundos…',
    'tool.fix_fields': 'Corrige los campos marcados.',

    'history.title': 'Historial',
    'history.subtitle': 'Tus resultados anteriores, listos para copiar o reutilizar.',
    'history.all_tools': 'Todas las herramientas',
    'history.filter': 'Filtrar por herramienta',
    'history.more': 'Cargar más',
    'history.loading': 'Cargando…',
    'history.retention': 'Tu plan guarda el historial {days} días. Después se borra el contenido automáticamente.',
    'history.empty': 'Aún no hay resultados guardados.',
    'history.use_tool': 'Usar una herramienta',
    'history.clear': 'Borrar todo el historial',
    'history.clear_confirm': '¿Borrar todo tu historial? Esta acción no se puede deshacer.',
    'history.cleared': 'Historial borrado',
    'history.back': '← Historial',
    'history.you_wrote': 'Lo que escribiste',
    'history.reuse': 'Usar de nuevo',
    'history.delete': 'Eliminar',
    'history.delete_confirm': '¿Eliminar este resultado?',
    'history.deleted': 'Resultado eliminado',

    'plans.title': 'Planes y pagos',
    'plans.subtitle': 'Pagos seguros procesados por Stripe; no guardamos los datos de tu tarjeta.',
    'plans.currency': 'Moneda',
    'plans.paid_ok': '¡Gracias por tu pago! Tu plan se activa en cuanto Stripe nos confirma el cobro, normalmente en unos segundos.',
    'plans.paid_cancel': 'No se realizó ningún cargo. Puedes elegir un plan cuando quieras.',
    'plans.manage': 'Administrar suscripción',
    'plans.opening': 'Abriendo…',
    'plans.subscription': 'Suscripción {plan}',
    'plans.past_due': 'Tu banco rechazó el último cobro. Actualiza tu método de pago para no perder tu plan.',
    'plans.cancels_on': 'Se cancelará el {date}. Hasta entonces conservas tu plan.',
    'plans.renews_on': 'Se renueva el {date}.',
    'plans.portal_hint': 'Desde el portal de Stripe puedes cambiar de plan, actualizar tu tarjeta, descargar recibos o cancelar.',
    'plans.manual': 'Asignado por nuestro equipo.',
    'plans.manual_until': 'Asignado por nuestro equipo, vigente hasta el {date}.',
    'plans.current': 'Tu plan actual',
    'plans.back_to_free': 'Para volver a Gratis, cancela desde "Administrar suscripción".',
    'plans.change_to': 'Cambiar a {plan}',
    'plans.soon': 'Pagos próximamente',
    'plans.choose': 'Elegir {plan}',
    'plans.checkout': 'Abriendo pago seguro…',
    'plans.activated': '¡Tu plan {plan} está activo!',
    'plans.invoice': '¿Necesitas factura? Escríbenos a ',
    'plans.invoice_tail': ' con tus datos fiscales.',
    'plans.badge_current': 'Tu plan',
    'plans.badge_popular': 'Más popular',
    'plans.tax_mxn': 'IVA incluido. Cancela cuando quieras.',
    'plans.tax_usd': 'Más impuestos aplicables. Cancela cuando quieras.',
    'plans.no_card': 'Sin tarjeta.',
    'plans.start_free': 'Empezar gratis',
    'status.active': 'Activa',
    'status.trialing': 'Periodo de prueba',
    'status.past_due': 'Pago pendiente',
    'status.incomplete': 'Pago por confirmar',

    'account.title': 'Mi cuenta',
    'account.profile': 'Perfil',
    'account.email': 'Correo',
    'account.confirmed': 'Confirmado',
    'account.unconfirmed': 'Sin confirmar',
    'account.since': 'Cliente desde',
    'account.name': 'Nombre',
    'account.business': 'Negocio',
    'account.country': 'País',
    'account.country_help': 'Ayuda a la IA a usar los impuestos, fechas y costumbres de tu país.',
    'account.language': 'Idioma de la plataforma',
    'account.currency': 'Moneda para pagar',
    'account.currency_help': 'No se puede cambiar mientras tengas una suscripción activa.',
    'account.updated': 'Datos actualizados',
    'account.security': 'Seguridad',
    'account.current_password': 'Contraseña actual',
    'account.new_password': 'Nueva contraseña',
    'account.password_help': 'Mínimo 10 caracteres.',
    'account.change_password': 'Cambiar contraseña',
    'account.password_changed': 'Contraseña actualizada. Cerramos tus otras sesiones.',
    'account.data': 'Tus datos',
    'account.data_body': 'Descarga en un archivo JSON tu perfil, pagos e historial (derecho de acceso).',
    'account.download': 'Descargar mis datos',
    'account.delete': 'Eliminar cuenta',
    'account.delete_body': 'Se borran tu cuenta, tu historial y tus datos. Si tienes una suscripción, se cancela de inmediato y sin reembolso del periodo en curso.',
    'account.your_password': 'Tu contraseña',
    'account.confirm_word': 'ELIMINAR',
    'account.confirm_label': 'Escribe ELIMINAR para confirmar',
    'account.delete_button': 'Eliminar mi cuenta',
    'account.deleting': 'Eliminando…',

    'landing.panel': 'Ir a mi panel',
    'landing.pricing_error': 'No pudimos cargar los precios. Recarga la página.',
    'auth.bad_link': 'El enlace está incompleto. Ábrelo de nuevo desde tu correo o solicita otro.',
    'auth.bad_link_verify': 'El enlace está incompleto. Ábrelo de nuevo desde tu correo.',
  },
  en: {
    'common.loading': 'Loading…',
    'common.optional': '— Optional —',
    'common.save': 'Save',
    'common.saving': 'Saving…',
    'common.sending': 'Sending…',
    'common.wait': 'One moment…',
    'common.copied': 'Copied to clipboard',
    'common.copy_failed': "Couldn't copy. Select the text and copy it manually.",
    'common.network': "Can't reach the server. Check your internet connection.",
    'common.error': 'Something went wrong. Please try again.',
    'common.signout': 'Sign out',
    'common.month': '/month',
    'common.forever': ' forever',
    'common.not_found': "We couldn't find this section.",
    'common.go_home': 'Go home',
    'credits.one': '{n} credit',
    'credits.other': '{n} credits',

    'nav.tools': 'Tools',
    'nav.history': 'History',
    'nav.plans': 'Plans & billing',
    'nav.account': 'My account',
    'nav.admin': 'Admin',
    'chrome.available': ' available',
    'chrome.plan_renews': '{plan} plan · renews on {date}',
    'chrome.upgrade': 'Upgrade',
    'chrome.plan': '{plan} plan',
    'chrome.credits_used': 'Credits used',

    'verify.title': 'Confirm your email to use the tools. ',
    'verify.body': 'We sent a link to {email}. Check your spam folder too.',
    'verify.resend': 'Resend link',
    'verify.sent': 'We sent a new link to {email}.',

    'home.hello': 'Hi, {name}',
    'home.hello_anon': 'Hi',
    'home.subtitle': 'What do you need to get done today?',
    'home.welcome_title': 'Welcome! ',
    'home.welcome': 'Pick a tool and press "Try an example" to see how it works.',
    'home.credits': 'Credits this month: {used} of {limit} used',
    'home.renews': 'Renews on {date}',
    'home.need_more': 'Need more credits or the Pro tools? ',
    'home.see_plans': 'See plans',
    'home.locked': 'Pro · locked',

    'tool.back': '← All tools',
    'tool.locked_title': 'Available on paid plans',
    'tool.locked_body': 'Upgrade to Pro to use "{tool}" and every other tool, with more credits per month.',
    'tool.see_plans': 'See plans',
    'tool.chars_total': '{used} of {max} characters allowed per request on your plan.',
    'tool.generate': 'Generate',
    'tool.example': 'Try an example',
    'tool.uses': 'Uses {credits}',
    'tool.result': 'Result',
    'tool.empty': 'Fill in the form and press "Generate". Your result will appear here and be saved in your history.',
    'tool.used': '{credits} used',
    'tool.review': 'Double-check figures, dates and anything in square brackets before sending.',
    'tool.copy': 'Copy',
    'tool.again': 'Generate another version',
    'tool.history': 'View history',
    'tool.generating': 'Generating…',
    'tool.generating_long': 'Generating, this usually takes 5 to 30 seconds…',
    'tool.fix_fields': 'Fix the highlighted fields.',

    'history.title': 'History',
    'history.subtitle': 'Your previous results, ready to copy or reuse.',
    'history.all_tools': 'All tools',
    'history.filter': 'Filter by tool',
    'history.more': 'Load more',
    'history.loading': 'Loading…',
    'history.retention': 'Your plan keeps your history for {days} days. After that the content is deleted automatically.',
    'history.empty': 'No saved results yet.',
    'history.use_tool': 'Use a tool',
    'history.clear': 'Clear all history',
    'history.clear_confirm': 'Clear your whole history? This cannot be undone.',
    'history.cleared': 'History cleared',
    'history.back': '← History',
    'history.you_wrote': 'What you wrote',
    'history.reuse': 'Use again',
    'history.delete': 'Delete',
    'history.delete_confirm': 'Delete this result?',
    'history.deleted': 'Result deleted',

    'plans.title': 'Plans & billing',
    'plans.subtitle': "Secure payments processed by Stripe; we don't store your card details.",
    'plans.currency': 'Currency',
    'plans.paid_ok': 'Thanks for your payment! Your plan activates as soon as Stripe confirms the charge, usually within seconds.',
    'plans.paid_cancel': 'You were not charged. You can choose a plan whenever you like.',
    'plans.manage': 'Manage subscription',
    'plans.opening': 'Opening…',
    'plans.subscription': '{plan} subscription',
    'plans.past_due': 'Your bank declined the latest charge. Update your payment method to keep your plan.',
    'plans.cancels_on': 'It will be canceled on {date}. You keep your plan until then.',
    'plans.renews_on': 'Renews on {date}.',
    'plans.portal_hint': 'In the Stripe portal you can change plans, update your card, download receipts or cancel.',
    'plans.manual': 'Assigned by our team.',
    'plans.manual_until': 'Assigned by our team, valid until {date}.',
    'plans.current': 'Your current plan',
    'plans.back_to_free': 'To go back to Free, cancel from "Manage subscription".',
    'plans.change_to': 'Switch to {plan}',
    'plans.soon': 'Payments coming soon',
    'plans.choose': 'Choose {plan}',
    'plans.checkout': 'Opening secure checkout…',
    'plans.activated': 'Your {plan} plan is active!',
    'plans.invoice': 'Need an invoice? Email us at ',
    'plans.invoice_tail': ' with your tax details.',
    'plans.badge_current': 'Your plan',
    'plans.badge_popular': 'Most popular',
    'plans.tax_mxn': 'VAT included. Cancel anytime.',
    'plans.tax_usd': 'Plus applicable taxes. Cancel anytime.',
    'plans.no_card': 'No card required.',
    'plans.start_free': 'Start free',
    'status.active': 'Active',
    'status.trialing': 'Trial',
    'status.past_due': 'Payment due',
    'status.incomplete': 'Payment pending',

    'account.title': 'My account',
    'account.profile': 'Profile',
    'account.email': 'Email',
    'account.confirmed': 'Confirmed',
    'account.unconfirmed': 'Not confirmed',
    'account.since': 'Customer since',
    'account.name': 'Name',
    'account.business': 'Business',
    'account.country': 'Country',
    'account.country_help': "Helps the AI use your country's taxes, dates and customs.",
    'account.language': 'Platform language',
    'account.currency': 'Billing currency',
    'account.currency_help': "Can't be changed while you have an active subscription.",
    'account.updated': 'Details updated',
    'account.security': 'Security',
    'account.current_password': 'Current password',
    'account.new_password': 'New password',
    'account.password_help': 'At least 10 characters.',
    'account.change_password': 'Change password',
    'account.password_changed': 'Password updated. We signed you out of your other sessions.',
    'account.data': 'Your data',
    'account.data_body': 'Download your profile, payments and history as a JSON file (right of access).',
    'account.download': 'Download my data',
    'account.delete': 'Delete account',
    'account.delete_body': 'Your account, history and data are deleted. If you have a subscription, it is canceled immediately with no refund for the current period.',
    'account.your_password': 'Your password',
    'account.confirm_word': 'DELETE',
    'account.confirm_label': 'Type DELETE to confirm',
    'account.delete_button': 'Delete my account',
    'account.deleting': 'Deleting…',

    'landing.panel': 'Go to my dashboard',
    'landing.pricing_error': "We couldn't load the prices. Reload the page.",
    'auth.bad_link': 'The link is incomplete. Open it again from your email or request a new one.',
    'auth.bad_link_verify': 'The link is incomplete. Open it again from your email.',
  },
};

/** Traducción de los textos de las páginas HTML (marcados con data-i18n). El español está en el HTML. */
const staticText = {
  en: {
    // Cabecera y pie
    'nav.tools': 'Tools',
    'nav.example': 'How it works',
    'nav.pricing': 'Pricing',
    'nav.faq': 'FAQ',
    'nav.signin': 'Sign in',
    'nav.signup': 'Start free',
    'footer.terms': 'Terms',
    'footer.privacy': 'Privacy policy',

    // Página principal
    'landing.title': 'ImpulsaIA · AI tools for small businesses',
    'landing.meta': 'Reply to customers and reviews, write product listings, quotes, payment reminders and social posts with AI. In 6 languages. Start free.',
    'hero.badge': 'For small businesses and freelancers, anywhere',
    'hero.title': 'Reply, sell and get paid in minutes, not hours.',
    'hero.lead': 'AI tools for the work that eats up your day: customer messages, reviews, product listings, quotes, payment reminders and social media content. Type what you need, copy the result, done.',
    'hero.cta': 'Start free',
    'hero.example': 'See a real example',
    'hero.fine': 'Free plan, no card required. Replies in 6 languages. Cancel anytime.',
    'problems.title': 'Real problems we solve',
    'problems.lead': "Each tool tackles a repetitive task that costs a small business time or money. It's not a generic chat: it already knows the format you need and never invents prices or details you didn't give it.",
    'p1.tag': 'Unanswered messages',
    'p1.title': 'Customer replies',
    'p1.body': 'Customers who wait hours buy somewhere else. Get clear replies with your prices, hours and policies in seconds, in their language.',
    'p2.tag': 'Negative reviews',
    'p2.title': 'Review replies',
    'p2.body': 'An unanswered 1-star review weighs on Google Maps. Reply with empathy and professionalism, without arguing with the customer.',
    'p3.tag': "Listings that don't sell",
    'p3.title': 'Product listings',
    'p3.body': 'Titles, bullets and descriptions for Amazon, Etsy, eBay, Mercado Libre or your store, based only on the real features.',
    'p4.tag': 'Unpaid invoices',
    'p4.title': 'Payment reminders',
    'p4.body': 'Staged reminders that are firm but respectful, with no threats or language that gets you in trouble.',
    'p5.tag': 'Improvised quotes',
    'p5.title': 'Sales proposals',
    'p5.body': 'Turn a list of items and prices into a professional proposal with scope, taxes, timeline and next steps.',
    'p6.tag': 'Long contracts',
    'p6.title': 'Document summaries',
    'p6.body': 'Pull out amounts, dates, obligations and penalties from contracts and meeting notes before you sign or meet.',
    'example.title': 'How it works for a real business',
    'example.lead': "Ana runs a bakery. She handles orders, social media and billing on her own. Here's what a day with ImpulsaIA looks like, starting from zero.",
    'e1.time': 'Step 0 · 2 minutes',
    'e1.title': 'She creates her free account',
    'e1.body': 'She enters her name, email and password and confirms her email. No credit card. She gets 25 free credits every month.',
    'e2.time': '9:00 am · 15 WhatsApp messages',
    'e2.title': 'Customer replies',
    'e2.body': 'She writes her bakery details once (prices, hours, delivery) and pastes the message "how much for a cake for 20 people?". In seconds she has 2 replies with her real prices. Copy, paste into WhatsApp, send.',
    'e3.time': '12:00 pm · A 2-star review',
    'e3.title': 'Review replies',
    'e3.body': 'She pastes the review and gets a kind, professional public reply that acknowledges the problem without arguing.',
    'e4.time': '4:00 pm · A wedding asks for a quote',
    'e4.title': 'Quotes and proposals',
    'e4.body': 'She types the items and prices; she gets a tidy proposal with taxes, timeline and deposit, ready to send.',
    'e5.time': '6:00 pm · A customer owes her',
    'e5.title': 'Payment reminders',
    'e5.body': 'She generates a firm but respectful reminder for WhatsApp, with the amount and how to pay.',
    'e6.time': 'Sunday · Next week’s posts',
    'e6.title': 'Social media content',
    'e6.body': 'She asks for 5 Instagram posts with captions, photo ideas and hashtags for her weekend promo.',
    'example.result_title': 'The result',
    'example.result': 'What used to take her hours now takes minutes. She replies faster, stops losing sales to slow answers and her business looks more professional. She started free and moved to Pro when she needed quotes and payment reminders.',
    'example.cta': 'Do the same for your business',
    'tools.title': 'Tools included',
    'tools.lead': 'Tools marked',
    'tools.lead_tail': 'are included in paid plans.',
    'how.title': 'Three steps',
    'how.s1': 'Create your account',
    'how.s1_body': 'With your email. The free plan includes credits every month.',
    'how.s2': 'Pick a tool',
    'how.s2_body': 'Fill in the form with your business details or try the example.',
    'how.s3': 'Copy and use',
    'how.s3_body': 'Review the result, tweak it and paste it into WhatsApp, Google or your store.',
    'pricing.title': 'Simple pricing',
    'pricing.lead': 'Each use of a tool costs credits (1 or 2 depending on the tool). Credits renew on the 1st of every month.',
    'pricing.currency': 'Currency',
    'faq.title': 'Frequently asked questions',
    'faq.q1': 'Do I need a card for the free plan?',
    'faq.a1': 'No. Just confirm your email and you can use the essential tools every month.',
    'faq.q2': 'Does it work in my country?',
    'faq.a2': 'Yes. The platform is available in English and Spanish, replies can be written in 6 languages, and you can pay in US dollars or Mexican pesos with any card.',
    'faq.q3': 'How do I pay and can I cancel?',
    'faq.a3': 'You pay by card through Stripe. You can cancel from your account anytime and keep your plan until the end of the paid period.',
    'faq.q4': 'Can the AI make mistakes?',
    'faq.a4': 'Yes. It is instructed not to invent data and to mark anything missing in square brackets, but always review the text before sending it, especially figures, dates and terms.',
    'faq.q5': 'What happens to the information I enter?',
    'faq.a5': 'It is only used to generate your result and is saved in your history, which you can delete anytime. You can download or delete all your data from your account.',
    'faq.q6': 'Does the contract summary replace a lawyer?',
    'faq.a6': 'No. It helps you understand the document and prepare questions, but it is not legal advice.',

    // Acceso
    'signin.title': 'Sign in',
    'signin.heading': 'Sign in',
    'signin.lead': 'Good to see you again.',
    'field.email': 'Email',
    'field.password': 'Password',
    'signin.submit': 'Sign in',
    'signin.forgot': 'Forgot your password?',
    'signin.no_account': "Don't have an account?",
    'signin.create': 'Create one free',
    'signup.title': 'Create account',
    'signup.heading': 'Create your free account',
    'signup.lead': 'No card required. Free credits every month.',
    'field.name': 'Your name',
    'field.business': 'Business name',
    'field.optional': '(optional)',
    'field.password_help': 'At least 10 characters. A phrase of several words is safer and easier to remember.',
    'signup.accept': 'I accept the',
    'signup.terms': 'terms',
    'signup.and': 'and the',
    'signup.privacy': 'privacy policy',
    'signup.submit': 'Create account',
    'signup.have_account': 'Already have an account?',
    'signup.signin': 'Sign in',
    'forgot.title': 'Reset password',
    'forgot.heading': 'Reset your password',
    'forgot.lead': "We'll send you a link to create a new one. It expires in 1 hour.",
    'forgot.email': 'Your account email',
    'forgot.submit': 'Send link',
    'forgot.back': 'Back to sign in',
    'reset.title': 'New password',
    'reset.heading': 'Create a new password',
    'reset.done': 'Done, your password changed and we signed you out of other sessions.',
    'reset.signin': 'Sign in',
    'reset.password': 'New password',
    'reset.help': 'At least 10 characters.',
    'reset.submit': 'Save password',
    'verify.title_page': 'Confirm email',
    'verify.heading': 'Email confirmation',
    'verify.loading': 'Confirming your email…',
    'verify.done': 'Done! Your email is confirmed.',
    'verify.go': 'Go to my dashboard',
    'notfound.title': 'Page not found',
    'notfound.heading': "We couldn't find this page",
    'notfound.body': 'The link may be incomplete or the page may no longer exist.',
    'notfound.home': 'Go home',
    'app.title': 'Dashboard',
  },
};

/** Busca una traducción para textos generados por JavaScript. */
export function t(key, params = {}) {
  const template = messages[locale]?.[key] ?? messages.es[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name) => (params[name] === undefined ? `{${name}}` : String(params[name])));
}

export function credits(n) {
  return t(n === 1 ? 'credits.one' : 'credits.other', { n });
}

/** Aplica las traducciones a los elementos marcados en el HTML. */
export function applyI18n(root = document) {
  const dict = staticText[locale];
  if (!dict) return;
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const text = dict[el.dataset.i18n];
    if (text) el.textContent = text;
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const text = dict[el.dataset.i18nPlaceholder];
    if (text) el.setAttribute('placeholder', text);
  });
  root.querySelectorAll('[data-i18n-content]').forEach((el) => {
    const text = dict[el.dataset.i18nContent];
    if (text) el.setAttribute('content', text);
  });
  root.querySelectorAll('[data-href-en]').forEach((el) => {
    if (locale === 'en') el.setAttribute('href', el.dataset.hrefEn);
  });
}

/** Selector de idioma para las cabeceras. */
export function languageSelect({ onChange } = {}) {
  const select = document.createElement('select');
  select.className = 'lang-select';
  select.setAttribute('aria-label', 'Idioma / Language');
  for (const [code, name] of Object.entries(LOCALES)) {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = name;
    select.append(option);
  }
  select.value = locale;
  select.addEventListener('change', async () => {
    if (onChange) await onChange(select.value);
    setLocale(select.value);
  });
  return select;
}

applyI18n();
