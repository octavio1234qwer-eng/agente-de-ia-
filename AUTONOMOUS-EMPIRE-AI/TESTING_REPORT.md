# TESTING REPORT — 2026-11-27

## Automatizadas — `npm test` → **37/37 pasan** (Vitest, PGlite = PostgreSQL 17 en WASM, base aislada por prueba)
| Área | Pruebas |
|---|---|
| Base de datos | migraciones + semilla; bundle de migraciones = archivos `.sql`; RLS activo en todas las tablas |
| Auditoría | cadena verificada; detecta alteración; detecta borrado intermedio |
| Permisos | verde/rojo/prohibido/desconocido; viewer y público; lista blanca de agentes; solo owner aprueba; autorización ligada a la acción |
| Planificador | sin duplicados por periodo; 3 reintentos + alerta; reintento posterior; tiempo límite |
| Finanzas | BD rechaza gasto sin autorización; BD rechaza ingreso real sin verificar; flujo solicitud→aprobación→registro; bloqueo por presupuesto en solicitud y aprobación; idempotencia; comisiones de plataforma; real vs estimado |
| CotizaFácil | lead válido con score; sin consentimiento/honeypot/correo inválido rechazados; sin duplicados; límite 5/h |
| Mercado Pago | firma válida/inválida/otro id; solo `approved` vía API; idempotente; 401 con firma falsa |
| Afiliados | solo dominios ML; redirección + clic; viewer bloqueado; comisiones CSV como estimadas |
| Gumroad | conciliación idempotente; excluye reembolsos; moneda del producto |
| Correo | solo aprobados, con consentimiento y tope |
| Agentes | ciclo diario completo sin cifras inventadas; idempotencia; bloqueo fuera de lista; compliance rechaza promesas; 404 roto vs 403 desconocido; rutina diaria no se duplica |
| Auth | login/sesión/logout; bloqueo tras 5 fallos; contraseña corta rechazada |

`npm run typecheck` (TypeScript 7, estricto) sin errores. `npm run build` (Next.js 16.4.6) sin errores ni advertencias.

## Integración manual verificada
| Verificación | Resultado |
|---|---|
| PostgreSQL 16 real con driver `pg`: `db:migrate`, `routine -- daily`, `audit:verify` | OK (cadena íntegra) |
| RLS: rol no dueño con `GRANT SELECT` sobre `leads` | Ve 0 filas (había 1) |
| Gumroad API real (solo lectura) vía `hourly.gumroad-sync` | 10 productos (9 publicados), 0 ventas — coincide con `sales_count` |
| `next start` + Playwright (Chromium) contra PostgreSQL real | Formulario → lead creado; `/dashboard` sin sesión → `/login`; contraseña errónea rechazada; login OK; 14 rutas del panel HTTP 200 sin errores de página; registrar enlace → `/go/taladro-demo` 302 a mercadolibre.com.mx; solicitud de gasto visible como pendiente; capturas en escritorio y iPhone 13 |
| `/api/cron/daily.ceo-cycle` sin token → 401; con token → `succeeded` | OK |
| `npm ci` limpio + typecheck + test + build (simulación del workflow CI) | OK |
| GitHub Actions *Empire CI* (run 45926276029): npm ci, typecheck, 37 pruebas, migraciones + ciclo diario + audit:verify contra servicio postgres:16, build | ✅ success |

## No verificado todavía
- Despliegue en Vercel/Supabase reales.
- Workflow *Empire Routines* en GitHub (requiere secretos). *Empire CI* ya corrió en verde en GitHub (run 45926276029).
- Mercado Pago con credenciales reales (sandbox) y webhook real.
- SMTP real.
- Revisión legal del aviso de privacidad.

## Defectos encontrados y corregidos en esta sesión
1. `LOCK TABLE` fuera de transacción al auditar desde una conexión → `appendAudit` abre su propia transacción.
2. Lectura dinámica de migraciones hacía que Next empaquetara todo el proyecto → migraciones empaquetadas en `bundle.generated.ts` + prueba de sincronía.
3. Login: React 19 reinicia el formulario tras un error y borraba el correo → el estado conserva el correo.
4. PGlite no creaba el directorio de datos → se crea antes de abrir.
