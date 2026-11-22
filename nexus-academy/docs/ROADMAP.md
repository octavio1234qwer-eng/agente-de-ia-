# NEXUS ACADEMY · Hoja de ruta de trabajo

Lista viva que usa el agente programado ("Agente chambeador NEXUS", cada hora) para
saber qué sigue. Marcar `[x]` solo cuando esté construido **y probado**.

## Hecho
- [x] Esquema de base de datos (30 tablas), funciones de negocio, RLS, buckets de almacenamiento
- [x] Seed del catálogo (10 cursos, 46 lecciones, 26 preguntas, 2 paquetes) sin datos inventados
- [x] Pruebas pgTAP de seguridad: 46/46 (`npx supabase test db`)
- [x] Librerías de servidor: auth (DAL), precios/cupones, checkout, Stripe, Mercado Pago, PayPal, Resend, NEXUS AI (Claude), PDF de certificados — compilan (`tsc`)
- [x] Sistema de diseño, componentes base, navbar/footer, página principal (código escrito)

## Siguiente (en orden)
- [ ] Verificar que la página principal compile y se vea bien (dev server + captura)
- [ ] Catálogo `/cursos` con búsqueda, filtros (categoría, precio, nivel) y orden
- [ ] Página de curso `/cursos/[slug]` (temario, instructor, reseñas, compra/inscripción, favoritos)
- [ ] Paquetes `/paquetes`, instructores `/instructores`
- [ ] Auth: `/login`, `/registro`, `/recuperar`, `/restablecer`, `/auth/confirm`, `/auth/callback`
- [ ] Cuenta: perfil + foto, mis cursos, favoritos, compras, certificados, ajustes
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
- Gumroad: 25+ productos publicados; 0 ventas desde 2026-10-01 (al 2026-11-22).
- Buffer "My organization": LinkedIn, X y Pinterest. Cola programada hasta el 2026-12-01.
- Pinterest casi sin uso: oportunidad para imprimibles (lotería, planners, menú) con portada del producto.

## Bloqueado por el usuario
- Credenciales de producción: Supabase (proyecto en la nube), Stripe, Mercado Pago, PayPal, Resend, Anthropic.
- Dominio y cuenta de hosting para desplegar.
