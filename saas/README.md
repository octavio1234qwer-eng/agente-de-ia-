# ImpulsaIA: plataforma SaaS de herramientas de IA para pymes en México

MVP funcional de una plataforma de suscripción con herramientas de inteligencia artificial para negocios pequeños y profesionistas independientes en México. Incluye registro de usuarios, plan gratuito y planes de pago, suscripciones mensuales con Stripe en pesos mexicanos, límites de uso por créditos, historial, panel de administración con estadísticas y documentación de instalación y despliegue.

> "ImpulsaIA" es un nombre de ejemplo. Cámbialo con la variable `APP_NAME` (correos y páginas) y en los textos de `public/`.

## Qué problema resuelve

Cada herramienta ataca una tarea repetitiva que le cuesta tiempo o ventas a una pyme. El análisis completo, con hipótesis de precio y cómo validarlas, está en [docs/PRODUCTO.md](docs/PRODUCTO.md).

| Herramienta | Problema | Plan |
|---|---|---|
| Respuestas a clientes | WhatsApp y mensajes sin contestar a tiempo = ventas perdidas | Gratis |
| Respuesta a reseñas | Reseñas negativas sin respuesta en Google Maps | Gratis |
| Fichas de producto | Publicaciones de Mercado Libre/Amazon que no convierten | Gratis |
| Correos profesionales | Comunicación desordenada con clientes y proveedores | Gratis |
| Contenido para redes | Falta de constancia en Instagram, Facebook, TikTok | Pro |
| Cotizaciones y propuestas | Cotizaciones improvisadas que pierden contra la competencia | Pro |
| Mensajes de cobranza | Cuentas por cobrar y miedo a "sonar grosero" | Pro |
| Resumen de documentos | Contratos y minutas largas que nadie lee completas | Pro |

## Funciones

- **Cuentas**: registro con correo y contraseña, confirmación de correo, recuperación de contraseña, cambio de contraseña, edición de perfil, exportación de datos y eliminación de cuenta (derechos ARCO).
- **Planes**: Gratis (25 créditos), Pro ($199 MXN/mes, 500 créditos) y Negocio ($499 MXN/mes, 2,000 créditos), configurables por variables de entorno. Cada plan define créditos, caracteres por solicitud, herramientas disponibles y días de historial.
- **Pagos**: Stripe Checkout para suscribirse, portal de cliente de Stripe para cambiar de plan, actualizar tarjeta o cancelar, webhooks firmados e idempotentes, aviso por correo si falla un cobro. Asignación manual de planes desde el panel para pagos por transferencia u OXXO.
- **Límites de uso**: créditos mensuales que se reservan de forma atómica antes de llamar a la IA y se devuelven si la IA falla; límite de caracteres por plan; límite de peticiones por minuto por usuario; límites contra fuerza bruta en el inicio de sesión y los correos.
- **IA**: proveedores intercambiables (OpenAI Responses API, Anthropic Messages API o modo demostración sin costo), prompts con reglas para no inventar datos y separar los datos del usuario de las instrucciones.
- **Panel de administración**: ingreso recurrente mensual (MRR), cobros, usuarios nuevos, conversión, cancelaciones, generaciones por día, herramientas más usadas, tokens y costo estimado de IA; búsqueda de usuarios, cambio de plan, suspensión, rol de administrador, reinicio de créditos; pagos y bitácora de auditoría.
- **Interfaz**: sitio público con precios, páginas de acceso, panel del usuario y panel de administración. Es responsiva, está en español de México y no usa librerías ni recursos externos.

## Arranque rápido (desarrollo)

Requisitos: Node.js 20.12 o superior (recomendado 22). No necesitas instalar PostgreSQL para desarrollar.

```bash
cd saas
npm install
cp .env.example .env        # En Windows PowerShell: Copy-Item .env.example .env
npm run dev
```

Abre http://localhost:3000 y crea una cuenta. Sin SMTP configurado, el enlace para confirmar el correo aparece en la consola. Para entrar al panel de administración, agrega tu correo a `ADMIN_EMAILS` en `.env` antes de confirmarlo, o ejecuta:

```bash
npm run admin:promote -- tu-correo@ejemplo.com
```

Con `AI_PROVIDER=mock` las herramientas devuelven un texto de demostración. Para resultados reales configura `AI_PROVIDER`, `AI_MODEL` y la clave correspondiente. La guía paso a paso, que incluye pagos de prueba con Stripe, está en [docs/INSTALACION.md](docs/INSTALACION.md).

## Despliegue

- **Render** (más sencillo): el repositorio incluye `render.yaml` en la raíz para crear la app y PostgreSQL con un Blueprint.
- **Docker / VPS**: `Dockerfile` y `docker-compose.yml` con PostgreSQL 16.
- Lista de verificación para salir a producción y activar los cobros reales con Stripe.

Todo esto está en [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md).

## Arquitectura

```
Navegador (HTML + JS sin frameworks, CSP estricta)
   │  cookie de sesión HttpOnly, JSON same-origin
   ▼
Express 5 (Node.js) ── sin estado: se pueden correr varias instancias
   ├── /api/auth, /api/account   cuentas, sesiones, tokens de un solo uso
   ├── /api/tools, /api/generations   herramientas, créditos, historial
   ├── /api/billing, /api/webhooks/stripe   Checkout, portal, webhooks
   ├── /api/admin   estadísticas, usuarios, pagos, auditoría
   └── public/   sitio, app y panel de administración
   │
   ├── PostgreSQL: usuarios, sesiones, suscripciones, pagos, créditos, historial, límites de peticiones y auditoría
   ├── Proveedor de IA: OpenAI o Anthropic (intercambiable)
   ├── Stripe: cobros recurrentes en MXN
   └── SMTP: confirmación de correo, recuperación de contraseña y avisos de cobro
```

Decisiones clave:

- **Sin estado en memoria**: sesiones, créditos y límites de peticiones viven en PostgreSQL, así que puedes escalar horizontalmente detrás de un balanceador.
- **Créditos atómicos**: un único `INSERT … ON CONFLICT … WHERE used + costo <= límite` evita que peticiones simultáneas rebasen el plan. Está probado con peticiones en paralelo.
- **Stripe como fuente de verdad**: cada webhook vuelve a consultar la suscripción, así que el orden en que llegan los eventos no importa. Los eventos se registran para procesarse una sola vez.
- **Herramientas declarativas**: cada herramienta es un objeto en `src/ai/tools.js` (campos, costo, prompt). El formulario, la validación y los límites se generan solos. Para agregar una herramienta no hay que tocar la interfaz.
- **Migraciones SQL** versionadas en `migrations/`, aplicadas al iniciar con un candado para que dos instancias no migren al mismo tiempo.

## Estructura

```
saas/
├── src/
│   ├── server.js            arranque, migraciones, apagado ordenado
│   ├── app.js               ensamblado de Express (inyección de dependencias)
│   ├── config.js            variables de entorno validadas
│   ├── plans.js             catálogo de planes
│   ├── ai/                  catálogo de herramientas y proveedores de IA
│   ├── db/                  adaptador PostgreSQL/PGlite y migrador
│   ├── middleware/          sesión, CSRF, cabeceras de seguridad, errores
│   ├── routes/              auth, account, tools, billing, admin
│   └── services/            usuarios, sesiones, créditos, Stripe, correo, estadísticas, mantenimiento
├── public/                  sitio, app y panel (HTML, CSS y JS)
├── migrations/              esquema SQL
├── scripts/                 migrar, crear administrador, configurar Stripe
├── test/                    pruebas de integración y unitarias
└── docs/                    producto, instalación, despliegue y seguridad
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor con recarga automática |
| `npm start` | Servidor en modo normal |
| `npm test` | Pruebas (PGlite en memoria; con `TEST_DATABASE_URL` usa PostgreSQL real) |
| `npm run migrate` | Aplica migraciones pendientes |
| `npm run admin:promote -- correo` | Convierte a un usuario en administrador |
| `npm run stripe:setup` | Crea en Stripe los productos y precios mensuales en MXN |

## Seguridad

Contraseñas con scrypt, sesiones con token aleatorio guardado como hash y cookie `__Host-` HttpOnly/Secure/SameSite, protección CSRF por origen, CSP estricta sin scripts en línea, validación de cada entrada con zod, consultas parametrizadas, límites de peticiones, webhooks firmados, bitácora de auditoría y el contenido de los usuarios fuera de los logs y del panel de administración. El detalle está en [docs/SEGURIDAD.md](docs/SEGURIDAD.md).

## Limitaciones conocidas del MVP

- Sin doble factor de autenticación ni inicio de sesión con Google.
- Sin cuentas de equipo (varios usuarios por negocio).
- La IA responde dentro de la petición HTTP (hasta 60 s). Con mucho tráfico conviene una cola de trabajos.
- La factura fiscal (CFDI) se atiende por correo; la integración con un PAC está en el plan de trabajo de [docs/PRODUCTO.md](docs/PRODUCTO.md).
- Los textos legales (`/privacidad`, `/terminos`) son plantillas que debe revisar un abogado.
