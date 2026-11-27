# PROJECT STATE

**Última actualización:** 2026-11-27 (sesión 2) · **Rama:** `claude/blissful-thompson-oeu79g` · **Estado:** todo lo que no requiere tu identidad está hecho y verificado. Proyecto `empire-ai` creado en Vercel; **falta enlazar GitHub y la base de datos (tus 3 pasos abajo)**.

## ▶ LO ÚNICO QUE FALTA Y SOLO TÚ PUEDES HACER
Para estar en producción (≈10 minutos, en el teléfono o la computadora):
1. **Vercel → Account Settings → Authentication → GitHub → Connect.** Luego `empire-ai` → Settings → Git → conectar `octavio1234qwer-eng/agente-de-ia-`, y en Settings → Environments → Production → Branch Tracking poner `claude/blissful-thompson-oeu79g` (o fusionar esa rama a `main`).
2. **`empire-ai` → Storage → Create Database → Neon (Free) → Connect** → Redeploy.
3. **Abrir `https://<dominio>/setup`**, escribir el `SETUP_TOKEN` (en Settings → Environment Variables) y crear tu usuario.

Cuando quieras cobrar o ganar comisiones (requieren tu identidad/RFC o firma):
4. Credenciales de **Mercado Pago** → agregarlas en Vercel (`MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `PUBLIC_BASE_URL`), nunca en el chat.
5. Alta en el **Programa de Afiliados de Mercado Libre**.
6. Token de **Gumroad** en Vercel (`GUMROAD_ACCESS_TOKEN`) para conciliar ventas en producción.
7. Revisión legal del **aviso de privacidad**.
8. Decidir qué hacer con tu sitio existente `cotizafacil.vercel.app` (calculadora para freelancers): unificar con la nueva landing o mantenerlo aparte.

Todo lo demás lo hace el sistema o Claude.

## Progreso: 69 % (29 de 42 tareas verificadas)
| Fase | Verificadas | Pendientes |
|---|---|---|
| 1 Fundación | 5/5 | — |
| 2 Cerebro | 4/4 | — |
| 3 Command Center | 3/4 16 secciones, datos reales, responsive (proyecto Vercel creado) | despliegue (pasos 1–3) |
| 4 CotizaFácil MX | 5/7 landing, captación+CRM, seguimiento, cobro MP (código), investigación de competencia con fuentes | credenciales MP (4), ≥30 leads reales |
| 5 Affiliate Engine | 4/6 enlaces+clics, enlaces rotos, comisiones CSV, conciliación de depósitos | alta en ML (5), enlaces y contenido reales |
| 6 Digital Products | 2/3 conciliación Gumroad real, entrega (Gumroad) | tráfico/ventas |
| 7 Media Engine | 1/3 borradores + revisión | métricas por publicación, programación vía integración |
| 8 Micro SaaS | 1/3 motor de oportunidades (2 cargadas con evidencia) | validación |
| 9 Automatización | 4/5 workflows (CI verde), cron de Vercel, webhook MP, retención/recuperación | ejecución en producción |
| 10 Escalabilidad | 0/2 | medir con datos reales, recortar |

## Criterios de finalización (sección 14)
| Criterio | Estado |
|---|---|
| Dashboard funciona | ✅ local (PostgreSQL real) · ❌ producción |
| Base de datos conectada | ✅ PostgreSQL 16 local · ❌ Supabase |
| Agentes ejecutan tareas | ✅ |
| Registros verificables | ✅ auditoría encadenada |
| Automatizaciones funcionan | 🟡 local, cron por grupos y CI en GitHub ✅; Vercel Cron listo, activo al desplegar |
| CotizaFácil capta clientes | 🟡 local; falta URL pública |
| Afiliados miden enlaces | ✅ local |
| Pagos verificables | 🟡 código y pruebas; sin credenciales |
| Pruebas críticas pasan | ✅ 39/39 |
| Límites financieros activos | ✅ en código y en la base |
| Seguridad verificada | 🟡 pruebas + RLS; sin auditoría externa |
| Documentación | ✅ |

## Implementado y verificado
Ver `TESTING_REPORT.md`. Resumen: esquema PostgreSQL (27 tablas, RLS), permisos 4 niveles con autorizaciones, auditoría SHA-256, planificador con deduplicación/reintentos/timeout/alertas, orquestador con idempotencia, 9 agentes con 16 tareas, libro financiero con presupuesto $500 MXN bloqueante, CotizaFácil (landing, formulario con consentimiento, CRM, seguimiento), Mercado Pago (firma + verificación por API), Gumroad (lectura real), afiliados (`/go/*`, clics, enlaces rotos, CSV), correo con consentimiento y tope, auth con roles, Command Center de 16 secciones responsive, workflows CI y rutinas.

## Datos reales al día de hoy
Ingresos reales: $0. Gastos: $0. Presupuesto disponible: $500 MXN. Gumroad: 10 productos, 0 ventas. Leads reales: 0 (los de las pruebas fueron en bases locales desechables).

## Errores / limitaciones pendientes
1. PGlite (solo desarrollo) puede corromper `.data/` si se mata el proceso a mitad de escritura → borrar `.data/` y recrear el usuario. Producción usa PostgreSQL.
2. (Resuelto) Conciliación de depósitos de afiliados implementada.
3. Métricas de interacción por publicación no conectadas.
4. Sin copias de seguridad programadas propias (Supabase gratuito no incluye PITR).
5. (Resuelto) Rutina `daily.retention`. `page_views` se conserva para métricas.
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
| 2026-11-27 | Precio hipotético piloto baja a $99 MXN/mes | Competidor directo (Cotiza Pro) a $49/mes; ver MARKET_RESEARCH.md |
| 2026-11-27 | Proyecto nuevo `empire-ai` en Vercel; no se tocó `cotizafacil` existente | Es otro producto del propietario |
| 2026-11-27 | Vercel Cron como disparador principal | No requiere secretos en GitHub |

## Siguiente paso exacto
Propietario: pasos 1–3 de arriba. Después, Claude: verificar `/api/health` en producción, ejecutar `/api/cron/daily`, revisar el primer informe y difundir `/cotizafacil`.

## Cómo continuar en la próxima sesión
```bash
cd AUTONOMOUS-EMPIRE-AI && npm install && npm test   # 39/39
cat PROJECT_STATE.md                                  # este archivo
npm run dev                                           # panel local en :3000 (PGlite) — crear usuario antes
```
