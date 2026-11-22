# CHANGELOG

## [0.2.0] — 2026-11-22 — Sesión 2: integración Gumroad real
### Añadido
- `packages/integrations/src/gumroad.ts`: sincronización de solo lectura (productos paginados + ventas + comisiones + reembolsos), idempotente.
- Tarea de agente `finance.sync_gumroad` y ruta `POST /api/businesses/:bid/integrations/gumroad/sync`.
- `tests/gumroad.test.ts` (API simulada). Total: 33 pruebas.
- Verificado contra la API real: 36 productos importados, 0 ventas (coincide con Gumroad).

## [0.1.0] — 2026-11-19 — Sesión 1: backend funcional
### Añadido
- `auto-income/` con backend TypeScript sin dependencias de runtime.
- Núcleo financiero CotizaFácil: margen vs recargo, ganancias, punto de equilibrio, cotizaciones con IVA/descuentos, WhatsApp. Fórmulas en `auto-income/docs/FORMULAS.md`.
- Business Factory: scoring 0–100 con 8 criterios y niveles de evidencia.
- Política de autonomía 0–4 (inicial 2) con reglas duras de aprobación.
- SQLite nativo con migración v1 (usuarios, sesiones, negocios, tareas, eventos, productos y versiones, CRM, catálogo, cotizaciones, transacciones, eventos de pago, analítica, conocimiento, notificaciones, auditoría, costes).
- Orquestador de tareas persistente y 10 agentes con tareas reales.
- API HTTP segura con todas las rutas de negocio; worker del orquestador en el mismo proceso.
- Pagos: interfaz PaymentProvider, modo DEMO, webhook HMAC idempotente.
- 31 pruebas automatizadas (unitarias + integración HTTP), typecheck limpio.
- Sistema de memoria `/project-management/`.
