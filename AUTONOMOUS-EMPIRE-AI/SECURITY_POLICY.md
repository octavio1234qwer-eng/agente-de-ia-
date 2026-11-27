# SECURITY POLICY

## Secretos
- Solo en variables de entorno: `.env` local (ignorado por git), secretos de GitHub Actions y variables de Vercel. Plantilla: `.env.example`.
- Rotar inmediatamente cualquier secreto expuesto. Cambiar credenciales es acción ROJA y queda auditado.

## Autenticación y acceso
- Contraseñas con scrypt (N=16384, r=8, p=1), mínimo 12 caracteres.
- Sesiones opacas de 32 bytes; en la base solo se guarda su SHA-256. Cookie `httpOnly`, `secure` en producción, `SameSite=Lax`, 12 h.
- Bloqueo de 15 min tras 5 intentos fallidos por correo; intentos registrados con IP anonimizada.
- Roles: `owner` (todo, incluido ROJO), `operator` (VERDE y AMARILLO), `viewer` (lectura). Cada server action vuelve a comprobar rol y política.
- Los usuarios se crean por CLI (`npm run user:create`), no hay registro público.

## Endpoints
| Endpoint | Protección |
|---|---|
| `/dashboard/*` | Sesión obligatoria (layout) + rol por acción |
| `/api/leads` | Validación zod, honeypot, límite 5/h por visitante, verificación de origen, tamaño máx. 10 KB |
| `/api/webhooks/mercadopago` | Firma HMAC `x-signature` + consulta a la API; nunca se confía en el cuerpo |
| `/api/cron/<rutina>` | `Authorization: Bearer CRON_SECRET` con comparación en tiempo constante |
| `/go/<slug>` | Solo destinos de dominios oficiales de Mercado Libre; slug validado |
Cabeceras: CSP, `X-Frame-Options: DENY`, `nosniff`, HSTS, `Referrer-Policy`, `Permissions-Policy`.

## Datos personales (LFPDPPP)
- Consentimiento explícito obligatorio (restricción en la base: `lead_requires_contact_consent`).
- Aviso de privacidad versionado; el borrador debe revisarlo el responsable legal.
- IP y user-agent solo como HMAC con sal secreta. La auditoría no guarda datos personales.
- Correos comerciales: solo aprobados, a leads con consentimiento, con tope diario.

## Integridad
- `audit_log` append-only encadenado por SHA-256; `npm run audit:verify` y Risk & Compliance diario detectan alteraciones o borrados.
- Rutinas deduplicadas por periodo; tareas con clave de idempotencia; ingresos deduplicados por `(source, external_id)`.

## Permisos de herramientas
- No usar modo de permisos ilimitados como configuración permanente en Claude Code.
- Workflows de GitHub con `permissions: contents: read` y entradas pasadas por variables de entorno (sin interpolación en shell).

## Reporte de vulnerabilidades
Abrir un issue privado o escribir al propietario. No publicar detalles hasta corregir.
