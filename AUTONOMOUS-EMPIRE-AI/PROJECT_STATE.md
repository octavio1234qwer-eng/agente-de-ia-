# PROJECT STATE

**Última actualización:** 2026-11-27 · **Rama:** `claude/blissful-thompson-oeu79g` · **Estado:** fundación + cerebro + Command Center funcionando localmente con PostgreSQL real; **no desplegado; no operativo en producción**.

## Progreso: 65 % (26 de 40 tareas verificadas)
| Fase | Verificadas | Pendientes |
|---|---|---|
| 1 Fundación | 5/5 estructura, docs, configuración, esquema, permisos | — |
| 2 Cerebro | 4/4 CEO, registro de agentes, tareas, auditoría | — |
| 3 Command Center | 3/4 16 secciones, datos reales, responsive | despliegue |
| 4 CotizaFácil MX | 4/7 landing, captación+CRM, seguimiento (borradores), cobro MP (código) | credenciales MP, ≥30 leads, investigación de competencia |
| 5 Affiliate Engine | 3/5 enlaces+clics, enlaces rotos, comisiones CSV | alta en programa ML, enlaces y contenido reales |
| 6 Digital Products | 2/3 conciliación Gumroad real, entrega (Gumroad) | tráfico/ventas |
| 7 Media Engine | 1/3 borradores + revisión | métricas por publicación, programación vía integración |
| 8 Micro SaaS | 1/3 motor de oportunidades | investigación, validación |
| 9 Automatización | 3/4 workflows (CI verde en GitHub), webhook MP, recuperación | rutinas programadas con secretos de Supabase |
| 10 Escalabilidad | 0/2 | medir con datos reales, recortar |

## Criterios de finalización (sección 14)
| Criterio | Estado |
|---|---|
| Dashboard funciona | ✅ local (PostgreSQL real) · ❌ producción |
| Base de datos conectada | ✅ PostgreSQL 16 local · ❌ Supabase |
| Agentes ejecutan tareas | ✅ |
| Registros verificables | ✅ auditoría encadenada |
| Automatizaciones funcionan | 🟡 local, endpoint cron y CI en GitHub ✅; rutinas programadas sin secretos aún |
| CotizaFácil capta clientes | 🟡 local; falta URL pública |
| Afiliados miden enlaces | ✅ local |
| Pagos verificables | 🟡 código y pruebas; sin credenciales |
| Pruebas críticas pasan | ✅ 37/37 |
| Límites financieros activos | ✅ en código y en la base |
| Seguridad verificada | 🟡 pruebas + RLS; sin auditoría externa |
| Documentación | ✅ |

## Implementado y verificado
Ver `TESTING_REPORT.md`. Resumen: esquema PostgreSQL (27 tablas, RLS), permisos 4 niveles con autorizaciones, auditoría SHA-256, planificador con deduplicación/reintentos/timeout/alertas, orquestador con idempotencia, 9 agentes con 16 tareas, libro financiero con presupuesto $500 MXN bloqueante, CotizaFácil (landing, formulario con consentimiento, CRM, seguimiento), Mercado Pago (firma + verificación por API), Gumroad (lectura real), afiliados (`/go/*`, clics, enlaces rotos, CSV), correo con consentimiento y tope, auth con roles, Command Center de 16 secciones responsive, workflows CI y rutinas.

## Datos reales al día de hoy
Ingresos reales: $0. Gastos: $0. Presupuesto disponible: $500 MXN. Gumroad: 10 productos, 0 ventas. Leads reales: 0 (los de las pruebas fueron en bases locales desechables).

## Errores / limitaciones pendientes
1. PGlite (solo desarrollo) puede corromper `.data/` si se mata el proceso a mitad de escritura → borrar `.data/` y recrear el usuario. Producción usa PostgreSQL.
2. Comisiones de afiliado: falta conciliar depósitos para pasarlas a "real".
3. Métricas de interacción por publicación no conectadas.
4. Sin copias de seguridad programadas propias (Supabase gratuito no incluye PITR).
5. `rate_limits` y `page_views` no tienen limpieza periódica (crecimiento lento).
6. Aviso de privacidad es borrador: requiere revisión legal antes de difusión amplia.
7. En este sandbox, `fetch` de Node necesita `NODE_USE_ENV_PROXY=1` para salir por el proxy (no aplica a Vercel/GitHub).

## Decisiones tomadas
| Fecha | Decisión | Motivo |
|---|---|---|
| 2026-11-27 | Proyecto en `AUTONOMOUS-EMPIRE-AI/` dentro del repo existente | No romper el agente de WhatsApp (Render) ni `fabrica-productos/` |
| 2026-11-27 | Un solo despliegue Next.js para panel y sitio público | Costo $0 y un solo dominio; `apps/public-web` reservado |
| 2026-11-27 | `pg` en producción, PGlite en desarrollo/pruebas | Mismo SQL real, sin servicios extra |
| 2026-11-27 | Auth propia (scrypt + sesiones) en vez de Supabase Auth | Menos dependencias; usuarios solo por CLI |
| 2026-11-27 | Rutinas por GitHub Actions directo a la BD | No depende del despliegue web ni de un equipo encendido |
| 2026-11-27 | Claude API desactivada por defecto | Es de pago: requiere autorización ROJA |
| 2026-11-27 | No se creó ninguna Scheduled Task de Claude Code | Requiere autorización del propietario |
| 2026-11-27 | Precio hipotético piloto $149 MXN/mes | Solo para la compuerta G2; se valida con datos |

## Siguiente paso exacto
1. Propietario: crear proyecto Supabase (gratis) y darme la `DATABASE_URL` como secreto (no en el chat): ver `DEPLOYMENT_GUIDE.md` §1.
2. Importar el repo en Vercel con Root Directory `AUTONOMOUS-EMPIRE-AI/apps/command-center` (§2) y cargar `SESSION_SECRET`, `CRON_SECRET`, `ANALYTICS_SALT`.
3. `npm run db:migrate` y `npm run user:create -- --role owner` contra Supabase.
4. Cargar secretos de GitHub (§3) y ejecutar *Empire Routines* → `daily`.
5. Market Intelligence: investigación de competencia de CotizaFácil con fuentes.

## Cómo continuar en la próxima sesión
```bash
cd AUTONOMOUS-EMPIRE-AI && npm install && npm test   # 37/37
cat PROJECT_STATE.md                                  # este archivo
npm run dev                                           # panel local en :3000 (PGlite) — crear usuario antes
```
