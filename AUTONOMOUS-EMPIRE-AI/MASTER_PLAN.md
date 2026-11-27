# MASTER PLAN

## Visión
Una empresa digital modular en la que agentes de IA hacen el trabajo repetible (investigar, redactar, medir, conciliar, vigilar) y el propietario toma las decisiones que comprometen dinero, reputación o responsabilidad legal.

## Principios de diseño
1. **Ingresos reales primero.** Ninguna función sin justificación comercial; cada unidad pasa por compuertas de validación.
2. **Autonomía dentro de límites.** VERDE autónomo, AMARILLO con límites, ROJO con autorización registrada, PROHIBIDO siempre bloqueado.
3. **Verificable.** Toda acción deja rastro en un registro de auditoría encadenado por hash; el dinero real se concilia contra la fuente.
4. **Costo cero por defecto.** Herramientas gratuitas/código abierto; cualquier servicio de pago es una solicitud ROJA.
5. **Sin dependencia de un equipo encendido.** Rutinas en GitHub Actions (o Vercel Cron) contra una base gestionada.

## Arquitectura
```
                ┌──────────────── apps/command-center (Next.js 16) ────────────────┐
 Visitantes ──▶ │ /cotizafacil  /privacidad  /go/<slug>  /api/leads  /api/webhooks │
 Propietario ─▶ │ /login → /dashboard/* (16 secciones, RBAC por rol)               │
                └──────────────┬───────────────────────────────────────────────────┘
 GitHub Actions ─ cron ─▶ automation/run.ts  ──┐  │ /api/cron/<rutina> (Bearer CRON_SECRET)
                                              ▼  ▼
        core/scheduler ─▶ core/orchestrator ─▶ agents/*/handler.ts ──▶ businesses/*, finance/*
               │                 │ authorize()            │
               ▼                 ▼                         ▼
        job_runs, alerts   core/permissions ─▶ core/audit-log (hash chain)
                                              ▼
                          PostgreSQL (Supabase)  ·  PGlite en desarrollo
 Integraciones: Mercado Pago (cobros), Gumroad (ventas digitales), SMTP, Claude API (opcional, pago)
```

## Fases
| Fase | Contenido | Estado |
|---|---|---|
| 1 Fundación | Estructura, docs, configuración, BD, permisos | Hecha y probada |
| 2 Cerebro | EMPIRE CEO, registro de agentes, tareas, auditoría | Hecha y probada |
| 3 Command Center | Panel con datos reales | Hecha (local, PostgreSQL real); falta despliegue |
| 4 CotizaFácil MX | Landing, captación, CRM, seguimiento, pagos MP | Captación y CRM listos; validación de mercado pendiente |
| 5 Affiliate Engine | Enlaces, clics, enlaces rotos, comisiones | Medición lista; faltan enlaces reales y contenido |
| 6 Digital Products | Conciliación Gumroad | Lectura real verificada; la fábrica vive en `../fabrica-productos` |
| 7 Media Engine | Producción y distribución | Borradores + revisión; publicación manual |
| 8 Micro SaaS | Investigar y validar | Motor de oportunidades listo; sin investigación cargada |
| 9 Automatización | Cron, webhooks, recuperación | Workflows listos; requieren secretos |
| 10 Escalabilidad | Medir y recortar | Pendiente de datos reales |

Detalle y prioridades en `ROADMAP.md`; estado verificado en `PROJECT_STATE.md`.
