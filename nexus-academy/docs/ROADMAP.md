# NEXUS ACADEMY · Hoja de ruta de trabajo

Lista viva que usa el agente programado ("Agente chambeador NEXUS", cada hora) para
saber qué sigue. Marcar `[x]` solo cuando esté construido **y probado**.

## Hecho
- [x] Esquema de base de datos (30 tablas), funciones de negocio, RLS, buckets de almacenamiento
- [x] Seed del catálogo (10 cursos, 46 lecciones, 26 preguntas, 2 paquetes) sin datos inventados
- [x] Pruebas pgTAP de seguridad: 46/46 (`npx supabase test db`)
- [x] Librerías de servidor: auth (DAL), precios/cupones, checkout, Stripe, Mercado Pago, PayPal, Resend, NEXUS AI (Claude), PDF de certificados — compilan (`tsc`)
- [x] Sistema de diseño, navbar/footer, página principal (verificada en navegador escritorio/móvil, sin errores)
- [x] Catálogo `/cursos`: búsqueda, filtros, orden, paginación (verificado)
- [x] Página de curso `/cursos/[slug]`: temario, instructor, reseñas, compra/inscripción, favoritos (verificada; 404 real)
- [x] Auth: login, registro, recuperar, restablecer, `/auth/confirm` + plantillas de correo con token_hash
- [x] Cuenta: perfil + foto, mis cursos, favoritos, compras, certificados, ajustes
- [x] E2E `e2e/auth-account.mjs`: registro → inscripción gratis → favoritos → perfil → logout/login → recuperación por correo real (Mailpit) → OK

- [x] Carrito, checkout (cupones, RFC/CFDI opcional, cupón 100 % sin proveedor), éxito/cancelado con verificación vía API del proveedor
- [x] Webhooks Stripe / Mercado Pago / PayPal + retorno de PayPal (captura en servidor); idempotencia en `payment_events`
- [x] Pruebas: 17 unitarias (`npm test`), 46 pgTAP (`npm run test:db`), E2E pagos `e2e/payments.mjs` 10/10 (webhook firmado → orden pagada → acceso activado; repetición ignorada; firma falsa 400; importe alterado sin acceso; fallo del proveedor honesto; cupón 100 %)

- [x] Aula virtual: video (almacenamiento privado con URL firmada / YouTube / Vimeo), temario con progreso, completar, recursos con descarga firmada, evaluaciones, reseña, móvil
- [x] NEXUS AI: `/api/ai/chat` con Claude en streaming, contexto de la lección vía RLS, catálogo real, límite diario, fallback de rechazo; panel en el aula (503 honesto sin clave)
- [x] Certificados: emisión automática, `/certificados/[code]` con QR, `/verificar`, PDF; E2E `e2e/classroom.mjs` 17/17

- [x] Paquetes (lista y detalle con compra), instructores, `/nexus-ai` con historial, legales (términos, privacidad LFPDPPP, reembolsos), `/baja` firmada
- [x] Rastreo de enlaces `e2e/links.mjs`: 32 rutas públicas, 0 rotas

- [x] Panel admin: dashboard (KPIs reales + 4 gráficas con paleta validada y tabla accesible), cursos (CRUD, portada, temario, lecciones, videos privados, recursos, preguntas), categorías, instructores, paquetes, alumnos (rol, otorgar/revocar), pedidos (detalle, eventos, reembolsos vía API o manuales), cupones, reseñas, correos (registro + campañas con baja); auditoría de acciones; `scripts/create-admin.mjs`
- [x] E2E `e2e/admin.mjs`: 24/24 (alumno expulsado de /admin, crear curso+temario+lección+recurso, contenido protegido, otorgar acceso, cupón, reembolso retira acceso, archivado en vez de borrado, 10 secciones cargan)

- [x] Automatizaciones: `/api/cron/reminders`, `/api/cron/abandoned-carts`, `/api/cron/expire-orders` protegidas con CRON_SECRET (probadas con datos reales: detectan casos y registran «omitido» sin proveedor) + `vercel.json`
- [x] ESLint limpio y `next build` de producción exitoso
- [x] README: arquitectura, pruebas y guía exacta de activación (Supabase, Vercel, Stripe, Mercado Pago, PayPal, Resend, Claude)

- [x] Subida de video reanudable (TUS, bloques de 6 MB) con progreso y pausa; E2E `e2e/video-upload.mjs` 7/7 (pausa al 40 %, reanuda, 20 MB íntegros en bucket privado, URL firmada sirve el archivo)

- [x] Editor de Markdown con barra de formato y vista previa (lecciones y descripción de cursos, alterna en móvil); E2E `e2e/markdown-editor.mjs` 8/8 (incluye HTML crudo sin ejecutar)

- [x] Búsqueda de texto completo en lecciones (`/cuenta/buscar`, buscador en «Mis cursos» y dentro del aula): índice en español sin acentos en `lesson_contents` (protegida por RLS), `search_lessons()` solo devuelve cursos con acceso; pgTAP 16/16 nuevas, E2E `e2e/lesson-search.mjs` 22/22

- [x] Al abrir una lección desde la búsqueda se resaltan las mismas palabras que encontró el índice (CSS Custom Highlight API, sin tocar el DOM de React), con aviso de coincidencias, «Volver a los resultados» y «Quitar»; E2E 29/29

- [x] Notas personales por lección (privadas incluso para el admin, RLS + pgTAP 14/14): editor en cada lección con aviso de cambios sin guardar y Ctrl+Enter, página `/cuenta/notas` agrupada por curso, descarga en Markdown (`/api/notes/export`); E2E `e2e/lesson-notes.mjs` 28/28
- [x] Menú de la cuenta en móvil: la pestaña activa se desplaza a la vista

- [x] Notas con marca de tiempo en lecciones de video: botón «Marca de tiempo» inserta `[m:ss]` en el cursor, cada marca salta a ese segundo, y en «Mis notas» enlazan a `?t=SEGUNDOS`; E2E `e2e/video-timestamps.mjs` 12/12 con video real (corregida una carrera que perdía teclas tras el clic)

- [x] Certificados en LinkedIn: «Agregar a LinkedIn» (formulario oficial add-to-profile prellenado: curso, NEXUS ACADEMY, año/mes de emisión, URL de verificación) y «Compartir»; página pública con Open Graph y tarjeta PNG 1200×630 generada; revocados excluidos; E2E `e2e/certificate-linkedin.mjs` 17/17
  - Nota: la página oficial addtoprofile.linkedin.com bloquea lectura automática (403); se usan solo parámetros confirmados por varias fuentes (`certId` se omitió por no estar confirmado; el ID va en la URL de verificación)

- [x] Subtítulos para videos propios: el admin sube .vtt o .srt (conversión automática, idioma es/en/pt, auditoría), `<track>` en el aula servido desde `/api/captions/[id]` con las mismas reglas RLS que la lección, y lo que se dice en el video entra a la búsqueda; pgTAP 11/11 nuevas, E2E `e2e/video-captions.mjs` 17/17
- [x] `scripts/dev-up.sh` reintenta el arranque de Supabase (tras reinicios del contenedor el primer intento puede fallar por un puerto ocupado)

- [x] Auditoría de accesibilidad con axe-core (`npm run test:a11y`, 42/42 sin infracciones WCAG 2.1 A/AA). Corregido: nombre accesible del logo (y espacio real entre NEXUS y ACADEMY para lectores de pantalla), barras de progreso sin nombre, panel de NEXUS AI cerrado que seguía siendo enfocable (ahora `inert`), tablas del admin desplazables sin teclado (ahora región enfocable), y `text-mist-500` (17 usos) que tomaba un gris de Tailwind con contraste 4.41 → tono propio #7d85aa (≥ 4.5:1)
- [x] `scripts/dev-up.sh`: reintenta Docker cuando containerd no arranca a tiempo y ya no dice «Entorno listo» si Supabase no responde

- [x] Rendimiento con Lighthouse (`npm run test:perf`, producción, móvil): portada de 85 → 99-100 (bloqueo del hilo principal 590 → ~100 ms) al reemplazar brillos con `blur(140px)` animados y una tarjeta flotante con `backdrop-filter` por degradados radiales; respeto de «reducir movimiento»; meta descripción y canonical en la página de curso; encabezados en orden (pie de página h2, «Resultados» en el catálogo). 5/5 páginas ≥ 94 en rendimiento y 100 en accesibilidad, buenas prácticas y SEO
  - Nota: Next.js entrega metadatos «en streaming» a navegadores y en el `<head>` a bots (LinkedInBot, Bingbot); el script lo verifica con user agents de bot

- [x] SEO: `robots.txt` (bloquea admin, cuenta, aula, NEXUS AI, API, checkout y autenticación; deja leer certificados para las vistas previas de LinkedIn) y `sitemap.xml` (páginas públicas + cursos y paquetes publicados vía clave pública, se regenera cada hora); JSON-LD de organización y buscador del catálogo en la portada. E2E `e2e/seo.mjs` 22/22 (detectó que `/nexus-ai` exige sesión y se sacó del sitemap)

- [x] Admin: exportar pedidos (con RFC/razón social, artículos, importes, neto y referencia de pago) y alumnos (inscripciones, completados, certificados, total pagado) a CSV, con filtros de fecha (hora CDMX, inclusivos) y estado; BOM UTF-8 para Excel, protección contra inyección de fórmulas, solo admin y cada descarga auditada. E2E `e2e/admin-export.mjs` 19/19

- [x] Admin «Ingresos»: reporte por producto (pedidos, unidades, bruto, descuentos, reembolsos y neto) por fecha de pago, con atajos de periodo, totales y CSV. La función SQL `admin_revenue_by_product` (solo admin) reparte los reembolsos de cada pedido entre sus artículos al centavo exacto; pgTAP 9/9 nuevas, E2E `e2e/admin-revenue.mjs` 14/14

- [x] Alumno: «Tu ritmo de estudio» en «Mis cursos»: racha actual y mejor racha (días consecutivos con actividad real: avanzar un video, marcar una lección, presentar una evaluación o guardar una nota, registrada por triggers de la base y nunca a mano), meta semanal de lecciones (1-50, lunes a domingo) con barra y mensaje, semana con días estudiados y lecciones por día, zona horaria del alumno en «Configuración» (detecta la del dispositivo; la base rechaza zonas inexistentes). pgTAP 22/22 nuevas (121 en total), 9 unitarias nuevas (52), E2E `e2e/learning-streaks.mjs` 22/22, axe sin infracciones
- [x] Pie de página: en pantallas de 360 px el formulario del boletín desbordaba 9 px en todas las páginas; corregido

- [x] Aviso por correo «Tu racha de N días sigue viva hoy» (`/api/cron/streak-reminders`, protegido con CRON_SECRET): la función `streak_reminder_candidates` (solo clave de servicio) elige a quien tiene recordatorios activados, racha de 2+ días hasta ayer, nada hoy, y está entre las 16 y 22 h de su zona; máximo un aviso cada 3 días y uno por día local. Con Resend sin configurar queda como «omitido» (nunca se finge). Programado 00:00 UTC (América) y 18:00 UTC (España). pgTAP 12/12 nuevas (133), 3 unitarias (55), E2E `e2e/streak-reminder.mjs` 10/10

- [x] Admin: panel «Actividad de estudio» en el dashboard (alumnos que estudiaron hoy, en 7 días y en el periodo; lecciones completadas; días de estudio promedio por alumno; gráfica por día y por 12 semanas con tabla accesible). Solo conteos, nunca qué estudió cada alumno; el admin no cuenta como alumno; el KPI «Aprendiendo activamente» ahora usa esta actividad real. pgTAP 11/11 nuevas (144), E2E `e2e/admin-activity.mjs` 14/14, axe sin infracciones, `e2e/admin.mjs` sigue pasando

- [x] Admin: «Embudo de alumnos» por curso (`/admin/cursos/[id]/embudo`): inscritos, empezaron, sin empezar, terminaron y tasa de finalización; por lección, en el orden del temario, cuántos la completaron y cuántos están detenidos en ella (primera lección pendiente de quien empezó y no terminó), con las 3 lecciones donde más se detienen. Solo alumnos con acceso vigente y solo conteos. pgTAP 9/9 nuevas (153), 3 unitarias (58), E2E `e2e/course-funnel.mjs` 10/10 (incluye avanzar una lección en el aula y ver cómo cambia), axe sin infracciones

- [x] Marca configurable: nombre de la academia, del tutor de IA y lema por variables de entorno (`NEXT_PUBLIC_SITE_NAME`, `NEXT_PUBLIC_AI_NAME`, `NEXT_PUBLIC_SITE_TAGLINE`) en interfaz, correos, certificados (PDF, LinkedIn, Open Graph), pagos (Stripe, PayPal, estado de cuenta de Mercado Pago) y el prompt del tutor; probado con una compilación de producción con otra marca
- [x] Alumno: «Descargar mis datos (JSON)» en Configuración (derecho de acceso ARCO al instante): perfil, inscripciones, progreso, evaluaciones, notas, certificados, compras con facturación, cupones, favoritos, reseñas, carrito, conversaciones con el tutor, actividad y correos enviados; siempre filtrado por el propio usuario. E2E `e2e/my-data-export.mjs` 12/12

- [x] Preguntas y respuestas por lección: los alumnos inscritos preguntan y responden en cada lección (los demás ven «Ana G.», nunca correo ni apellido completo); las respuestas de admin/instructor se marcan «Equipo» según el rol (lo decide la base) y avisan al alumno por correo («omitido» sin Resend, nunca fingido); editar lo propio, moderación (ocultar/mostrar/eliminar con auditoría), límite anti-spam (20 preguntas / 60 respuestas por día), bandeja `/admin/preguntas` (sin responder, todas, ocultas) y aviso en el dashboard; entra en «Descargar mis datos» y en el aviso de privacidad. pgTAP 31/31 nuevas (184), 5 unitarias (65), E2E `e2e/lesson-qa.mjs` 30/30, axe sin infracciones
- [x] Avisos del curso: el admin publica, edita y borra avisos por curso (Markdown, auditados) desde `/admin/cursos/[id]/avisos`, con envío por correo opcional y único solo a alumnos con acceso y con «Recordatorios y avisos de mis cursos» activados (guarda solo conteos; «omitido» sin Resend); los alumnos los ven en `/aprender/[slug]/avisos`, con aviso en la lección, contador en el temario e insignia en «Mis cursos»; «visto» por alumno (se marca desde el navegador, no por precarga). pgTAP 19/19 nuevas (203), 2 unitarias (67), E2E `e2e/course-announcements.mjs` 28/28, axe sin infracciones
- [x] Kit vendible: ZIP sin notas internas (`academia-online-kit.zip`) verificado desde cero (npm ci, tsc, unitarias, build). **v1.2 (2026-11-26 08:08 UTC, 754 KB, sha256 fee026b0…)** añade preguntas y respuestas por lección y avisos del curso; verificada desde cero: npm ci, tsc, 67/67 unitarias, build. Es la versión que hay que subir a Gumroad (reemplaza a la v1 de 713 KB y a la v1.1 de 736 KB), con `GUIA-INSTALACION.md` y `LICENCIA.md` (carpeta `kit/`); capturas reales y portada en `marketing/`
- [x] Gumroad: producto en BORRADOR «Kit Academia Online» ($79 USD, permalink `kit-academia-online`, id `KzIYBhcz1W4KXhOE0eILpA==`) con descripción honesta, 6 portadas, guía y licencia adjuntas. Falta el ZIP (Google Drive no permitió compartirlo por enlace público; el usuario lo sube en el editor)

## Siguiente (en orden)
- [ ] En cuanto el producto esté publicado (comprobar con get_product: published = true y que tenga el ZIP en list_files), programar en Buffer estas publicaciones y luego alternar con los demás productos:
  - LinkedIn: «¿Quieres vender tus cursos con tu propia marca y cobrar en México sin pagar comisión a una plataforma? Armé un kit con el código completo de una academia online: tienda con Stripe, Mercado Pago y PayPal, aula virtual con video, evaluaciones y notas, certificados con QR verificables, tutor con IA y panel de administración con ventas y embudo por curso. Incluye guía de instalación en español; si prefieres, te la dejo funcionando con tu dominio. 👇 https://octavius724.gumroad.com/l/kit-academia-online #Emprendedores #CursosOnline #Nextjs»
  - X: «Kit de código: tu academia online con tu marca. Pagos con Stripe, Mercado Pago y PayPal, aula virtual, certificados con QR, tutor IA y panel admin. Next.js + Supabase, guía en español 👇 https://octavius724.gumroad.com/l/kit-academia-online»
- [ ] Demo en vivo (aumentaría ventas): requiere un proyecto de Supabase en la nube del usuario para desplegar en Vercel
- [ ] Despliegue (Vercel + Supabase en la nube) — requiere cuentas/credenciales del usuario

## Ventas (agente)
- Gumroad: 25+ productos publicados; 0 ventas en noviembre (revisado 2026-11-26 07:55 UTC). BLACKFRIDAY activado por aprobación del usuario: 40 % solo en el Kit de WhatsApp, del 26-nov al 1-dic 23:59 CDMX.
- Buffer "My organization": LinkedIn 7 y X 7 publicaciones programadas (revisado 2026-11-26 07:55 UTC), cola hasta el 2026-12-02; no hizo falta programar más. Entre 19:51 y 19:53 UTC aparecieron 4 publicaciones nuevas (guía gratis de precios y blog calculatunegocio) que no programó este agente. Verificado: el Paquete Fiestas cuesta $12 (los productos por separado suman $19), así que esa publicación es correcta. La de LinkedIn del 27-nov (16:17 UTC) anuncia 40 % con el código BLACKFRIDAY, que la última vez estaba inactivo; no hay herramienta para listar códigos, así que el usuario debe confirmar que esté activo.
- Pinterest casi sin uso: oportunidad para imprimibles (lotería, planners, menú) con portada del producto.

## Bloqueado por el usuario
- Subir `academia-online-kit.zip` **v1.2 (754 KB)** al producto «Kit Academia Online» en Gumroad (Contenido → Subir archivo) y publicarlo (o avisar para que el agente lo publique). Si ya se descargó una versión anterior (713 o 736 KB), usar la nueva.
- Aprobar agregar a la descripción del producto en Gumroad las viñetas de «Preguntas y respuestas por lección», «Bandeja de preguntas» y «Avisos del curso» (la herramienta pide confirmación del creador para editar la descripción).
- El repositorio de GitHub `agente-de-ia-` es PÚBLICO: cualquiera puede ver el código del kit gratis. Recomendado hacerlo privado antes de vender (Settings → General → Danger Zone → Change visibility). Las portadas de Gumroad ya quedaron copiadas en Gumroad.
- Pinterest: la cuenta conectada en Buffer no tiene tableros. Crea al menos un tablero (p. ej. "Imprimibles para fiestas") para poder programar pines.
- Credenciales de producción: Supabase (proyecto en la nube), Stripe, Mercado Pago, PayPal, Resend, Anthropic.
- Dominio y cuenta de hosting para desplegar.
