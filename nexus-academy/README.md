# NEXUS ACADEMY

**Aprende hoy. Domina el mañana.** Plataforma educativa completa: catálogo, cuentas, aula virtual con tutor de IA, pagos reales (Stripe, Mercado Pago, PayPal), certificados verificables, correos automáticos y panel de administración.

> Estado: el producto funciona de punta a punta en local y pasa todas sus pruebas. Para operar en producción solo faltan las **credenciales de tus cuentas** (Supabase en la nube, proveedores de pago, Resend y Anthropic) y el despliegue. Este documento explica exactamente cómo activarlas.

---

## 1. Arquitectura

```
Navegador ──► Next.js 16 (App Router, Server Components, Server Actions)
                │   proxy.ts: refresca sesión y protege /cuenta, /aprender, /admin, /checkout…
                │
                ├─► Supabase Postgres (RLS en las 30 tablas; funciones SECURITY DEFINER)
                ├─► Supabase Auth (registro, login, recuperación con token_hash)
                ├─► Supabase Storage (portadas públicas; videos y materiales PRIVADOS con URL firmada)
                │
                ├─► Stripe Checkout ─┐
                ├─► Mercado Pago ────┼─► webhooks firmados ─► fulfill_order() ─► acceso + correo
                ├─► PayPal Orders ───┘
                ├─► Resend (correos transaccionales y de marketing con baja firmada)
                └─► Claude (NEXUS AI, streaming, contexto de la lección vía RLS)
Vercel Cron ──► /api/cron/* (recordatorios, carritos abandonados, pedidos vencidos)
```

Principios:

- **El dinero lo confirma el proveedor, nunca el navegador.** El acceso solo se activa dentro de `fulfill_order()` (Postgres, solo `service_role`), llamado desde webhooks con firma verificada o tras consultar la API del proveedor. Compara importe y moneda con la orden; si no coinciden, no da acceso y deja la orden para revisión.
- **Idempotencia**: cada evento de proveedor se registra en `payment_events`; confirmar dos veces no duplica nada.
- **Contenido protegido en la base de datos**: el temario es público, pero `lesson_contents`, recursos y respuestas de evaluaciones solo se leen con acceso (RLS). Las respuestas correctas nunca salen del servidor antes de enviar la evaluación.
- **Sin datos inventados**: estadísticas, rankings y opiniones se calculan de datos reales; si no hay, la interfaz lo dice.
- **Sin simulaciones**: si falta una credencial, la función queda desactivada y la interfaz lo comunica (p. ej. NEXUS AI responde 503 explicando que falta la clave; los correos se registran como «omitidos»).

### Estructura

```
nexus-academy/
├─ src/
│  ├─ app/
│  │  ├─ (site)/            sitio público, auth, cuenta, carrito, checkout, certificados, legales
│  │  ├─ aprender/          aula virtual (layout propio)
│  │  ├─ admin/             panel de administración (requiere rol admin)
│  │  ├─ api/               webhooks, IA, cron, recursos, PDF de certificados
│  │  └─ auth/              confirmación de correo / recuperación
│  ├─ components/           ui, layout, course, classroom, checkout, account, admin, home
│  ├─ lib/
│  │  ├─ actions/           Server Actions (auth, commerce, learning, profile, admin)
│  │  ├─ commerce/          precios y cupones (función pura), checkout, confirmación, verificación
│  │  ├─ payments/          Stripe, Mercado Pago, PayPal
│  │  ├─ email/             plantillas, envío (Resend), automatizaciones, tokens de baja
│  │  ├─ ai/                NEXUS AI (Claude)
│  │  ├─ certificates/      PDF con QR
│  │  ├─ data/              consultas de lectura
│  │  ├─ supabase/          clientes (servidor, navegador, service_role, proxy)
│  │  └─ auth.ts, env.ts    capa de acceso a datos y configuración
│  └─ proxy.ts
├─ supabase/
│  ├─ migrations/           esquema, funciones, RLS, storage
│  ├─ seed/catalog.mjs      catálogo inicial (fuente) → seed.sql
│  ├─ templates/            correos de Supabase Auth
│  └─ tests/database/       pruebas pgTAP de seguridad
├─ tests/unit/              vitest
├─ e2e/                     pruebas de navegador e integración
├─ scripts/                 dev-up, create-admin, generate-seed
└─ vercel.json              tareas programadas
```

### Base de datos (resumen)

| Área | Tablas |
|---|---|
| Usuarios | `profiles` (rol: student / instructor / admin) |
| Catálogo | `categories`, `instructors`, `courses`, `modules`, `lessons`, `lesson_contents`, `lesson_resources`, `quiz_questions`, `bundles`, `bundle_courses` |
| Comercio | `coupons`, `coupon_redemptions`, `orders`, `order_items`, `payment_events`, `refunds`, `carts`, `cart_items` |
| Aprendizaje | `enrollments`, `lesson_progress`, `quiz_attempts`, `favorites`, `reviews`, `certificates` |
| Comunicación e IA | `newsletter_subscribers`, `email_log`, `ai_conversations`, `ai_messages`, `admin_audit_log` |

Funciones clave: `fulfill_order`, `record_refund`, `enroll_free_course`, `submit_quiz_attempt`, `get_quiz`, `issue_certificate` (automática al 100 %), `get_certificate_public`, `search_courses`, `admin_dashboard_stats`, `academy_public_stats`.

---

## 2. Desarrollo local

Requisitos: Node 20+, Docker.

```bash
cd nexus-academy
npm install
npm run dev:up            # Docker + Supabase local + Next (crea .env.local con claves locales)
node scripts/create-admin.mjs tu@correo.com UnaClaveSegura123
```

- Sitio: http://localhost:3000 · Panel: http://localhost:3000/admin
- Correos de prueba de Supabase Auth: http://127.0.0.1:54324
- Reiniciar base con el catálogo inicial: `npx supabase db reset`
- Regenerar `seed.sql` tras editar `supabase/seed/catalog.mjs`: `npm run seed:generate`

### Pruebas

| Comando | Qué prueba | Resultado |
|---|---|---|
| `npm run typecheck` | TypeScript estricto | ✔ |
| `npx eslint .` | Lint | ✔ |
| `npm test` | 29 unitarias: precios, cupones, firmas de Stripe y Mercado Pago, búsqueda, exportación de notas | 29/29 |
| `npm run test:db` | 79 pgTAP: RLS, roles, pagos idempotentes, reembolsos, certificados, búsqueda solo en cursos con acceso, notas privadas | 79/79 |
| `node e2e/auth-account.mjs` | Registro, inscripción, favoritos, perfil, sesión, recuperación por correo | ✔ |
| `node e2e/payments.mjs` | Webhook firmado → pago → acceso; repetición; firma falsa; importe alterado; cupón 100 % | 10/10 |
| `node e2e/classroom.mjs` | Lecciones bloqueadas, vista previa, progreso, evaluación, certificado, PDF, IA sin clave | 17/17 |
| `node e2e/admin.mjs` | Rol, curso + temario + subidas, acceso otorgado, cupón, reembolso, auditoría | 24/24 |
| `node e2e/video-upload.mjs` | Subida reanudable de video (pausa y reanudación), bucket privado, URL firmada | 7/7 |
| `node e2e/markdown-editor.mjs` | Editor con barra de formato y vista previa, sin XSS, mismo render en el aula | 8/8 |
| `node e2e/lesson-search.mjs` | Búsqueda en lecciones: raíz en español, sin acentos, por prefijo, identificadores de código, nada de cursos no comprados, resaltado dentro de la lección, móvil | 29/29 |
| `node e2e/lesson-notes.mjs` | Notas privadas por lección: guardar, Ctrl+Enter, límite, «Mis notas», descarga .md, privacidad (otro alumno y sin sesión), borrar, móvil | 28/28 |
| `node e2e/links.mjs` | Enlaces internos rotos | 0 |
| `npx next build` | Build de producción | ✔ |

`e2e/payments.mjs` necesita en `.env.local` claves de prueba **locales** (`STRIPE_SECRET_KEY=sk_test_dummy…`, `STRIPE_WEBHOOK_SECRET=whsec_test…`): la firma del webhook se genera y verifica localmente, sin llamar a Stripe.

**Lo que NO se pudo probar sin tus credenciales** (el código está listo y sigue la documentación oficial de cada API): creación real de sesiones de Stripe Checkout, preferencias y consulta de pagos de Mercado Pago, creación/captura/verificación de PayPal, envío real con Resend y respuestas reales de Claude. Prueba cada uno en modo sandbox con la guía de la sección 4 antes de cobrar.

---

## 3. Despliegue en producción

### 3.1 Supabase (base de datos, auth y archivos)

1. Crea un proyecto en https://supabase.com (región cercana a tus alumnos).
2. Aplica el esquema:
   ```bash
   npx supabase login
   npx supabase link --project-ref TU_PROJECT_REF
   npx supabase db push            # aplica supabase/migrations
   ```
3. (Opcional) Carga el catálogo inicial: ejecuta `supabase/seed.sql` en el SQL Editor. Reemplaza después los equipos docentes por tus instructores reales.
4. **Authentication → URL Configuration**: *Site URL* = `https://tu-dominio.com`; *Redirect URLs* = `https://tu-dominio.com/**`.
5. **Authentication → Email Templates**: copia `supabase/templates/confirmation.html` (Confirm signup) y `supabase/templates/recovery.html` (Reset password).
6. **Authentication → Providers → Email**: activa *Confirm email*.
7. **Authentication → SMTP**: configura Resend como SMTP (host `smtp.resend.com`, puerto 465, usuario `resend`, contraseña = tu API key) para que los correos de Supabase salgan de tu dominio.
8. **Storage**: los buckets se crean con la migración. Los videos se suben en partes reanudables (TUS), pero el tamaño máximo por archivo lo fija tu plan (50 MB en el gratuito); súbelo en *Storage → Settings* (plan Pro) o usa YouTube no listado / Vimeo desde el editor de lecciones.
9. Copia de *Project Settings → API*: URL, `anon`/publishable key y `service_role` key.

### 3.2 Vercel

1. Importa el repositorio y define **Root Directory = `nexus-academy`**.
2. Variables de entorno (Production): todas las de `.env.example`. Como mínimo:
   `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `UNSUBSCRIBE_SECRET` (genera los dos últimos con `openssl rand -hex 32`).
3. Despliega. `vercel.json` programa las tareas diarias (Vercel envía `Authorization: Bearer CRON_SECRET`). En el plan Pro puedes cambiar `abandoned-carts` a cada hora.
4. Conecta tu dominio y actualiza `NEXT_PUBLIC_SITE_URL`.
5. Crea tu administrador: `NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/create-admin.mjs tu@correo.com`.

---

## 4. Activar cada integración

Ninguna clave va en el código ni en el navegador. Agrégalas como variables de entorno del servidor y vuelve a desplegar. El panel (`/admin`) muestra el estado de cada integración.

### Stripe (tarjetas)
1. Dashboard → Developers → API keys → copia la **Secret key** → `STRIPE_SECRET_KEY` (usa `sk_test_…` para pruebas).
2. Developers → Webhooks → *Add endpoint*: `https://tu-dominio.com/api/webhooks/stripe` con los eventos:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`.
3. Copia el *Signing secret* → `STRIPE_WEBHOOK_SECRET`.
4. Prueba: compra con la tarjeta `4242 4242 4242 4242`; el pedido debe pasar a *Pagado* en `/admin/pedidos`.

### Mercado Pago (México)
1. Tus integraciones → crea una aplicación (Checkout Pro) → **Access Token** → `MERCADOPAGO_ACCESS_TOKEN`.
2. Webhooks → URL `https://tu-dominio.com/api/webhooks/mercadopago`, evento **Pagos**. Copia la **clave secreta** → `MERCADOPAGO_WEBHOOK_SECRET` (se usa para validar `x-signature`).
3. Prueba con usuarios y tarjetas de prueba de Mercado Pago. La plataforma consulta siempre el pago en la API antes de dar acceso.

### PayPal
1. developer.paypal.com → Apps & Credentials → crea una app → `PAYPAL_CLIENT_ID` y `PAYPAL_CLIENT_SECRET`; `PAYPAL_ENV=sandbox` (o `live`).
2. En la app → Webhooks → URL `https://tu-dominio.com/api/webhooks/paypal` con los eventos:
   `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.DECLINED`, `PAYMENT.CAPTURE.REFUNDED`.
3. Copia el **Webhook ID** → `PAYPAL_WEBHOOK_ID` (la firma se verifica con la API de PayPal).
4. Verifica que tu cuenta acepte MXN.

### Resend (correo)
1. resend.com → Domains → agrega y verifica tu dominio (registros DNS).
2. API Keys → `RESEND_API_KEY`. `EMAIL_FROM="NEXUS ACADEMY <hola@tu-dominio.com>"` y opcional `EMAIL_REPLY_TO`.
3. Se activan: bienvenida, compra confirmada + acceso, certificado, recuperación de contraseña con marca, recordatorios, carritos abandonados, anuncios de cursos y campañas (desde `/admin/correos`). Todo queda en `email_log`.

### NEXUS AI (Claude)
1. console.anthropic.com → API Keys → `ANTHROPIC_API_KEY`.
2. `ANTHROPIC_MODEL` (por defecto `claude-opus-5-5`) y `AI_DAILY_MESSAGE_LIMIT` (por defecto 60 mensajes por alumno cada 24 h).
3. El tutor recibe el contenido de la lección solo si el alumno tiene acceso (RLS) y el catálogo real para recomendar; usa caché de prompts y respaldo automático ante rechazos.

---

## 5. Seguridad implementada

- RLS en todas las tablas, privilegios por columna (un alumno no puede cambiar su rol ni la moderación de su reseña).
- Rutas privadas protegidas en `proxy.ts` y verificadas de nuevo en el servidor (DAL) y en cada Server Action.
- Webhooks con firma verificada (Stripe, `x-signature` de Mercado Pago con ventana anti-replay, API de verificación de PayPal) e idempotentes.
- Precios y descuentos calculados en el servidor; prevención de compras duplicadas.
- Videos y materiales en buckets privados con URLs firmadas de corta duración.
- Cabeceras de seguridad (CSP, X-Frame-Options, nosniff, HSTS), redirecciones `next` saneadas, Markdown sin HTML crudo (sin XSS).
- Respuestas genéricas en recuperación de contraseña (sin enumerar cuentas) y límite de reenvíos.
- Auditoría de acciones administrativas en `admin_audit_log`.
- Nunca se almacenan datos de tarjetas.

## 6. Pendientes conocidos

- Las páginas legales son plantillas: complétalas con tu razón social y correo de contacto y revísalas con un asesor.
- La emisión de CFDI no está automatizada: se guardan RFC y razón social en el pedido para facturar desde tu sistema.
- Subidas de video limitadas por el plan de Supabase (ver 3.1.8).
