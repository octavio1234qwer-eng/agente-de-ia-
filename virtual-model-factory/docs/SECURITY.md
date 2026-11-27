# Seguridad y cumplimiento

## Controles implementados
| Área | Control | Dónde |
|---|---|---|
| Contraseñas | scrypt N=2^15, sal aleatoria, política (12+ caracteres, comunes, repetitivas, contiene el correo) | `src/server/auth/password.ts` |
| Sesiones | Token 256 bits; en BD solo SHA-256; cookie `__Host-`, httpOnly, Secure, SameSite=Lax; expiración absoluta (7 d) e inactividad (12 h); invalidación al cambiar contraseña o desactivar usuario; revocación remota | `src/server/auth/service.ts`, `/security` |
| Fuerza bruta | 30 intentos/15 min por IP, 10 por correo, bloqueo 15 min tras 5 fallos, respuesta y tiempo uniformes (hash ficticio) | `login()` |
| Autorización | Roles en app (`permissions.ts`) + RLS en todas las tablas + privilegios por columna | migración 0001 |
| Separación por modelo | `user_model_access` + `can_read_model` / `can_write_model` | RLS |
| Secretos | Solo servidor; AES-256-GCM con AAD para tokens y datos personales; nunca en logs ni auditoría | `crypto.ts` |
| Auditoría | Trigger en 17 tablas con actor y origen; eventos de seguridad (login, bloqueo, permisos denegados, parada de emergencia…) | `audit_log`, `security_events` |
| Cabeceras | CSP, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP, HSTS | `next.config.ts` |
| CSRF | Server Actions validan Origin; cookies SameSite=Lax | Next.js |
| Entradas | Zod en todas las acciones + `CHECK` en BD | `src/lib/model-schema.ts` |
| Alta inicial | `/setup` solo sin usuarios, con `SETUP_TOKEN` (comparación en tiempo constante, límite de intentos, bloqueo de tabla) | `src/app/setup` |
| Emergencia | Parada de emergencia y pausa (admin+, con motivo, auditadas) | `/settings` |

## Reglas de contenido impuestas por la base de datos
- Edad ficticia ≥ 25; `is_virtual` siempre verdadero; divulgación de IA obligatoria.
- Activación solo con declaración de no reproducir a personas reales (registra usuario y fecha).
- OnlyFans no puede habilitarse. Publicado solo con ID externo confirmado.
- Clientes: verificación de edad registrada; email cifrado + hash para búsquedas; nunca datos de tarjetas.

## Pendiente (Fase 8)
MFA TOTP, CSP con nonces (hoy `unsafe-inline` en scripts por la hidratación de Next), rotación de `ENCRYPTION_KEY` con id de clave, alertas de seguridad por Telegram, limpieza programada de sesiones y `rate_limits`.

## Reportar un problema
Si detectas una vulnerabilidad, activa la parada de emergencia, revoca sesiones en `/security` y rota los secretos afectados.
