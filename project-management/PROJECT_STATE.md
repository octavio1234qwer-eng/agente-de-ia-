# PROJECT STATE — AUTO-INCOME AI

**Última actualización:** 2026-11-19 (sesión 1)
**Rama:** `claude/auto-income-ai-setup-dw8nr1`
**Versión:** 0.1.0 — backend funcional, sin interfaz web.

## Qué funciona (verificado)
- `cd auto-income && npm install && npm test` → **31/31 pruebas pasan**; `npm run typecheck` limpio.
- `npm start` arranca la API en `PORT` (8787 por defecto); `/health` responde; worker del orquestador cada 10 s.
- Núcleo financiero CotizaFácil (margen ≠ recargo, IVA, descuentos, WhatsApp).
- Orquestador con estados PENDING/QUEUED/RUNNING/WAITING_APPROVAL/COMPLETED/FAILED/CANCELLED, reintentos, idempotencia, aprobaciones y recuperación.
- 10 agentes con tareas deterministas reales sobre datos de la base.
- Seguridad: scrypt, sesiones HttpOnly, CSRF, roles, rate limiting, auditoría, aislamiento por negocio.
- CRM, Product Studio (versiones + QA), cotizaciones con folio, finanzas, analítica, pagos demo + webhook firmado.

## Qué falta
- **Interfaz web** (Command Center, CotizaFácil UI, PDF, página comercial). Hoy solo hay API.
- Despliegue real (no está publicado en ninguna URL).
- LLM opcional, proveedor de pago real, Growth Engine avanzado.
- Algunas pruebas de agentes secundarios (ver TASKS.md #4).

## Agente Mantarraya (raíz del repo)
No se modificó. Sigue en `server.mjs` / `package.json` raíz.

## Dónde continuar
➡️ Ver **NEXT_STEPS.md**: crear `auto-income/apps/web` (Vite + React + Tailwind) consumiendo la API existente, empezando por login/setup y el dashboard.
