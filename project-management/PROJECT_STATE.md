# PROJECT STATE — AUTO-INCOME AI

**Última actualización:** 2026-11-22 (sesión 2)
**Rama:** `claude/auto-income-ai-setup-dw8nr1`
**Versión:** 0.2.0 — backend funcional + integración Gumroad real, sin interfaz web.

## Qué funciona (verificado)
- `cd auto-income && npm install && npm test` → **33/33 pruebas pasan**; `npm run typecheck` limpio.
- `npm start` arranca la API en `PORT` (8787 por defecto); `/health` responde; worker del orquestador cada 10 s.
- Núcleo financiero CotizaFácil (margen ≠ recargo, IVA, descuentos, WhatsApp).
- Orquestador con estados PENDING/QUEUED/RUNNING/WAITING_APPROVAL/COMPLETED/FAILED/CANCELLED, reintentos, idempotencia, aprobaciones y recuperación.
- 10 agentes con tareas deterministas reales sobre datos de la base.
- Seguridad: scrypt, sesiones HttpOnly, CSRF, roles, rate limiting, auditoría, aislamiento por negocio.
- CRM, Product Studio (versiones + QA), cotizaciones con folio, finanzas, analítica, pagos demo + webhook firmado.

## Datos reales del negocio (2026-11-22, últimos 30 días)
- Gumroad (octavius724): 36 productos publicados, 129 visitas (todas "direct", ~5 por producto → probablemente revisiones automáticas), **0 ventas**.
- Buffer (X, LinkedIn, Pinterest): 36 publicaciones, 1,897 impresiones, 2 reacciones, 4 comentarios.
- Conclusión: el cuello de botella es la distribución/audiencia, no la cantidad de productos.
- Ya existen 2 tareas programadas de ventas (2 h y 6 h) en otras sesiones; la de 2 h estaba bloqueada esperando aprobación de un despliegue de Vercel.

## Ventas y canales (2026-11-25)
- Embudo activo: https://octavius724.gumroad.com/l/bhbdx → cupón GRACIAS20 → Paquete Negocio y Hogar. Detalles en CANALES_VENTA.md.
- Product Hunt: borrador listo para el 2-dic, falta la confirmación del dueño.
- El dueño mantiene activas las 2 tareas programadas de ventas (2 h y 6 h).

## Qué falta
- **Interfaz web** (Command Center, CotizaFácil UI, PDF, página comercial). Hoy solo hay API.
- Despliegue real (no está publicado en ninguna URL).
- LLM opcional, proveedor de pago real, Growth Engine avanzado.
- Algunas pruebas de agentes secundarios (ver TASKS.md #4).

## Agente Mantarraya (raíz del repo)
No se modificó. Sigue en `server.mjs` / `package.json` raíz.

## Dónde continuar
➡️ Ver **NEXT_STEPS.md**: crear `auto-income/apps/web` (Vite + React + Tailwind) consumiendo la API existente, empezando por login/setup y el dashboard.
