# AUTO-INCOME AI — MASTER PLAN

## Visión
Ecosistema de IA que crea, gestiona, comercializa, optimiza y expande negocios digitales desde un centro de control (AUTO-INCOME COMMAND CENTER), operable desde iPhone por un propietario con conocimientos técnicos limitados. Presupuesto inicial: **$0 MXN**. No se garantizan ingresos: se construyen sistemas que generan oportunidades reales de monetización con datos reales.

## Principios no negociables
1. Seguridad > funcionalidad > estabilidad > coste > usabilidad > escalabilidad > estética.
2. Ninguna métrica inventada. Sin datos → cero o estado vacío.
3. Dinero, datos sensibles, cambios irreversibles y comunicaciones externas **siempre** requieren aprobación.
4. Nada se marca terminado sin pruebas que lo verifiquen.
5. Integraciones de pago o de terceros detrás de interfaces, con modo alternativo/demo claramente identificado.
6. Ningún secreto en el frontend.

## Ubicación en el repositorio
El repo `agente-de-ia-` ya contenía el **agente de WhatsApp de La Casa de la Mantarraya** (raíz: `server.mjs`, desplegado en Render). AUTO-INCOME AI vive en `auto-income/` para no romper ese despliegue (ver DECISIONS D-001).

## Arquitectura (implementada)
```
auto-income/
  apps/
    api/        servidor HTTP node:http (API + worker del orquestador + estáticos)
    web/        (PENDIENTE) Command Center: React + Vite + Tailwind
  packages/
    shared/     dinero en centavos, validación de entradas, ids
    core/       pricing (margen/recargo), cotizaciones, scoring Business Factory, autonomía
    database/   SQLite nativo (node:sqlite), migraciones, auditoría, notificaciones
    agents/     orquestador de tareas + 10 agentes
    analytics/  métricas financieras, tráfico, dashboard
    security/   scrypt, tokens, HMAC webhooks, rate limit, roles/permisos
    integrations/ PaymentProvider (demo + HMAC genérico)
  tests/        node:test (unit + integración HTTP)
  docs/         FORMULAS.md, (pendiente) DEPLOYMENT.md, SECURITY.md
```
Backend: TypeScript ejecutado nativamente por Node ≥ 22.18 (type stripping), **cero dependencias de runtime**.

## Módulos y estado
| # | Módulo | Estado |
|---|---|---|
| 1 | Núcleo (dinero, validación, cálculos) | ✅ probado |
| 2 | Sistema de agentes (10 agentes, tareas deterministas reales) | ✅ probado (sin LLM aún) |
| 3 | Orquestador (cola, prioridad, deps, reintentos, idempotencia, aprobaciones, recuperación, límites) | ✅ probado |
| 4 | Niveles de autonomía 0–4 (inicial 2) | ✅ probado |
| 5 | API segura (auth, CSRF, roles, rate limit, auditoría) | ✅ probado |
| 6 | CotizaFácil MX backend (calculadoras, catálogo, cotizaciones, folios, WhatsApp) | ✅ probado |
| 7 | Product Studio backend (CRUD, versiones, QA, publicación con aprobación) | ✅ probado |
| 8 | CRM (clientes/prospectos, notas, exportar, eliminar) | ✅ probado |
| 9 | Analytics (finanzas reales, tráfico, top productos, periodos) | ✅ probado (tráfico sin prueba dedicada) |
| 10 | Monetización (PaymentProvider, demo, webhook HMAC idempotente) | ✅ probado |
| 11 | Base de conocimiento con acceso por agente y entradas bloqueadas | ✅ parcial (sin prueba de bloqueo) |
| 12 | Command Center web (UI) | ⏳ pendiente |
| 13 | CotizaFácil UI + PDF + página comercial | ⏳ pendiente |
| 14 | Integración LLM opcional (interfaz + modo sin IA) | ⏳ pendiente |
| 15 | Proveedor de pago real MX (Mercado Pago / Stripe / Gumroad) | ⏳ pendiente (requiere credenciales del propietario) |
| 16 | Despliegue reproducible gratuito | ⏳ pendiente |
| 17 | Growth Engine (embudos, experimentos) | ⏳ pendiente (solo ingesta de eventos + SEO/marketing básicos) |
| 18 | Reinvestment Engine | ✅ básico (recomendaciones en finance.report, sin ejecutar pagos) |

## Roadmap
- **Fase 1 (hecho):** backend completo y probado.
- **Fase 2:** UI web móvil (Command Center + CotizaFácil + PDF por impresión del navegador) servida por la misma API.
- **Fase 3:** despliegue gratuito con almacenamiento persistente verificado; health checks.
- **Fase 4:** interfaz LLM opcional; proveedor de pago real; Growth Engine (embudos/experimentos A/B).
- **Fase 5:** segundo negocio vía Business Factory con datos reales.

## Definición de éxito v1
App arranca · dashboard funciona · agentes con funciones reales · orquestador gestiona tareas · CotizaFácil funciona · productos se crean · CRM registra clientes · métricas reales · permisos funcionan · pruebas pasan · documentación completa · desplegable.
