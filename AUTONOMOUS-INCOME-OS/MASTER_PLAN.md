# MASTER PLAN: AUTO-INCOME AI

Plan maestro de construcción. Lo que ya existe y lo que falta está en `PROJECT_STATE.md`.

## 1. Auditoría del entorno (Fase 1, 26-nov-2026)

### Qué hay en el repositorio
| Activo | Estado verificado |
|---|---|
| `server.mjs` (raíz) | Agente de WhatsApp para un restaurante. Proyecto aparte, no se toca. |
| `fabrica-productos/` | Fábrica en Python: QA, aprobación y publicación en Gumroad. 4 productos de esa fábrica están publicados. |
| Tienda Gumroad `octavius724` | 25+ productos publicados. **Ventas del 1-ene al 26-nov-2026: 0 unidades, 0 USD** (consultado en la API de Gumroad). |
| Vercel (equipo `octavio17`) | 26 proyectos estáticos. Uno es `cotizafacil` (cotizafacil-nu.vercel.app): versión 0 estática con desbloqueo "Pro" por hash en el navegador. Web Analytics está desactivado, así que no hay datos de visitas. |
| Repositorio GitHub | **Público.** Nunca debe contener secretos, datos de clientes ni registros financieros. |

### Herramientas disponibles en el contenedor de construcción
Node 22, npm 10, Python 3.13, cliente `psql` (sin servidor), Docker (cliente), Chromium y Playwright. Hay salida a npm y a internet por proxy.

### Conclusión de la auditoría
El problema actual **no es la falta de productos sino la falta de tráfico y de validación**: hay 25 productos y 0 ventas. Por eso este plan:
1. No crea más productos hasta validar uno.
2. Mide desde el primer día: analítica propia, embudo y conversión.
3. Concentra el esfuerzo en un solo negocio, CotizaFácil MX, con un uso gratuito que genera tráfico recurrente y una mejora de pago.

## 2. Decisiones de arquitectura

| Decisión | Elección | Motivo |
|---|---|---|
| Lenguaje | TypeScript estricto | Requisito del proyecto; tipos compartidos entre cliente y servidor. |
| Framework | Next.js 16 (App Router), una sola app | Un solo despliegue gratuito. `command-center`, `storefront` y `customer-portal` son grupos de rutas de la misma app (ver `docs/ARCHITECTURE.md`). |
| Base de datos | PostgreSQL. Producción: Neon Free (1 GB, sin tarjeta). Desarrollo y pruebas: PGlite (Postgres real en WASM) | Mismo motor en pruebas y en producción. Neon no pausa el proyecto por inactividad; solo duerme el cómputo. |
| Pagos | Mercado Pago (Checkout Pro + suscripciones `preapproval`) | Requisito. Acepta tarjeta, OXXO y SPEI en México. |
| Programador de tareas | GitHub Actions cada 15 min → `POST /api/cron/tick` | Gratis en repositorios públicos; no depende del iPhone ni del proveedor de hosting. |
| Cola de tareas | Tabla `tasks` en Postgres con `FOR UPDATE SKIP LOCKED` | Sin servicios extra; idempotente y con reintentos limitados. |
| IA | Adaptador con proveedor `none` por defecto | El presupuesto es 0. Los agentes son deterministas y la IA es opcional. Un proveedor de pago se bloquea si el límite de gasto es 0. |
| Correo | Adaptador Resend (HTTP) o `none` | Plan gratuito de 3,000 correos al mes. Sin proveedor, el acceso se muestra en la página de confirmación y nada se finge como enviado. |
| Alertas al administrador | Panel + Telegram Bot (opcional, gratis) | Notificación push al iPhone sin costo. |
| Hosting | Netlify Free (permite uso comercial) | **Vercel Hobby prohíbe el uso comercial** según sus reglas de uso justo. La app no usa APIs propias de ningún proveedor. |
| Validación | zod | Una sola librería para validar todas las entradas. |
| PDF | pdf-lib, en el navegador | Funciona sin conexión y en iPhone; no consume funciones del servidor. |
| Pruebas | Vitest + PGlite + Playwright | Pruebas unitarias e integrales contra Postgres real, y pruebas de extremo a extremo en Chromium. |

Dependencias de producción (7): `next`, `react`, `react-dom`, `pg`, `@electric-sql/pglite`, `zod`, `pdf-lib`. No se agrega ninguna otra sin justificarla en este documento.

## 3. Módulos

| Módulo | Ubicación | Qué hace |
|---|---|---|
| Command Center | `src/app/(command-center)/admin` | Panel móvil: ingresos, pedidos, aprobaciones, agentes, automatizaciones, alertas, finanzas e interruptor general. |
| Agent Orchestrator | `src/server/orchestrator` | Cola, ejecución con tiempo limitado, permisos, profundidad máxima y registro de ejecuciones. |
| Research Engine | `agents/research`, `src/server/research` | Oportunidades con evidencia fechada y URL. Si una dimensión no tiene evidencia, no recibe puntuación. |
| Product Factory | `agents/product`, `src/server/catalog.ts` | Checklist de QA, revisión de derechos y aprobación humana antes de publicar. |
| Marketing Engine | `agents/marketing`, `businesses/*/content` | Borradores de contenido. Publicar requiere aprobación. |
| Sales Engine | `src/server/leads.ts`, `agents/sales` | Prospectos con consentimiento explícito, secuencias con baja en un clic, métricas de embudo. |
| Payment Engine | `src/server/payments` | Preferencias, suscripciones, webhook firmado, verificación contra la API, idempotencia y reembolsos con aprobación. |
| Delivery Engine | `src/server/delivery` | Licencia y acceso seguro **solo** después de confirmar el pago con Mercado Pago. |
| Finance Engine | `src/server/finance` | Libro de movimientos: cobrado, liquidado y neto. Los pagos de prueba están separados. |
| Auditor Engine | `agents/auditor`, `src/server/auditor` | Cadena de hashes del registro de auditoría, anomalías y pausa automática. |

## 4. Fases

| Fase | Entregable | Criterio de salida |
|---|---|---|
| 1 | Auditoría y plan | Este documento + `PROJECT_STATE.md`. |
| 2 | Estructura | Árbol de carpetas, configuración y documentación base. |
| 3 | Base de datos y autenticación | Migraciones probadas en PGlite; login con scrypt, bloqueo por intentos, TOTP opcional. |
| 4 | Command Center | Todas las pantallas del panel conectadas a datos reales. |
| 5 | CotizaFácil MX | Herramienta gratuita completa, PDF y pruebas del motor de cálculo. |
| 6 | Sistema comercial | Landing, precios, captación con consentimiento, analítica propia. |
| 7 | Pagos | Checkout, webhook firmado, verificación, idempotencia y pruebas con respuestas simuladas. |
| 8 | Entrega | Licencias, portal del cliente, funciones Nube. Pruebas. |
| 9 | Agentes | 9 agentes con permisos, límites y registro. |
| 10 | Automatizaciones | `tick`, calendario de tareas, GitHub Actions y recuperación. |
| 11 | Seguridad y pruebas | Pruebas de permisos, firmas, rate limiting, e2e y build. |
| 12 | Despliegue supervisado | Guía paso a paso. **Requiere las cuentas del administrador.** |
| 13 | Validación comercial | Requiere usuarios reales. Métrica: primeros 10 usuarios activos por semana y la primera venta verificada. |
| 14 | Nuevos negocios | Bloqueada hasta validar CotizaFácil (ver criterios en `ROADMAP.md`). |

## 5. Hipótesis de negocio de CotizaFácil MX (sin validar)

Evidencia recopilada el 26-nov-2026 (fuentes en `businesses/cotizafacil-mx/product/research.md`):
- Existen competidores que cobran por esta función en México: Cotiza Pro (App Store, $49 MXN al mes o $499 al año), Facturama (paquetes anuales de $50 a $750 MXN), SpeedInvoice ($99 MXN al mes) y Zoho Books (plan gratis y planes desde $299 MXN al mes). Esto indica que hay disposición a pagar, pero también competencia.
- También hay generadores gratuitos (Stelorder, plantillas de Google Docs). El plan gratuito tiene que ser al menos igual de bueno.
- **No hay datos de volumen de búsqueda.** El sitio actual ya está verificado en Google Search Console: sus impresiones reales son la primera evidencia de demanda que debe revisar el administrador.

Precios iniciales como hipótesis: Pro con pago único de $149 MXN; Nube por $49 MXN al mes. Cambiarlos requiere aprobación.

## 6. Riesgos

| Riesgo | Mitigación |
|---|---|
| No llega tráfico (igual que con los 25 productos de Gumroad) | Herramienta gratuita útil, guías SEO, medición del embudo y canales comunitarios con mensajes aprobados. |
| Usar Vercel Hobby con fines comerciales viola sus reglas | Desplegar en Netlify Free o pasar a Vercel Pro con aprobación del gasto. También aplica a los proyectos actuales que venden en Gumroad. |
| Situación fiscal del vendedor sin definir | El sistema reserva un estimado de impuestos marcado como "pendiente de determinar"; antes de vender hay que consultarlo con un contador. |
| Mercado Pago cambia la firma de los webhooks | Se rechaza cualquier versión desconocida y siempre se consulta el pago en la API antes de entregar. |
| Pagos de prueba contados como ventas | `live_mode` se guarda en cada pago; los indicadores excluyen los pagos de prueba. |
