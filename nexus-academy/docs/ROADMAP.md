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

## Siguiente (en orden)
- [ ] Paquetes `/paquetes`, instructores `/instructores`
- [ ] Carrito y checkout (cupones, RFC opcional), páginas de éxito/cancelado con verificación vía API del proveedor
- [ ] Webhooks: Stripe, Mercado Pago, PayPal (+ retorno de PayPal) con pruebas de firma
- [ ] Aula virtual `/aprender/[slug]/[lessonId]`: video, temario, progreso, completar, recursos, cuestionarios, reseña
- [ ] NEXUS AI: `/api/ai/chat` (streaming, límite diario) + panel en el aula + página `/nexus-ai`
- [ ] Certificados: `/certificados/[code]`, `/verificar`, PDF con QR
- [ ] Panel admin: dashboard con gráficas, cursos (CRUD + temario + subidas), categorías, instructores, alumnos, pedidos/reembolsos, cupones, paquetes, reseñas, correos
- [ ] Automatizaciones: `/api/cron/*` (recordatorios, carritos abandonados) + `vercel.json`
- [ ] Páginas legales: términos, privacidad, reembolsos; `/baja` (darse de baja)
- [ ] Pruebas: unitarias (vitest: precios, firmas de webhooks), E2E (Playwright), build de producción
- [ ] README con arquitectura y guía exacta de activación de credenciales
- [ ] Despliegue (Vercel + Supabase en la nube) — requiere cuentas/credenciales del usuario

## Ventas (agente)
- Gumroad: 25+ productos publicados; 0 ventas desde 2026-10-01 (revisado 2026-11-23).
- Buffer "My organization": LinkedIn, X y Pinterest. Cola programada hasta el 2026-12-01.
- Pinterest casi sin uso: oportunidad para imprimibles (lotería, planners, menú) con portada del producto.

## Bloqueado por el usuario
- Pinterest: la cuenta conectada en Buffer no tiene tableros. Crea al menos un tablero (p. ej. "Imprimibles para fiestas") para poder programar pines.
- Credenciales de producción: Supabase (proyecto en la nube), Stripe, Mercado Pago, PayPal, Resend, Anthropic.
- Dominio y cuenta de hosting para desplegar.
