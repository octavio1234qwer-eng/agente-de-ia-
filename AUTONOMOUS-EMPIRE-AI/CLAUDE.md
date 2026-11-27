# CLAUDE.md — Autonomous Empire AI

Instrucciones para cualquier sesión de Claude Code que trabaje en este directorio.

## Al empezar
1. Lee `PROJECT_STATE.md` (estado verificado, siguiente paso exacto). Es la fuente de verdad.
2. `npm install` y `npm test` (deben pasar 100 %).

## Reglas no negociables
- No inventar clientes, ventas, métricas ni resultados. Sin datos ⇒ "sin datos".
- Nada se marca como terminado sin prueba automatizada o verificación manual registrada en `TESTING_REPORT.md`.
- Dinero en centavos enteros. Dinero real solo si está verificado contra la fuente (webhook firmado + API).
- Acciones ROJAS (gastar, contratar, publicidad, fondos, credenciales, borrar datos importantes, afirmaciones no verificadas, obligaciones legales) solo con una autorización `approvals` aprobada por el propietario.
- Presupuesto total autorizado: $500 MXN (`budgets.initial`). No contratar servicios de pago sin autorización.
- Secretos solo en variables de entorno (`.env` local, secretos de GitHub/Vercel). Nunca en el código ni en commits.
- No usar modo de permisos ilimitados como configuración permanente.

## Mapa del código
| Ruta | Qué hay |
|---|---|
| `core/db` | Acceso a Postgres (`pg` con `DATABASE_URL`, PGlite en desarrollo/pruebas) y migraciones |
| `core/permissions` | Niveles VERDE/AMARILLO/ROJO/PROHIBIDO, `authorize`, autorizaciones |
| `core/audit-log` | Registro append-only encadenado por SHA-256 y verificación |
| `core/scheduler` | Rutinas con deduplicación por periodo, reintentos, timeout y alertas |
| `core/orchestrator` | Ejecuta tareas de agentes con permisos, idempotencia y auditoría |
| `core/agent-registry` | Registro estático de los 9 agentes (`agents/*/agent.json` + `handler.ts`) |
| `core/auth` | scrypt, sesiones opacas, bloqueo por intentos |
| `finance/` | Libro, presupuesto, P&L por unidad |
| `businesses/` | CotizaFácil (leads, pagos), afiliados, productos digitales (Gumroad) |
| `infrastructure/integrations` | Mercado Pago, Gumroad, SMTP, Claude API (opcional) |
| `automation/` | Mapa de rutinas y CLI |
| `apps/command-center` | Next.js: sitio público + Command Center |

## Comandos
`npm test` · `npm run typecheck` · `npm run build` · `npm run dev` · `npm run db:migrate` · `npm run db:bundle` (tras cambiar un `.sql`) · `npm run routine -- daily` · `npm run audit:verify` · `npm run user:create -- --email ... --role owner`

## Al terminar cada sesión
Actualiza `PROJECT_STATE.md`: funciones implementadas (solo verificadas), errores pendientes, decisiones, % de progreso por tareas verificadas, siguiente paso exacto y cómo continuar.
