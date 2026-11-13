# Instalación y configuración local

Esta guía deja la plataforma funcionando en tu computadora, con IA real y pagos de prueba de Stripe. Para publicarla en internet sigue después [DESPLIEGUE.md](DESPLIEGUE.md).

## 1. Requisitos

- **Node.js 22** (funciona desde 20.12). Comprueba con `node --version`.
- Git.
- Opcional: cuenta de Stripe, clave de API de OpenAI o Anthropic y una cuenta SMTP. Sin ellas la plataforma funciona en modo demostración.

No necesitas instalar PostgreSQL: en desarrollo, si `DATABASE_URL` está vacía, la app usa PGlite (PostgreSQL embebido) y guarda los datos en `saas/data/pglite`.

## 2. Instalar y arrancar

```bash
git clone <tu repositorio>
cd agente-de-ia-/saas
npm install
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
npm run dev
```

Abre http://localhost:3000.

1. Crea una cuenta en **Crear cuenta gratis**.
2. Sin SMTP, el enlace para confirmar tu correo se imprime en la terminal (`correo (modo desarrollo, no enviado)`). Ábrelo en el navegador.
3. Entra a **Herramientas**, elige una y presiona **Probar con un ejemplo** y luego **Generar**.

### Convertirte en administrador

Elige una de estas opciones:

- Antes de confirmar tu correo, agrega tu correo a `ADMIN_EMAILS` en `.env` y reinicia el servidor. Al confirmar el correo se te asigna el rol de administrador.
- O, con tu cuenta ya creada: `npm run admin:promote -- tu-correo@ejemplo.com`

Vuelve a iniciar sesión y abre http://localhost:3000/admin.

## 3. Conectar la IA

Edita `.env` con **uno** de los proveedores:

```ini
# OpenAI (Responses API)
AI_PROVIDER=openai
AI_MODEL=<modelo habilitado en tu proyecto>
OPENAI_API_KEY=sk-...

# o Anthropic (Messages API)
AI_PROVIDER=anthropic
AI_MODEL=<ID del modelo, por ejemplo claude-haiku-5-5>
ANTHROPIC_API_KEY=sk-ant-...
```

- Crea la clave en la consola del proveedor (platform.openai.com o console.anthropic.com) y **configura un límite de gasto mensual**. Los usuarios generan costos de IA aunque estén en el plan gratuito.
- Elige un modelo rápido y económico para empezar: las herramientas generan textos cortos. Revisa en la documentación del proveedor qué modelos tiene habilitados tu cuenta.
- Para ver el costo estimado en el panel, copia los precios por millón de tokens de tu modelo en `AI_COST_INPUT_USD_PER_MTOK` y `AI_COST_OUTPUT_USD_PER_MTOK`.

Reinicia (`npm run dev` se reinicia solo al cambiar código, pero no al cambiar `.env`).

## 4. Pagos de prueba con Stripe

Stripe opera en México y cobra en pesos. Trabaja siempre primero en **modo de prueba**.

1. Crea una cuenta en https://dashboard.stripe.com y activa **Modo de prueba**.
2. En **Desarrolladores → Claves de API**, copia la clave secreta `sk_test_...` a `STRIPE_SECRET_KEY`.
3. Crea los productos y precios mensuales en MXN:
   ```bash
   npm run stripe:setup
   ```
   El script crea "ImpulsaIA Pro" ($199) y "ImpulsaIA Negocio" ($499) con los `lookup_key` que usa la app. Puedes ejecutarlo varias veces; si cambias `PLAN_PRO_PRICE_MXN` crea un precio nuevo para las nuevas suscripciones.
4. Configura el **portal de cliente**: en Stripe, **Configuración → Facturación → Portal de clientes**. Activa actualizar el método de pago, cancelar suscripciones y cambiar de plan (agrega los productos Pro y Negocio), y **guarda**. Sin este paso el botón "Administrar suscripción" falla.
5. Recibe los webhooks en tu computadora con la [CLI de Stripe](https://docs.stripe.com/stripe-cli):
   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   La CLI muestra un secreto `whsec_...`: cópialo a `STRIPE_WEBHOOK_SECRET` y reinicia la app.
6. En la app, ve a **Planes y pagos → Elegir Pro** y paga con la tarjeta de prueba `4242 4242 4242 4242`, cualquier fecha futura y cualquier CVC. Al volver, el plan se activa en segundos (la terminal de `stripe listen` muestra los eventos).

Prueba también una tarjeta que el banco rechaza (`4000 0000 0000 0341`, se acepta al guardarla y falla al cobrar) para ver el aviso de pago pendiente. Stripe documenta todas sus tarjetas de prueba en docs.stripe.com/testing.

## 5. Correo (SMTP)

Necesario en producción para confirmar cuentas y recuperar contraseñas. Sirve cualquier proveedor SMTP (Amazon SES, Brevo, Resend, Mailgun o el correo de Google Workspace o Microsoft 365).

```ini
MAIL_HOST=smtp.tu-proveedor.com
MAIL_PORT=587
MAIL_SECURE=false        # true si usas el puerto 465
MAIL_USER=usuario
MAIL_PASS=contraseña-o-clave-de-aplicación
MAIL_FROM=ImpulsaIA <no-reply@tudominio.mx>
```

Configura SPF y DKIM en el DNS de tu dominio según las instrucciones de tu proveedor; sin ellos los correos suelen llegar a spam.

## 6. Pruebas automatizadas

```bash
npm test
```

Las pruebas levantan la app completa con una base en memoria y dependencias simuladas (IA, Stripe y correo), así que no cuestan nada ni requieren red. Para probar contra PostgreSQL real:

```bash
TEST_DATABASE_URL=postgres://usuario:contraseña@localhost:5432/postgres npm test
```

Cada archivo de pruebas crea y borra su propia base temporal.

## 7. Problemas comunes

| Síntoma | Solución |
|---|---|
| `Configuración inválida` al arrancar | Revisa el nombre de la variable que indica el mensaje en `.env`. |
| `AI_PROVIDER=openai requiere OPENAI_API_KEY` | Falta la clave o el modelo del proveedor elegido; o usa `AI_PROVIDER=mock`. |
| "Confirma tu correo" y no llega nada | Sin SMTP el enlace está en la terminal. Con SMTP revisa spam, SPF/DKIM y los logs. |
| "Los pagos aún no están habilitados" | Faltan `STRIPE_SECRET_KEY` o `STRIPE_WEBHOOK_SECRET`. |
| "No existe en Stripe un precio con lookup_key…" | Ejecuta `npm run stripe:setup` con la misma clave (prueba o producción) que usa la app. |
| Pagué y el plan no cambia | ¿Está corriendo `stripe listen`? ¿Coincide `STRIPE_WEBHOOK_SECRET`? Revisa la terminal. |
| `Origen no permitido` | `APP_URL` debe ser exactamente la dirección con la que abres el sitio (protocolo, dominio y puerto). |
