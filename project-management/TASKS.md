# TASKS

## ✅ Completadas (verificadas con pruebas)
- [x] Inspección del entorno (Node 22.23, npm, node:sqlite, type stripping) — 2026-11-19
- [x] Estructura `auto-income/` + tsconfig + scripts
- [x] Núcleo: dinero en centavos, validación — `tests/core.test.ts`
- [x] Calculadoras margen/recargo/ganancia/punto de equilibrio — `tests/core.test.ts`
- [x] Motor de cotizaciones con IVA, descuentos, precios con IVA incluido, texto/enlace WhatsApp
- [x] Scoring Business Factory con niveles de evidencia
- [x] Política de autonomía 0–4
- [x] Esquema SQLite + migraciones (v1)
- [x] Orquestador: cola, prioridades, dependencias, reintentos/backoff, idempotencia, duplicados, aprobaciones, cancelación, recuperación, límite por hora, timeout — `tests/orchestrator.test.ts`
- [x] 10 agentes con tareas reales (ceo.review, ceo.launch_pipeline, research.evaluate_opportunity, product.create_spec/quality_check/publish, engineering.system_check, seo.keyword_plan/metadata, marketing.draft_posts, sales.score_leads/draft_proposal, support.answer, finance.report, qa.audit/block_task)
- [x] Analítica financiera real (demo y pendientes excluidos)
- [x] API: auth, CSRF, roles, rate limit, cabeceras, auditoría — `tests/api.test.ts`
- [x] API: negocios, agentes, tareas, Product Studio (versiones), CRM (exportar/eliminar), CotizaFácil, finanzas, analítica, conocimiento, notificaciones, búsqueda
- [x] Pagos: PaymentProvider, demo, webhook HMAC idempotente
- [x] Prueba de humo del servidor real (`npm start`, /health, calculadora)

- [x] Integración Gumroad (solo lectura) verificada con datos reales — 2026-11-22

- [x] Embudo Gumroad (regalo gratis + cupón + recibo) publicado y verificado — 2026-11-25
- [x] Borrador Product Hunt de The One Ad listo — 2026-11-25

## 🔄 En desarrollo
- Lanzamiento Product Hunt: espera confirmación del dueño para enviarse.
- (ninguna)

## ⏳ Pendientes (por prioridad)
1. **apps/web — Command Center UI** (React + Vite + Tailwind, oscuro azul/violeta, móvil primero): login/setup, dashboard, negocios, tareas/aprobaciones, agentes, notificaciones, búsqueda.
2. **CotizaFácil UI**: calculadoras, catálogo, editor de cotización, vista imprimible → PDF, botón WhatsApp, historial, plantillas premium, página comercial pública.
3. Product Studio UI, CRM UI, Analytics UI (periodos hoy/7/30/90/personalizado), Finanzas UI, Configuración (autonomía, agentes, usuarios), Centro de ayuda.
4. Pruebas faltantes: tráfico (`trafficSummary`), bloqueo de conocimiento `locked`, `qa.audit`, `seo.*`, `sales.*`, `ceo.launch_pipeline`.
5. Despliegue: `docs/DEPLOYMENT.md`, Dockerfile de `auto-income/`, verificar opción gratuita con disco persistente; backups SQLite.
6. Interfaz `LLMProvider` + modo sin IA + registro de coste real por tarea.
7. Proveedor de pago real compatible con México (requiere credenciales del propietario).
8. Growth Engine: embudos, experimentos A/B, atribución por canal.
9. Endpoint para editar `service_costs` (registro de costes en la app).
10. Integración de métricas de Buffer (impresiones/interacciones por canal) en Analytics.
11. Reporte de embudo en Analytics (descargas del regalo → ventas con GRACIAS20).
12. Pinterest: cuando el dueño cree tableros, programar pines de imprimibles con las portadas de Gumroad.
13. Limpieza del repo raíz: archivos `download*` subidos con nombre incorrecto (son `.dockerignore`, `.gitignore`, `.node-version` del agente Mantarraya) — confirmar con el propietario antes de tocar.
