# Despliegue en producción

La app es un servidor Node.js sin estado más una base PostgreSQL. Funciona en cualquier proveedor que ejecute Node o contenedores. Aquí hay dos rutas probadas: **Render** (la más sencilla, y la que ya usa el agente de WhatsApp de este repositorio) y **Docker en un VPS**.

## Requisitos de producción

- `NODE_ENV=production`
- `APP_URL` con `https://` y el dominio definitivo. La app se niega a arrancar sin HTTPS.
- `DATABASE_URL` de PostgreSQL 14 o superior (probado con 16). La base embebida está deshabilitada en producción.
- `TRUST_PROXY=1` si hay un proxy o balanceador delante (Render, Railway, Nginx o Caddy).
- SMTP configurado si `REQUIRE_EMAIL_VERIFICATION=true` (recomendado).

Las migraciones se aplican solas al iniciar. Es seguro iniciar varias instancias a la vez porque usan un candado.

## Opción A: Render con Blueprint

El archivo `render.yaml` de la raíz del repositorio crea el servicio web (carpeta `saas/`) y una base PostgreSQL en la misma región. No modifica el servicio del agente de WhatsApp.

1. Sube el repositorio a GitHub (privado).
2. En Render: **New → Blueprint**, conecta el repositorio y confirma que detectó `render.yaml`.
3. Render te pedirá los valores marcados como secretos:
   - `APP_URL`: `https://impulsaia.onrender.com` (o el nombre que Render asigne; puedes corregirlo después) o tu dominio.
   - `APP_NAME`, `ADMIN_EMAILS` (tu correo), `SUPPORT_EMAIL`.
   - `AI_PROVIDER`, `AI_MODEL` y la clave del proveedor que uses. Deja vacía la del proveedor que no uses.
   - `STRIPE_SECRET_KEY` (empieza en modo de prueba). Deja `STRIPE_WEBHOOK_SECRET` vacío por ahora (paso 6).
   - `MAIL_*` de tu proveedor SMTP.
4. Aplica el Blueprint y espera a que termine el despliegue. Abre `https://TU-APP.onrender.com/health`: debe responder `{"ok":true,"database":"ok"}`.
5. Crea tu cuenta en el sitio y confirma tu correo. Como está en `ADMIN_EMAILS`, quedarás como administrador. En el panel (`/admin`) la sección **Sistema** muestra advertencias de configuración pendientes.
6. **Webhook de Stripe**: en Stripe, **Desarrolladores → Webhooks → Agregar destino**:
   - URL: `https://TU-APP.onrender.com/api/webhooks/stripe`
   - Eventos: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
   - Copia el secreto de firma (`whsec_...`) a `STRIPE_WEBHOOK_SECRET` en Render (**Environment**) y guarda; Render vuelve a desplegar.
7. Crea los precios en Stripe desde tu computadora con la misma clave: `STRIPE_SECRET_KEY=sk_... npm run stripe:setup` (en la carpeta `saas`). Configura el portal de clientes como indica [INSTALACION.md](INSTALACION.md#4-pagos-de-prueba-con-stripe).
8. Haz una compra de prueba con la tarjeta `4242 4242 4242 4242` y verifica en el panel de administración que aparezcan la suscripción y el pago.
9. Dominio propio: en Render, **Settings → Custom Domains**. Después actualiza `APP_URL` y la URL del webhook en Stripe.

Notas:

- La región `ohio` es una de las más cercanas a México; puedes cambiarla en `render.yaml` antes de crear el Blueprint (la app y la base deben estar en la misma región).
- No uses instancias gratuitas para producción: se duermen sin tráfico y la primera visita tarda.
- Para ejecutar comandos (por ejemplo `npm run admin:promote -- correo`) usa la pestaña **Shell** del servicio.
- Revisa las opciones de respaldo de tu plan de base de datos en Render y actívalas.

## Opción B: Docker en un VPS

Sirve para cualquier servidor Linux con Docker (DigitalOcean, Hetzner, AWS Lightsail, etc.).

```bash
git clone <tu repositorio> && cd agente-de-ia-/saas
cp .env.example .env
# Edita .env: NODE_ENV=production, APP_URL=https://tudominio.mx, claves, SMTP, y agrega:
# POSTGRES_PASSWORD=<contraseña larga y aleatoria>
docker compose up -d --build
docker compose logs -f app
```

La app queda en `127.0.0.1:3000`, accesible solo desde el propio servidor. Pon delante un proxy con HTTPS. Con [Caddy](https://caddyserver.com), que obtiene y renueva el certificado solo, basta con este `Caddyfile`:

```
tudominio.mx {
    reverse_proxy 127.0.0.1:3000
}
```

Para crear un administrador: `docker compose exec app npm run admin:promote -- tu-correo@ejemplo.com`.

Respaldos diarios de la base (ejemplo con cron):

```bash
docker compose exec -T db pg_dump -U impulsaia impulsaia | gzip > respaldo-$(date +%F).sql.gz
```

Guarda los respaldos fuera del servidor y prueba restaurarlos.

## Otros proveedores (Railway, Fly.io, Google Cloud Run, AWS)

- Comando de instalación: `npm ci --omit=dev`. Comando de inicio: `npm start`. Directorio raíz: `saas`.
- O usa el `Dockerfile` (usuario sin privilegios y verificación de salud incluidos).
- Ruta de verificación de salud: `/health`.
- Define las variables de entorno de `.env.example` en el panel del proveedor.

## Activar cobros reales (Stripe en modo producción)

1. Completa la activación de tu cuenta de Stripe: datos del negocio, representante y cuenta bancaria (CLABE) para recibir depósitos.
2. Cambia a **modo producción** y repite con la clave `sk_live_...`: `npm run stripe:setup`, configuración del portal de clientes y webhook (con su propio `whsec_...`, distinto al de prueba).
3. Actualiza `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` en el servidor.
4. Haz una compra real con tu tarjeta y cancélala desde el portal para comprobar todo el ciclo.
5. Consulta con tu contador cómo declarar el IVA de las suscripciones y cómo emitir CFDI. El script crea los precios con IVA incluido (`tax_behavior: inclusive`); Stripe cobra, pero no declara impuestos por ti.

## Lista de verificación antes de abrir al público

- [ ] `/health` responde `ok` y el panel no muestra advertencias en **Sistema**.
- [ ] Registro, confirmación de correo y recuperación de contraseña funcionan con correo real (y no llegan a spam).
- [ ] Una compra de prueba activa el plan; cancelar desde el portal lo regresa a Gratis al terminar el periodo.
- [ ] Límite de gasto configurado en el proveedor de IA y alertas de facturación activas.
- [ ] Textos de `/privacidad` y `/terminos` completados con tus datos y revisados por un abogado.
- [ ] Respaldos de la base activados y probados.
- [ ] Monitoreo de disponibilidad (por ejemplo UptimeRobot o Better Stack) apuntando a `/health`.
- [ ] Revisión de los logs del proveedor después del primer día.

## Escalar

- **Más instancias**: la app no guarda estado en memoria (sesiones, créditos y límites viven en PostgreSQL), así que puedes subir el número de instancias detrás del balanceador.
- **Conexiones a la base**: cada instancia abre hasta `DATABASE_POOL_MAX` conexiones (10 por defecto). Instancias × pool debe ser menor que el máximo de conexiones de tu plan de PostgreSQL; si no alcanza, usa PgBouncer o el pooler de tu proveedor.
- **Peticiones largas**: cada generación ocupa una petición HTTP mientras responde la IA (límite `AI_TIMEOUT_MS`). Con miles de usuarios simultáneos conviene mover las generaciones a una cola de trabajos (por ejemplo, BullMQ con Redis) y avisar al navegador cuando terminen.
- **Mantenimiento**: cada hora la app borra sesiones vencidas, límites de peticiones viejos y el contenido del historial que ya venció. Es seguro que corra en todas las instancias.
- **Índices**: el esquema ya indexa las consultas frecuentes (historial por usuario y fecha, estadísticas por fecha y suscripciones por estado).
