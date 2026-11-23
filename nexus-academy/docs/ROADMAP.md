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

## Siguiente (en orden)
- [ ] Certificados: botón «Agregar a LinkedIn» (enlace oficial add-to-profile con nombre, emisor, fecha, ID y URL de verificación)
- [ ] Despliegue (Vercel + Supabase en la nube) — requiere cuentas/credenciales del usuario

## Ventas (agente)
- Gumroad: 25+ productos publicados; 0 ventas desde 2026-10-01 (revisado 2026-11-23 08:55 UTC).
- Buffer "My organization": LinkedIn, X y Pinterest. Cola programada hasta el 2026-12-01.
- Pinterest casi sin uso: oportunidad para imprimibles (lotería, planners, menú) con portada del producto.

## Bloqueado por el usuario
- Pinterest: la cuenta conectada en Buffer no tiene tableros. Crea al menos un tablero (p. ej. "Imprimibles para fiestas") para poder programar pines.
- Credenciales de producción: Supabase (proyecto en la nube), Stripe, Mercado Pago, PayPal, Resend, Anthropic.
- Dominio y cuenta de hosting para desplegar.
