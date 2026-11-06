# Agente de WhatsApp de La Casa de la Mantarraya

Aplicación Node.js para conectar el número de WhatsApp Business del restaurante con Meta Cloud API y OpenAI Responses API. Incluye la carta capturada del sitio oficial, respuestas inmediatas para preguntas frecuentes y un flujo conversacional que conserva fecha, hora, asistentes y menú para cotizar posadas.

> El código está preparado para operar, pero el número no queda activo hasta que el administrador del restaurante complete Meta, OpenAI y el alojamiento HTTPS. No pongas contraseñas ni claves en este chat.

## Qué hace

- Responde preguntas abiertas en español con IA usando el menú y los datos del restaurante como contexto.
- Contesta al instante preguntas frecuentes de menú, horarios, ubicación, reservaciones, salsa y posadas.
- Entiende errores frecuentes como “pasada” por “posada” y “dicmbre” por “diciembre”. Mantiene los datos entre mensajes y no vuelve a preguntar fecha, hora o personas que ya recibió.
- Calcula el total de alimentos y el 30% de apartado para los paquetes de posada publicados.
- Si configuras correo SMTP, avisa al equipo cuando completa una solicitud de posada o de mesa. Si el correo no está configurado, el agente no finge que envió la solicitud y comparte los contactos para confirmar.
- Verifica la firma de los webhooks de Meta, ignora mensajes duplicados y no confirma una mesa sin respuesta del equipo.

## Necesitas

1. Acceso de administrador al portafolio de Meta y a la cuenta de WhatsApp Business del restaurante.
2. Una clave de OpenAI API y un modelo disponible para Responses API.
3. Un servidor Node.js 20 a 24, con URL HTTPS pública y proceso activo.
4. Una cuenta SMTP y un correo interno del restaurante si quieres que las solicitudes completas de posada y mesa lleguen automáticamente al equipo.

La suscripción de ChatGPT no reemplaza la clave de OpenAI API. La clave se guarda en el servidor, nunca en el navegador ni dentro de los archivos de la carta.

## Paso 1: preparar el servidor

Extrae el ZIP y abre PowerShell en la carpeta `la-casa-mantarraya-whatsapp-agent`.

```powershell
Copy-Item .env.example .env
npm install
```

Abre `.env` con un editor y completa:

| Variable | Qué valor poner |
|---|---|
| `PORT` | Puerto que indique tu proveedor; localmente puedes dejar `3000`. |
| `VERIFY_TOKEN` | Frase secreta larga inventada por ti; usarás exactamente la misma en Meta. |
| `META_APP_SECRET` | App Secret de la app de Meta. |
| `WHATSAPP_ACCESS_TOKEN` | Token de acceso del usuario de sistema de Meta para producción. |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone Number ID del número conectado, no el número telefónico. |
| `META_GRAPH_API_VERSION` | Versión vigente que muestre el panel de Meta Developers. |
| `OPENAI_API_KEY` | Clave del proyecto de API de OpenAI. |
| `OPENAI_MODEL` | Nombre de un modelo habilitado en tu proyecto que admita Responses API. |
| `STAFF_NOTIFY_EMAIL` | Correo interno que recibirá solicitudes completas de posada y mesa. Déjalo vacío para no usar avisos por correo. |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM` | Datos SMTP del correo remitente. Pídelos al administrador de correo del restaurante. |

Con `MAIL_SECURE=true`, normalmente se usa el puerto seguro que indique tu proveedor. No supongas ni compartas contraseñas de correo; solicita una credencial exclusiva para la aplicación.

## Paso 2: crear y configurar OpenAI API

1. Entra a la plataforma de OpenAI API e inicia sesión con la cuenta del restaurante o del responsable que pagará el uso.
2. Crea un proyecto para el agente y establece un límite de gasto y alertas.
3. Crea una clave para ese proyecto y guárdala en `OPENAI_API_KEY` dentro de `.env` o en el gestor de secretos del servidor.
4. Revisa qué modelos tiene habilitados el proyecto y escribe uno compatible con Responses API en `OPENAI_MODEL`.

La clave completa se muestra al crearla; mantenla en privado y rótala si alguien la expone. [Ayuda oficial de claves](https://help.openai.com/en/articles/4936850-where-do-i-find-my-openai-api-key) · [SDK oficial y Responses API](https://github.com/openai/openai-node/blob/main/docs/responses.md).

## Paso 3: conectar WhatsApp en Meta

Los nombres exactos de algunos botones cambian en el panel de Meta, así que usa su guía actual durante el alta.

1. En [Meta for Developers](https://developers.facebook.com/), crea una app de tipo negocio y agrega el caso de uso de WhatsApp Business Platform.
2. En la configuración de WhatsApp, conecta el portafolio y la cuenta WABA del restaurante. Para empezar, usa el número de prueba que proporciona Meta.
3. Copia el **Phone Number ID** y crea un token de usuario de sistema para la app. Guarda el token en `WHATSAPP_ACCESS_TOKEN` y el ID en `WHATSAPP_PHONE_NUMBER_ID`.
4. En la configuración general de la app, copia el **App Secret** a `META_APP_SECRET`.
5. Deja en `META_GRAPH_API_VERSION` la versión Graph vigente que indique el panel.
6. Deja lista la app; configurarás su webhook cuando el servidor tenga su dominio HTTPS en el Paso 5.
7. Añade el teléfono del responsable como destinatario de prueba en Meta; enviarás el mensaje de prueba en el Paso 5.

La documentación de Meta describe el inicio, los webhooks y la configuración de WhatsApp Business Platform: [portal de desarrolladores](https://whatsappbusiness.com/developers/developer-hub/) · [guía de inicio](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started/).

### Si quieres conectar el número que ya usa el restaurante

Haz este paso desde el administrador del restaurante. Meta debe autorizar el registro, coexistencia o migración del número según su estado actual. No lo desconectes de WhatsApp Business App hasta ver en Meta cuál flujo se aplica y confirmar que el equipo conserva el acceso requerido.

## Paso 4: publicar en un servidor HTTPS

### Ruta sencilla: GitHub privado + Render

Esta aplicación ya viene preparada para Render. El servicio debe mantenerse activo: el plan gratuito de Render se duerme tras 15 minutos sin tráfico y puede tardar alrededor de un minuto en volver, así que elige un plan de pago para atender clientes de forma continua. [Render explica las limitaciones del plan gratuito](https://render.com/docs/free).

1. Descomprime el ZIP y crea un repositorio **privado** en GitHub para el restaurante.
2. Sube al repositorio el contenido de la carpeta `la-casa-mantarraya-whatsapp-agent`. No subas el archivo `.env`; el `.gitignore` ya lo excluye.
3. En Render, elige **New > Web Service** y conecta el repositorio privado.
4. Configura **Language: Node**, **Build Command: `npm install`** y **Start Command: `npm start`**. El paquete fija Node 22.22.0 mediante `.node-version`.
5. Selecciona una instancia que no se duerma, crea el servicio y espera a que termine el despliegue. Render asignará una dirección HTTPS `onrender.com`.
6. En la pestaña **Environment** agrega las variables del `.env.example` como secretos. Al terminar, guarda y despliega de nuevo. Render permite agregar las variables desde la sección Environment del servicio. [Guía oficial de Render](https://render.com/docs/configure-environment-variables).
7. Abre `https://TU-SERVICIO.onrender.com/health`. Debe indicar `ok: true`, `whatsappConfigured: true` y `aiConfigured: true`; configura primero los secretos si marca `false`.
8. Usa `https://TU-SERVICIO.onrender.com/webhook` como URL de callback en Meta. Sigue el Paso 3 para verificar el token y suscribirte a `messages`.

Render describe el alta de un servicio Express con `npm install` y `npm start` en su [guía oficial de Node.js](https://render.com/docs/deploy-node-express-app).

### Si prefieres otro proveedor

1. Sube la carpeta del agente al repositorio privado o al panel de archivos de tu proveedor. No subas `.env`.
2. Configura el comando de instalación `npm install` y el de inicio `npm start`.
3. Añade las variables del `.env` en la sección de secretos/variables del proveedor. No publiques sus valores en logs ni capturas.
4. Espera a que el proceso inicie. El proveedor debe asignar un dominio HTTPS; usa ese dominio en el webhook de Meta.
5. Abre `https://TU-DOMINIO/health`. Con Meta y OpenAI configurados debe devolver `ok: true`; `staffEmailConfigured` muestra si también quedó habilitado el aviso de posadas por correo.
6. Mantén una sola instancia mientras se usa el almacenamiento de conversación en memoria. Si el proceso se reinicia, la conversación activa se pierde y el cliente tendrá que repetir los datos.

También se incluye un `Dockerfile` para proveedores que aceptan contenedores. En una computadora con Docker instalado puedes construir y ejecutar el contenedor con `docker build -t mantarraya-agent .` y luego `docker run --env-file .env -p 3000:3000 mantarraya-agent`.

## Paso 5: terminar la conexión del webhook de Meta

1. Regresa a Meta Developers y abre la configuración de **Webhooks** de WhatsApp.
2. Escribe como URL de callback `https://TU-SERVICIO.onrender.com/webhook` (o el dominio HTTPS que te dé tu proveedor).
3. En token de verificación pega exactamente el `VERIFY_TOKEN` que configuraste en el servidor.
4. Pulsa **Verify and Save** y suscribe el campo `messages` de la cuenta WhatsApp Business.
5. Envía un WhatsApp de prueba desde un teléfono que Meta tenga autorizado. Revisa que llegue la respuesta.
6. Solo después de comprobar la prueba, solicita la conexión o migración del número real desde el administrador del restaurante. Meta determina si aplica coexistencia o migración.

## Paso 6: configurar avisos de posada al personal (recomendado)

Completa las variables SMTP con una cuenta controlada por el restaurante y usa como destinatario un correo interno aprobado por el responsable. Cuando el cliente termine de dar fecha, hora y personas para una mesa, o fecha, hora, personas y menú para una posada, el agente enviará un correo con su número de WhatsApp y los datos de la solicitud. La solicitud sigue pendiente hasta que el equipo confirme disponibilidad.

Sin SMTP, el agente continúa atendiendo y calculando el paquete, pero pide al cliente escribir al [WhatsApp de reservaciones](https://wa.me/529984895643) o llamar al **+52 998 255 6502** para que el equipo confirme. El agente nunca dirá que envió una solicitud si el correo no salió correctamente.

## Conversación de posada preparada

El agente reconoce una conversación como esta, incluso con errores de escritura:

1. Cliente: “Quiero una pasada para el 6 de dicmbre a las 10 pm”.
2. Agente: confirma que entendió posada, conserva fecha y hora, y pregunta por las personas y el menú que falta.
3. Cliente: “20 personas, el de 380”.
4. Agente: resume 20 personas, menú de $380, subtotal de alimentos de **$7,600 MXN** y apartado publicado del 30% (**$2,280 MXN**); avisa que las 10 p. m. quedan cerca del cierre y requiere confirmación del equipo.
5. Con SMTP configurado, manda la solicitud al correo del restaurante; sin SMTP, comparte el WhatsApp de reservaciones y el teléfono para confirmar.

Si el cliente corrige la fecha, por ejemplo “para el 10 de diciembre”, el agente actualiza ese dato y conserva el resto. El menú de $380 publicado incluye sopa de lima, pechuga rellena y budín de la casa. Las condiciones y disponibilidad las confirma el restaurante.

## Datos, límites y mantenimiento

- La carta `menu.json` refleja el menú público capturado el **5 de noviembre de 2026**. Actualízala cuando cambien productos o precios.
- Los horarios y promociones vienen del sitio oficial; los detalles que aparecen contradictorios están marcados para que el agente no invente una respuesta.
- No hay integración con una agenda de mesas ni con un sistema de pedidos. Por eso el asistente no confirma reservaciones, pedidos ni disponibilidad en tiempo real.
- Las sesiones y el contexto se guardan temporalmente en memoria durante un máximo de seis horas; no se conserva el historial al reiniciar el proceso.
- Las solicitudes a OpenAI usan `store: false`; los controles de retención y monitoreo de la cuenta siguen aplicando según la configuración de OpenAI.
- Solo se atienden mensajes de texto. Para imágenes, audio o documentos, el bot invita al cliente a escribir su pregunta.
- Meta controla el alta, los permisos del número y sus políticas de mensajería. El servicio contesta mensajes entrantes; no inicia campañas.

## Archivos

- `server.mjs`: aplicación y webhook de WhatsApp.
- `Dockerfile`: imagen para alojar la aplicación en un servicio de contenedores.
- `.node-version`: versión de Node fijada para el despliegue.
- `business-info.json`: datos del restaurante, contacto, promociones y paquetes de posada.
- `menu.json`: alimentos y bebidas extraídos del menú oficial.
- `agent/system-prompt.md`: tono, políticas de respuesta y flujo de atención.
- `.env.example`: plantilla de configuración; copia a `.env` y completa en privado.
- `source-audit.md`: canales revisados, fuentes y datos que necesitan confirmación.
