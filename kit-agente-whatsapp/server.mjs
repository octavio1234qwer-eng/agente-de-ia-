// Agente de WhatsApp con IA para cualquier negocio.
// 1) Edita negocio.json con los datos reales.  2) Copia .env.example a .env y complétalo.  3) npm install && npm start
import crypto from 'node:crypto';
import fs from 'node:fs';
import express from 'express';

if (fs.existsSync('.env') && typeof process.loadEnvFile === 'function') process.loadEnvFile('.env');

// NEGOCIO_FILE permite usar otra ficha (por ejemplo mi-vendedor/negocio.json) sin tocar la del ejemplo.
const negocioFile = process.env.NEGOCIO_FILE
  ? new URL(process.env.NEGOCIO_FILE, `file://${process.cwd()}/`)
  : new URL('./negocio.json', import.meta.url);
const negocio = JSON.parse(fs.readFileSync(negocioFile, 'utf8'));
const port = Number(process.env.PORT || 3000);
const sessions = new Map(); // historial corto por cliente (en memoria)
const seen = new Map(); // mensajes ya procesados (Meta puede reenviar)
const TTL = 6 * 60 * 60 * 1000;

setInterval(() => {
  const cutoff = Date.now() - TTL;
  for (const [k, v] of sessions) if (v.touchedAt < cutoff) sessions.delete(k);
  for (const [k, v] of seen) if (v < cutoff) seen.delete(k);
}, 15 * 60 * 1000).unref();

export const systemPrompt = () => [
  `Eres el asistente de WhatsApp de ${negocio.nombre} (${negocio.giro}) en ${negocio.ciudad}.`,
  `Responde en ${negocio.idioma || 'español'}, o en el idioma en que te escriba el cliente, de forma amable, breve (1 a 4 frases) y útil.`,
  'Usa SOLO los datos del negocio que aparecen abajo. Nunca inventes precios, horarios, disponibilidad, promociones ni políticas.',
  `Si no tienes un dato o el cliente pide hablar con una persona, ofrece el teléfono ${negocio.telefono_humano}.`,
  'No confirmes reservaciones ni pedidos: toma los datos (fecha, hora, número de personas, nombre) y explica que el equipo los confirmará.',
  'Contesta primero lo que preguntan y termina con una sola pregunta útil para avanzar.',
  ...(negocio.reglas_extra ?? []).map((r) => `Regla: ${r}`),
  '',
  `Datos del negocio: ${JSON.stringify({ ...negocio, preguntas_frecuentes: undefined, reglas_extra: undefined })}`,
].join('\n');

const normalize = (text) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Respuesta inmediata (sin IA) si el mensaje coincide con una pregunta frecuente. */
export function quickAnswer(text) {
  const n = normalize(text);
  for (const faq of negocio.preguntas_frecuentes ?? []) {
    if (faq.palabras.some((w) => new RegExp(`\\b${normalize(w)}\\b`).test(n))) return faq.respuesta;
  }
  return null;
}

async function askAI(history) {
  const provider = process.env.AI_PROVIDER || 'openai';
  const model = process.env.AI_MODEL;
  if (!model) throw new Error('Falta AI_MODEL');
  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({ model, max_tokens: 2000, system: systemPrompt(), messages: history }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Anthropic ${res.status}`);
    return (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  }
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({ model, instructions: systemPrompt(), input: history, max_output_tokens: 800, store: false }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  // La API REST devuelve el texto dentro de output[].content[]; output_text solo existe en los SDK.
  return (data.output ?? []).filter((i) => i.type === 'message').flatMap((i) => i.content ?? [])
    .filter((c) => c.type === 'output_text').map((c) => c.text).join('').trim();
}

export async function reply(sender, text) {
  const quick = quickAnswer(text);
  const session = sessions.get(sender) ?? { history: [], touchedAt: Date.now() };
  sessions.set(sender, session);
  session.touchedAt = Date.now();
  session.history.push({ role: 'user', content: text });
  let answer = quick;
  if (!answer) {
    try {
      answer = await askAI(session.history.slice(-10));
    } catch (error) {
      console.error('IA no disponible:', error.message);
    }
  }
  answer ||= `Gracias por escribir a ${negocio.nombre}. En este momento no puedo darte ese dato; escríbenos o llámanos al ${negocio.telefono_humano}.`;
  session.history.push({ role: 'assistant', content: answer });
  session.history = session.history.slice(-10);
  return answer.slice(0, 4000);
}

async function sendWhatsApp(to, body) {
  const url = `https://graph.facebook.com/${process.env.META_GRAPH_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { preview_url: false, body } }),
  });
  if (!res.ok) throw new Error(`WhatsApp ${res.status}`);
}

function validSignature(req) {
  const secret = process.env.META_APP_SECRET;
  const header = req.get('x-hub-signature-256') ?? '';
  if (!secret || !header.startsWith('sha256=') || !req.rawBody) return false;
  const expected = crypto.createHmac('sha256', secret).update(req.rawBody).digest();
  const given = Buffer.from(header.slice(7), 'hex');
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

export const app = express();
app.use(express.json({ limit: '1mb', verify: (req, _res, buf) => { req.rawBody = Buffer.from(buf); } }));

app.get('/health', (_req, res) => res.json({ ok: true, negocio: negocio.nombre }));

// Verificación del webhook en Meta.
app.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === process.env.VERIFY_TOKEN) {
    return res.status(200).send(String(req.query['hub.challenge'] ?? ''));
  }
  res.sendStatus(403);
});

app.post('/webhook', (req, res) => {
  if (!validSignature(req)) return res.sendStatus(401);
  res.sendStatus(200);
  const messages = (req.body?.entry ?? []).flatMap((e) => e.changes ?? []).flatMap((c) => c.value?.messages ?? []);
  (async () => {
    for (const m of messages) {
      if (!m?.id || seen.has(m.id)) continue;
      seen.set(m.id, Date.now());
      try {
        const text = m.type === 'text' ? m.text?.body?.trim() : '';
        const answer = text ? await reply(m.from, text) : '¡Hola! Por ahora solo leo mensajes de texto. ¿En qué te ayudo?';
        await sendWhatsApp(m.from, answer);
      } catch (error) {
        console.error('Error al responder:', error.message);
      }
    }
  })();
});

// Prueba sin WhatsApp: POST /probar {"mensaje":"..."}
app.post('/probar', async (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.sendStatus(404);
  res.json({ respuesta: await reply('prueba', String(req.body?.mensaje ?? '')) });
});

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  app.listen(port, '0.0.0.0', () => console.log(`Agente de ${negocio.nombre} escuchando en el puerto ${port}`));
}
