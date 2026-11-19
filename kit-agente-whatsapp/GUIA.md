# Kit: Agente de WhatsApp con IA para tu negocio

Guía paso a paso para que tu WhatsApp Business conteste solo, las 24 horas, con los datos reales de tu negocio.

## Qué incluye este kit

- **El agente listo para usar** (`server.mjs`): recibe los mensajes de WhatsApp, contesta al instante las preguntas frecuentes y usa inteligencia artificial (OpenAI o Claude) para el resto, sin inventar datos.
- **Tu ficha de negocio** (`negocio.json`): el único archivo que editas, con horario, dirección, catálogo, precios y respuestas frecuentes.
- **Seguridad incluida**: verificación de la firma de Meta, mensajes duplicados ignorados y respuesta de respaldo si la IA falla.
- **Pruebas automáticas** (`npm test`).
- **Esta guía**, con los pasos en Meta, la IA y el servidor.

## Lo que necesitas

1. Una cuenta de Meta Business y el número de WhatsApp de tu negocio.
2. Una clave de IA: OpenAI (platform.openai.com) o Anthropic (console.anthropic.com). Configura un límite de gasto mensual.
3. Un servidor con HTTPS. Lo más fácil es Render.com: sube el kit a un repositorio privado de GitHub y conéctalo.
4. Node.js 20.12 o superior si quieres probarlo en tu computadora.

**Costos mensuales aproximados** (los pagas directo a cada proveedor): servidor desde unos 7 USD; IA unos pocos dólares para un negocio pequeño; mensajes de WhatsApp según las tarifas de Meta. Las conversaciones que inicia el cliente suelen tener costo bajo o nulo según tu país; revisa la tabla vigente de Meta.

## Paso 1: llena los datos de tu negocio

Abre `negocio.json` y cambia el ejemplo de "Café La Esquina" por tus datos:

- `nombre`, `giro`, `ciudad`, `direccion`, `mapa`, `horario`, `formas_de_pago`, `entregas`, `reservaciones`.
- `telefono_humano`: a dónde mandar al cliente cuando el agente no sabe algo.
- `catalogo`: tus productos o platillos con su precio.
- `preguntas_frecuentes`: palabras clave y la respuesta exacta. Estas se contestan al instante y sin costo de IA.
- `reglas_extra`: instrucciones especiales, por ejemplo cómo tomar pedidos.

Consejo: copia tus 10 preguntas más repetidas de WhatsApp y conviértelas en preguntas frecuentes.

## Paso 2: pruébalo en tu computadora

```
npm install
cp .env.example .env      (en Windows: copy .env.example .env)
```

En `.env` llena `AI_PROVIDER`, `AI_MODEL` y la clave de tu proveedor. Luego:

```
npm start
```

Prueba sin WhatsApp enviando un mensaje al agente:

```
curl -X POST http://localhost:3000/probar -H "Content-Type: application/json" -d "{\"mensaje\":\"¿Cuánto cuesta un pastel para 20 personas?\"}"
```

Ajusta `negocio.json` hasta que las respuestas te gusten.

## Paso 3: crea la app de WhatsApp en Meta

1. Entra a developers.facebook.com, crea una app de tipo **Negocio** y agrega **WhatsApp**.
2. Conecta tu cuenta de WhatsApp Business. Para empezar puedes usar el número de prueba que da Meta.
3. Copia el **Phone Number ID** a `WHATSAPP_PHONE_NUMBER_ID`.
4. Crea un **usuario de sistema** con un token permanente y cópialo a `WHATSAPP_ACCESS_TOKEN`.
5. En la configuración básica de la app, copia el **App Secret** a `META_APP_SECRET`.
6. Inventa una frase larga para `VERIFY_TOKEN`.

## Paso 4: publícalo en internet (Render)

1. Sube la carpeta del kit a un repositorio **privado** de GitHub. Nunca subas el archivo `.env`.
2. En Render: **New → Web Service**, conecta el repositorio. Build command `npm install`, start command `npm start`.
3. Elige un plan de pago que no se duerma; el gratuito tarda en despertar y el cliente espera.
4. En **Environment** agrega todas las variables de tu `.env` y agrega `NODE_ENV=production`.
5. Abre `https://TU-SERVICIO.onrender.com/health`. Debe responder `ok: true`.

## Paso 5: conecta el webhook

1. En Meta, ve a WhatsApp → **Configuración** → **Webhook**.
2. URL: `https://TU-SERVICIO.onrender.com/webhook`. Token de verificación: tu `VERIFY_TOKEN`.
3. Presiona **Verificar y guardar** y suscríbete al campo **messages**.
4. Escribe desde tu teléfono al número. Debe contestar en segundos.
5. Cuando todo funcione con el número de prueba, conecta el número real desde el administrador de Meta.

## Problemas comunes

| Síntoma | Solución |
|---|---|
| Meta no verifica el webhook | El `VERIFY_TOKEN` debe ser idéntico en Meta y en Render, y el servicio debe estar encendido. |
| Llegan mensajes pero no contesta | Revisa los logs de Render: casi siempre es el token de WhatsApp o el Phone Number ID. |
| Contesta "no puedo darte ese dato" | Falta `AI_MODEL` o la clave de IA, o se acabó el saldo del proveedor. |
| Responde algo incorrecto | Corrige el dato en `negocio.json` o agrega una pregunta frecuente con la respuesta exacta. |

## Siguientes mejoras

- Avisos por correo al equipo cuando alguien completa un pedido o reservación.
- Guardar las conversaciones en una base de datos para no perder el contexto al reiniciar.
- Panel para editar los datos sin tocar archivos.

## ¿Prefieres que lo instale por ti?

Si no tienes tiempo para estos pasos, responde al correo de tu compra con el asunto **"Instalación"** y te envío una cotización para dejarlo funcionando en tu número en 3 a 5 días hábiles.
