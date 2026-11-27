# Arquitectura

## Visión general
```
 Navegador (panel)          Telegram (Fase 4)         Cron / worker (Fase 7)
        │                          │                          │
        ▼                          ▼                          ▼
 ┌──────────────────────── Next.js 16 (Node.js) ─────────────────────────┐
 │ proxy.ts (comprobación optimista de cookie)                            │
 │ Server Components / Server Actions / Route Handlers                    │
 │        │                                                               │
 │   DAL (src/server/auth/dal.ts): sesión + permisos                      │
 │        │                                                               │
 │   Módulos de dominio (src/server/modules/*)                            │
 │        │                                                               │
 │   withUserContext ──► SET LOCAL ROLE vmf_runtime (RLS)                 │
 │   withServiceContext ─► propietario (auth, worker, eventos)            │
 └────────┼───────────────────────────────────────────────────────────────┘
          ▼
   PostgreSQL — Supabase (producción) · PGlite embebido (desarrollo/pruebas)
   esquema vmf: 26 tablas, RLS, auditoría por triggers
```

## Los ocho subsistemas
| Subsistema | Dónde vive | Estado |
|---|---|---|
| A. Central AI Orchestrator | `automation_jobs`, `agent_logs`, `system_settings` (parada/pausa); worker en Fase 7 | Base de datos e interruptores listos |
| B. Virtual Model Manager | `src/server/modules/models`, `/models` | **Completo** |
| C. AI Content Studio | `content_library`, `content_campaigns`, `model_assets` | Esquema listo, Fase 3 |
| D. Social Media Manager | `social_accounts`, `social_connections`, `publishing_calendar` | Esquema listo, Fase 5 |
| E. Conversation AI | `conversations`, `conversation_messages`, personalidad por modelo | Esquema y personalidad listos, Fase 7 |
| F. Revenue Engine | `products`, `subscriptions`, `transactions`, `expenses`, `customers` | Esquema listo, Fase 6 |
| G. Analytics Engine | `analytics` (fuente obligatoria) + dashboard | Dashboard con datos reales, Fase 6 |
| H. Telegram Control Center | — | Fase 4 |

## Datos
- Importes en céntimos (`bigint`) + moneda ISO. `transactions.net_cents` es columna generada.
- Separación por modelo: casi todas las tablas tienen `model_id`; las políticas RLS usan `vmf.can_read_model()` / `vmf.can_write_model()`.
- Asignación de modelos a operadores/lectores: `user_model_access`.
- Personalidad versionada: una fila activa por modelo (`model_personalities_one_active`); editar crea versión nueva solo si cambia.
- Cola de trabajos: `automation_jobs` con `idempotency_key` única (prevención de duplicados), `attempts/max_attempts`, `run_at` (reintentos con espera), estado `waiting_approval`.
- Aprobaciones: `approvals.payload_hash` = SHA-256 canónico del payload; una aprobación vale solo para esa versión exacta.
- Auditoría: trigger `vmf.tg_audit()` en 17 tablas; registra `vmf.user_id` y `vmf.actor` (panel, telegram, worker, cli) y redacta columnas secretas.

## Decisiones técnicas (ADR)
1. **Next.js en un solo despliegue** (panel + API + webhooks). Menos piezas; el worker de la Fase 7 reutiliza los mismos módulos.
2. **Cache Components desactivado**: el panel es 100 % dinámico (sesión + BD en cada petición); se evita complejidad sin beneficio.
3. **Autenticación propia sobre PostgreSQL** en lugar de Supabase Auth: funciona igual en local (PGlite) y en Supabase, es totalmente testeable y no expone la base a la Data API. Contraseñas scrypt (N=2^15), tokens de 256 bits, cookie `__Host-` httpOnly/Secure/SameSite=Lax.
4. **Esquema `vmf` no expuesto** por la Data API de Supabase y acceso solo desde el servidor con `DATABASE_URL`. Las claves de Supabase nunca llegan al navegador.
5. **RLS como defensa en profundidad**: la app comprueba permisos y además cada consulta del panel corre como `vmf_runtime`. Privilegios por columna impiden leer `password_hash`, tokens cifrados o emails cifrados incluso con un fallo en la app.
6. **PGlite para desarrollo y pruebas**: PostgreSQL real compilado a WASM; las mismas migraciones y RLS. Las pruebas se ejecutan también contra PostgreSQL 16 con `TEST_DATABASE_URL`.
7. **Migraciones SQL propias** (`db/migrations`, `vmf_meta.schema_migrations` con checksum) en lugar de un ORM: control total de RLS, triggers y roles.
8. **Proveedores intercambiables** (Fases 3–6): cada integración implementará una interfaz (`ImageProvider`, `SocialConnector`, `PaymentProvider`, `LlmProvider`) con adaptadores; ninguna lógica de negocio dependerá de un proveedor concreto.
9. **n8n**: se integrará como consumidor de la API/cola (webhooks firmados), no como dependencia del núcleo.
