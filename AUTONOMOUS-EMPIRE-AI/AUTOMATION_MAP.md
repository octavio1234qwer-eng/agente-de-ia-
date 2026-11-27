# AUTOMATION MAP

| Rutina | Frecuencia (CDMX) | Qué hace |
|---|---|---|
| `hourly.gumroad-sync` | cada hora (:17) | Concilia ventas y productos de Gumroad (solo lectura) |
| `hourly.email-outbox` | cada hora | Envía correos **aprobados** a leads con consentimiento, con tope diario |
| `daily.ceo-cycle` | 06:41 | Salud → puntuar leads → seguimientos (borradores) → 2 borradores de contenido → cumplimiento → P&L 30 d → presupuesto → embudo → compuerta de validación → informe ejecutivo |
| `weekly.ceo-cycle` | lunes 07:23 | Enlaces rotos → oportunidades → P&L 7 d → embudo 7 d → compuerta → informe semanal + decisión registrada |
| `monthly.ceo-cycle` | día 1, 08:11 | P&L 30 d → oportunidades → compuerta → informe mensual |

## Disparadores
1. **GitHub Actions** (`.github/workflows/empire-routines.yml`): ejecuta `npm run routine -- <grupo>` directamente contra Supabase. No depende de un computador encendido ni del despliegue web. Requiere el secreto `EMPIRE_DATABASE_URL`.
2. **Alternativa HTTP:** `GET/POST /api/cron/<rutina>` con `Authorization: Bearer CRON_SECRET` (Vercel Cron o cualquier cron externo).
3. **Manual:** Command Center → Automatizaciones, o `npm run routine -- daily.ceo-cycle [--force]`.
4. **Claude Code Scheduled Tasks:** disponible en esta cuenta; no se creó ninguna sin autorización del propietario. Uso sugerido: una tarea semanal que lea el informe y proponga cambios de código en una rama.

## Garantías
- **Sin duplicados:** `job_runs (job_name, period_key)` es único; una rutina exitosa no se repite en su periodo (salvo `--force`). Una ejecución "running" colgada > 2× timeout se puede reclamar.
- **Reintentos:** 3 intentos con backoff exponencial (2 s, 4 s).
- **Límite de ejecución:** 240 s por rutina.
- **Registro y alertas:** resultado en `job_runs` y `audit_log`; un fallo crea una alerta crítica deduplicada.

## Webhooks
- `POST /api/webhooks/mercadopago` — pagos (ver `API_INTEGRATIONS.md`).

## Recuperación
- Reejecutar una rutina fallida: se reintenta sola en el siguiente disparo del mismo periodo, o `--force`.
- Verificar integridad: `npm run audit:verify`.
