# Seguridad y privacidad

Resumen de los controles implementados, cómo operar la plataforma de forma segura y qué falta para etapas posteriores.

## Controles implementados

| Riesgo | Control | Dónde |
|---|---|---|
| Robo de contraseñas | scrypt (N=2^15, r=8, p=1) con sal aleatoria; comparación en tiempo constante; mínimo 10 caracteres y no puede contener el correo | `src/lib/security.js`, `src/routes/auth.js` |
| Enumeración de cuentas | Inicio de sesión con error genérico y hash calculado aunque el correo no exista; la recuperación de contraseña responde igual exista o no la cuenta | `src/routes/auth.js` |
| Fuerza bruta | Límite por IP y por correo en inicio de sesión (10 cada 15 min), registro (5 por hora por IP), correos y tokens; contador de intentos fallidos visible en el panel | `src/services/rateLimit.js` |
| Robo de sesión | Token aleatorio de 256 bits; en la base solo se guarda su hash SHA-256; cookie `__Host-` con HttpOnly, Secure y SameSite=Lax; caduca a los 30 días; sesión nueva en cada inicio de sesión | `src/services/sessions.js` |
| Sesiones tras incidentes | Cambiar o restablecer la contraseña cierra las demás sesiones; suspender una cuenta cierra todas | `src/routes/account.js`, `src/routes/admin.js` |
| CSRF | Los métodos que modifican datos exigen `Origin` (o `Sec-Fetch-Site`) del propio sitio y cuerpo JSON | `src/middleware/security.js` |
| XSS | CSP estricta (`script-src 'self'`, sin scripts ni estilos en línea); la interfaz inserta todo el texto con `textContent`, nunca `innerHTML` | `src/middleware/security.js`, `public/js/dom.js` |
| Clickjacking y otros | `frame-ancestors 'none'`, HSTS en producción, `nosniff`, `Referrer-Policy: no-referrer`, sin `X-Powered-By` | Helmet |
| Inyección SQL | Todas las consultas son parametrizadas | `src/` |
| Entradas malformadas | Validación con zod de cada cuerpo y parámetro; los objetos tienen esquema estricto y se rechazan campos desconocidos; límite de 256 KB por petición | `src/routes/*` |
| Tokens por correo | Un solo uso, con vencimiento (48 h la confirmación y 1 h la recuperación) y guardados como hash. La confirmación se hace con POST desde la página, para que los antivirus que abren enlaces no la consuman. El token se quita de la barra de direcciones | `src/services/authTokens.js`, `public/js/auth.js` |
| Redirección abierta | El parámetro `next` del inicio de sesión solo acepta rutas internas | `public/js/dom.js` |
| Webhooks falsos | Verificación de la firma de Stripe sobre el cuerpo exacto; cada evento se procesa una sola vez; el estado se vuelve a consultar en la API de Stripe | `src/services/billing.js` |
| Abuso del plan gratuito y costos de IA | Confirmación de correo obligatoria, créditos atómicos, límite de caracteres por plan y de peticiones por minuto | `src/routes/tools.js` |
| Inyección de instrucciones (prompt injection) | Los datos del usuario van delimitados y el sistema indica tratarlos como datos. El resultado solo lo ve el mismo usuario y la IA no tiene herramientas ni acceso a otros datos, así que el impacto se limita a su propio texto | `src/ai/tools.js` |
| Escalada de privilegios | Las rutas de administración exigen el rol de administrador en el servidor; un administrador no puede suspenderse ni quitarse el rol; el único administrador no puede borrar su cuenta | `src/routes/admin.js` |
| Trazabilidad | Bitácora de auditoría de las acciones administrativas y de las eliminaciones de cuenta | `audit_log` |
| Privacidad | El panel de administración solo muestra metadatos de uso, no el contenido de los usuarios; los logs no registran contenido, tokens ni parámetros de URL; historial con caducidad por plan; exportación y eliminación de cuenta | `src/routes/admin.js`, `src/services/jobs.js` |
| Contenedor | Imagen con usuario sin privilegios y solo dependencias de producción | `Dockerfile` |

## Operación segura

- **Secretos** solo en variables de entorno del proveedor, nunca en el repositorio. `.env` está en `.gitignore`.
- **Rotación**: si una clave de Stripe, del proveedor de IA o SMTP se expone, rótala de inmediato en su consola y actualiza la variable.
- **Límites de gasto** en el proveedor de IA y alertas de facturación en Stripe.
- **Claves restringidas**: en producción puedes usar una clave restringida de Stripe con permisos de escritura solo en Checkout Sessions, Customers, Billing Portal y Subscriptions, y de lectura en Prices.
- **Respaldos** diarios de PostgreSQL, guardados fuera del servidor y con restauración probada.
- **Dependencias**: las versiones están fijadas en `package.json` y `package-lock.json`. Ejecuta `npm audit` y actualiza con regularidad.
- **Administradores**: pocos, con contraseñas largas y únicas. Revisa la bitácora de auditoría.

## Datos personales en México

La plataforma incluye las piezas técnicas para cumplir los derechos ARCO: acceso (descarga de datos), rectificación (edición de perfil), cancelación (eliminación de cuenta) y oposición (por correo, según el aviso de privacidad). El aviso de privacidad (`/privacidad`) es una plantilla: complétalo con el responsable, el domicilio, los encargados (proveedor de alojamiento, Stripe, proveedor de IA y de correo) y el medio de contacto, y revísalo con un abogado conforme a la ley de protección de datos personales vigente.

El texto que los usuarios escriben en las herramientas se envía al proveedor de IA. Revisa y menciona en tu aviso las políticas de retención y uso de datos del proveedor que elijas. Con OpenAI la app envía `store: false`.

## Pendiente para siguientes etapas

- Doble factor de autenticación (TOTP) para administradores y luego para usuarios.
- CAPTCHA o verificación invisible en el registro si aparecen registros automatizados.
- WAF o protección contra bots del proveedor (por ejemplo Cloudflare) delante del sitio.
- Alertas automáticas ante picos de errores o de consumo de IA.
- Revisión de seguridad externa antes de manejar volúmenes grandes.
