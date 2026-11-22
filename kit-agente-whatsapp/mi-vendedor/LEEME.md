# Tu asistente vendedor en WhatsApp

Este asistente atiende **tu propio número de WhatsApp Business**: contesta a los negocios que te escriben, les explica el servicio y los precios, y anota los datos (nombre del negocio, giro, ciudad y mensajes al día) para que tú les escribas.

Además es tu mejor demostración: el dueño del negocio prueba en vivo cómo funcionaría en el suyo.

## Importante
- **Solo contesta a quien te escribe primero.** WhatsApp no permite mandar mensajes de venta a personas que no te han escrito; si se hace, Meta bloquea el número.
- Para que te escriban, pon el enlace `https://wa.me/52TUNUMERO` en tus publicaciones, tu perfil de LinkedIn y X, y en la ficha de Google de tu negocio.

## Pasos
1. Cambia `[TU NÚMERO PERSONAL DE WHATSAPP]` en `negocio.json` por tu número personal (a donde el asistente manda a los clientes).
2. Sigue la guía `GUIA.md` (pasos 3 a 5: Meta, Render y webhook) con el número nuevo.
3. En Render agrega la variable `NEGOCIO_FILE=mi-vendedor/negocio.json`.
4. Escríbele desde tu teléfono y revisa que conteste bien.
