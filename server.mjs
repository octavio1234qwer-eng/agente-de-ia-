import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import nodemailer from 'nodemailer';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);
const sessions = new Map();
const seenMessages = new Map();
const sessionTtlMs = 6 * 60 * 60 * 1000;

const cleanupTimer = setInterval(() => {
  const cutoff = Date.now() - sessionTtlMs;
  for (const [sender, session] of sessions) {
    if (session.touchedAt < cutoff) sessions.delete(sender);
  }
  for (const [messageId, timestamp] of seenMessages) {
    if (timestamp < cutoff) seenMessages.delete(messageId);
  }
}, 15 * 60 * 1000);
cleanupTimer.unref();

const systemPrompt = fs.readFileSync(path.join(here, 'agent', 'system-prompt.md'), 'utf8');
const businessInfo = JSON.parse(fs.readFileSync(path.join(here, 'business-info.json'), 'utf8'));
const menu = JSON.parse(fs.readFileSync(path.join(here, 'menu.json'), 'utf8'));
const businessKnowledge = `${systemPrompt}\n\nDatos estructurados del restaurante:\n${JSON.stringify(businessInfo)}`;
const menuEntries = menu.flatMap((category) => category.items.map((item) => ({
  category: category.category,
  name: item.name,
  price: item.price,
  description: item.description,
})));

app.use(express.json({
  limit: '1mb',
  verify(request, _response, buffer) {
    request.rawBody = Buffer.from(buffer);
  },
}));

app.get('/health', (_request, response) => {
  const whatsappConfigured = Boolean(
    process.env.VERIFY_TOKEN && process.env.META_APP_SECRET && process.env.WHATSAPP_ACCESS_TOKEN &&
    process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.META_GRAPH_API_VERSION
  );
  const aiConfigured = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL);
  const staffEmailConfigured = Boolean(
    process.env.MAIL_HOST && process.env.MAIL_USER && process.env.MAIL_PASS &&
    process.env.STAFF_NOTIFY_EMAIL
  );
  response.json({
    ok: whatsappConfigured && aiConfigured,
    whatsappConfigured,
    aiConfigured,
    staffEmailConfigured,
  });
});

app.get('/webhook', (request, response) => {
  const mode = request.query['hub.mode'];
  const token = request.query['hub.verify_token'];
  const challenge = request.query['hub.challenge'];
  if (mode === 'subscribe' && token && token === process.env.VERIFY_TOKEN) {
    return response.status(200).send(String(challenge ?? ''));
  }
  return response.sendStatus(403);
});

app.post('/webhook', (request, response) => {
  if (!isValidMetaSignature(request)) return response.sendStatus(401);

  const messages = (request.body?.entry ?? [])
    .flatMap((entry) => entry.changes ?? [])
    .flatMap((change) => change.value?.messages ?? []);

  // Acknowledge Meta quickly; the agent replies after the webhook is accepted.
  response.sendStatus(200);
  void processMessagesInOrder(messages);
});

function isValidMetaSignature(request) {
  const secret = process.env.META_APP_SECRET;
  const header = request.get('x-hub-signature-256') ?? '';
  const suppliedHex = header.startsWith('sha256=') ? header.slice(7) : '';
  if (!secret || !suppliedHex || !request.rawBody) return false;

  const expected = crypto.createHmac('sha256', secret).update(request.rawBody).digest();
  const supplied = Buffer.from(suppliedHex, 'hex');
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

async function processMessagesInOrder(messages) {
  for (const message of messages) {
    if (!message?.id || !message.from || wasAlreadySeen(message.id)) continue;
    try {
      if (message.type !== 'text' || !message.text?.body?.trim()) {
        await sendWhatsAppText(
          message.from,
          '¡Hola! Puedo ayudarte mejor por texto. Escríbeme tu pregunta o cuéntame qué plan quieres organizar. Para atención directa, escribe al WhatsApp del restaurante: https://wa.me/529984895643, o llama al +52 998 255 6502.'
        );
        continue;
      }

      const answer = await createAgentReply(message.from, message.text.body.trim());
      await sendWhatsAppText(message.from, answer);
    } catch (error) {
      console.error('Message handling failed:', error?.message || 'unknown error');
      try {
        await sendWhatsAppText(
          message.from,
          'Disculpa, en este momento no puedo verificar ese dato. Para no darte información incorrecta, escribe al WhatsApp del restaurante: https://wa.me/529984895643, o llama al +52 998 255 6502.'
        );
      } catch (sendError) {
        console.error('Fallback message failed:', sendError?.message || 'unknown error');
      }
    }
  }
}

function wasAlreadySeen(messageId) {
  const now = Date.now();
  for (const [id, timestamp] of seenMessages) {
    if (now - timestamp > sessionTtlMs) seenMessages.delete(id);
  }
  if (seenMessages.has(messageId)) return true;
  seenMessages.set(messageId, now);
  if (seenMessages.size > 10_000) seenMessages.delete(seenMessages.keys().next().value);
  return false;
}

async function createAgentReply(sender, text) {
  const session = getSession(sender);
  const posadaReply = await handlePosadaFlow(session, sender, text);
  if (posadaReply) return rememberExchange(session, text, posadaReply);

  const reservationReply = await handleReservationFlow(session, sender, text);
  if (reservationReply) return rememberExchange(session, text, reservationReply);

  const immediate = answerCommonQuestion(text);
  if (immediate) return rememberExchange(session, text, immediate);

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey || !model) {
    return rememberExchange(
      session,
      text,
      'Quiero ayudarte con eso, pero no tengo ese dato confirmado ahora. Para una respuesta segura, escribe al WhatsApp del restaurante: https://wa.me/529984895643, o llama al +52 998 255 6502.'
    );
  }

  const userItem = { role: 'user', content: text };
  const previousItems = session.turns.flat();
  session.touchedAt = Date.now();
  const recentUserContext = [...previousItems.filter((item) => item.role === 'user').slice(-3).map((item) => item.content), text].join(' ');

  const result = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      model,
      instructions: knowledgeForQuery(recentUserContext),
      input: [...previousItems, userItem],
      max_output_tokens: 600,
      store: false,
    }),
  });
  const payload = await result.json();
  if (!result.ok) throw new Error(`OpenAI request failed (${result.status})`);

  const answer = payload.output_text?.trim();
  if (!answer) throw new Error('OpenAI returned an empty response');
  const responseItems = Array.isArray(payload.output) && payload.output.length
    ? payload.output
    : [{ role: 'assistant', content: answer }];
  session.turns.push([userItem, ...responseItems]);
  session.turns = session.turns.slice(-6);
  session.touchedAt = Date.now();
  return answer.slice(0, 4000);
}

function rememberExchange(session, userText, assistantText) {
  session.turns.push([
    { role: 'user', content: userText },
    { role: 'assistant', content: assistantText },
  ]);
  session.turns = session.turns.slice(-6);
  session.touchedAt = Date.now();
  return assistantText;
}

function getSession(sender) {
  const now = Date.now();
  let session = sessions.get(sender);
  if (!session || now - session.touchedAt > sessionTtlMs) {
    session = { turns: [], posadaFlow: null, reservationFlow: null, touchedAt: now };
  }
  session.touchedAt = now;
  sessions.set(sender, session);
  return session;
}

async function handlePosadaFlow(session, sender, text) {
  const normalized = normalizeSpanish(text);
  const isNewPosada = /\bposadas?\b/.test(normalized) || (
    /\bpasada\b/.test(normalized) && /\b(quiero|organizar|hacer|reservar|evento)\b/.test(normalized)
  );
  const hasActiveFlow = Boolean(session.posadaFlow);
  if (!isNewPosada && !hasActiveFlow) return null;

  if (/\b(cancelar|olvidalo|olvidala|ya no|mejor no)\b/.test(normalized)) {
    session.posadaFlow = null;
    return 'Claro, dejamos en pausa la posada. Si quieres retomarla, dime la fecha o el paquete que te interesa.';
  }

  if (!session.posadaFlow || (isNewPosada && session.posadaFlow.completed)) {
    session.posadaFlow = {
      date: null,
      time: null,
      hour24: null,
      guests: null,
      packagePrice: null,
      drinkPrice: null,
      notifiedSignature: null,
      attemptedSignature: null,
      completed: false,
    };
  }

  const flow = session.posadaFlow;
  const update = parsePosadaDetails(text);
  if (update.drinkPrice !== undefined) flow.drinkPrice = update.drinkPrice;
  if (/\b(bebida|bebidas|refresque|festejes|barra libre)\b/.test(normalized)) {
    if (update.drinkPrice === undefined) {
      return 'Los paquetes de bebidas publicados son Refresque ($369 MXN por persona) y Festejes ($579 MXN por persona). Se cotizan por separado del menú; el equipo confirma duración y condiciones. Si quieres agregar uno, dime “Refresque” o “Festejes”.';
    }
  }
  if (flow.completed && /\b(gracias|perfecto|ok|vale)\b/.test(normalized) && !Object.keys(update).length) {
    return '¡Con gusto! La solicitud sigue pendiente de confirmación con el equipo.';
  }
  if (hasActiveFlow && !isNewPosada && !Object.keys(update).length) return null;
  if (update.date) flow.date = update.date;
  if (update.time) {
    flow.time = update.time;
    flow.hour24 = update.hour24;
  }
  if (update.guests) flow.guests = update.guests;
  if (update.packagePrice) flow.packagePrice = update.packagePrice;

  if (/\b(incluye|incluyen|trae|lleva|que tiene|que contiene)\b/.test(normalized)) {
    const packagePrice = update.packagePrice ?? flow.packagePrice;
    if (packagePrice) {
      const detail = posadaMenu(packagePrice);
      if (detail) return `El menú de $${packagePrice} por persona incluye: ${detail}. ¿Quieres que lo considere para tu posada?`;
    }
  }
  if (/\b(paquetes|opciones|menus)\b/.test(normalized) && !flow.packagePrice) {
    return 'Los cinco menús publicados cuestan $380, $480, $540, $620 y $950 MXN por persona. ¿Cuál quieres considerar?';
  }

  if (!flow.date || !flow.time) {
    const missing = [!flow.date ? 'la fecha' : null, !flow.time ? 'la hora de inicio' : null].filter(Boolean).join(' y ');
    const prefix = flow.guests ? `Tengo en cuenta ${flow.guests} personas. ` : '';
    const ask = !flow.date && !flow.time
      ? '¿Qué fecha y hora tienes en mente? Hay menús desde $380 hasta $950 MXN por persona.'
      : !flow.date
        ? '¿Qué fecha tienes en mente?'
        : '¿A qué hora prefieres empezar?';
    return `${prefix}Para cotizar la posada necesito ${missing}. ${ask}`;
  }

  if (!flow.guests || !flow.packagePrice) {
    const known = `Tengo la fecha ${flow.date} a las ${flow.time}.`;
    if (!flow.guests && !flow.packagePrice) {
      return `${known} ¿Cuántas personas asistirán y qué menú prefieres? Hay opciones de $380, $480, $540, $620 y $950 MXN por persona.`;
    }
    if (!flow.guests) return `${known} ¿Cuántas personas asistirán?`;
    return `${known} Serían ${flow.guests} personas. ¿Qué menú prefieres: $380, $480, $540, $620 o $950 MXN por persona?`;
  }

  const total = flow.guests * flow.packagePrice;
  const deposit = Math.round(total * 0.3);
  const drinkSubtotal = flow.drinkPrice > 0 ? flow.guests * flow.drinkPrice : 0;
  const signature = `${flow.date}|${flow.time}|${flow.guests}|${flow.packagePrice}|${flow.drinkPrice ?? 'sin-seleccionar'}`;
  flow.completed = true;
  let emailSent = flow.notifiedSignature === signature;
  if (!emailSent && flow.attemptedSignature !== signature) {
    try {
      emailSent = await notifyStaff(sender, { type: 'posada', ...flow, total, deposit });
    } catch (error) {
      console.error('Staff email notification failed:', error?.message || 'unknown error');
    }
    flow.attemptedSignature = signature;
    if (emailSent) flow.notifiedSignature = signature;
  }

  const closingNote = closingNoteForRequest(flow.date, flow.hour24);
  const handoff = emailSent
    ? 'Ya envié la solicitud al equipo para que confirme disponibilidad. La posada no queda reservada hasta que el equipo te confirme.'
    : 'La disponibilidad y la reserva aún no están confirmadas. Para apartarla, escribe al WhatsApp del restaurante: https://wa.me/529984895643, o llama al +52 998 255 6502.';
  const drinks = flow.drinkPrice > 0
    ? ` Paquete de bebidas elegido: $${flow.drinkPrice} por persona; subtotal estimado de bebidas: $${drinkSubtotal.toLocaleString('es-MX')} MXN, sujeto a condiciones del equipo.`
    : flow.drinkPrice === 0
      ? ' Por ahora, sin paquete de bebidas.'
      : ' Puedes añadir bebidas: Refresque $369 o Festejes $579 MXN por persona; se cotizan por separado.';
  return `Para tu posada: ${flow.date}, ${flow.time}, ${flow.guests} personas, menú de $${flow.packagePrice} MXN por persona. Total estimado de alimentos: $${total.toLocaleString('es-MX')} MXN; apartado publicado del 30% para alimentos: $${deposit.toLocaleString('es-MX')} MXN. El resto se liquida antes de iniciar; los precios publicados incluyen IVA y la propina es voluntaria.${drinks}${closingNote} ${handoff}`;
}

async function handleReservationFlow(session, sender, text) {
  const normalized = normalizeSpanish(text);
  const isNewRequest = /\b(reservar|reservacion|reservaciones|apartar)\b/.test(normalized) ||
    /\bquiero\b.{0,30}\bmesa\b/.test(normalized) || /\bmesa\s+para\s+\d+\b/.test(normalized);
  const hasActiveFlow = Boolean(session.reservationFlow);
  if (!isNewRequest && !hasActiveFlow) return null;

  if (/\b(cancelar|olvidalo|ya no|mejor no)\b/.test(normalized)) {
    session.reservationFlow = null;
    return 'Claro, dejamos en pausa la solicitud de mesa. Si quieres retomarla, dime la fecha, la hora y cuántas personas asistirán.';
  }

  if (!session.reservationFlow || (isNewRequest && session.reservationFlow.completed)) {
    session.reservationFlow = {
      date: null,
      time: null,
      hour24: null,
      guests: null,
      notifiedSignature: null,
      attemptedSignature: null,
      completed: false,
    };
  }

  const flow = session.reservationFlow;
  const update = parsePosadaDetails(text);
  if (flow.completed && /\b(gracias|perfecto|ok|vale)\b/.test(normalized) && !Object.keys(update).length) {
    return '¡Con gusto! La solicitud de mesa sigue pendiente de confirmación con el equipo.';
  }
  if (hasActiveFlow && !isNewRequest && !Object.keys(update).length) return null;
  if (update.date) flow.date = update.date;
  if (update.time) {
    flow.time = update.time;
    flow.hour24 = update.hour24;
  }
  if (update.guests) flow.guests = update.guests;

  const missing = [!flow.date ? 'la fecha' : null, !flow.time ? 'la hora' : null, !flow.guests ? 'el número de personas' : null].filter(Boolean);
  if (missing.length === 3) return 'Con gusto te ayudo a solicitar una mesa. ¿Para qué fecha, a qué hora y para cuántas personas? El equipo confirma disponibilidad.';
  if (missing.includes('la fecha')) return `Ya tengo la hora ${flow.time}. ¿Qué fecha tienes en mente?`;
  if (missing.includes('la hora')) return `Ya tengo la fecha ${flow.date}. ¿A qué hora prefieres venir?`;
  if (missing.includes('el número de personas')) return `Ya tengo ${flow.date} a las ${flow.time}. ¿Para cuántas personas sería la mesa?`;

  const signature = `${flow.date}|${flow.time}|${flow.guests}`;
  flow.completed = true;
  let emailSent = flow.notifiedSignature === signature;
  if (!emailSent && flow.attemptedSignature !== signature) {
    try {
      emailSent = await notifyStaff(sender, { type: 'reservation', ...flow });
    } catch (error) {
      console.error('Staff email notification failed:', error?.message || 'unknown error');
    }
    flow.attemptedSignature = signature;
    if (emailSent) flow.notifiedSignature = signature;
  }
  const closingNote = closingNoteForRequest(flow.date, flow.hour24);
  const handoff = emailSent
    ? 'Ya envié tu solicitud al equipo para que confirme disponibilidad; la mesa no queda reservada hasta que te respondan.'
    : 'La mesa aún no está confirmada. Para cerrarla, escribe al WhatsApp del restaurante: https://wa.me/529984895643, o llama al +52 998 255 6502.';
  return `Solicitud de mesa: ${flow.date}, ${flow.time}, ${flow.guests} personas.${closingNote} ${handoff}`;
}

async function notifyStaff(sender, flow) {
  const { MAIL_HOST, MAIL_PORT, MAIL_SECURE, MAIL_USER, MAIL_PASS, STAFF_NOTIFY_EMAIL } = process.env;
  if (!MAIL_HOST || !MAIL_USER || !MAIL_PASS || !STAFF_NOTIFY_EMAIL) return false;

  const transporter = nodemailer.createTransport({
    host: MAIL_HOST,
    port: Number(MAIL_PORT || 587),
    secure: MAIL_SECURE === 'true',
    auth: { user: MAIL_USER, pass: MAIL_PASS },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 7000,
  });
  await transporter.sendMail({
    from: process.env.MAIL_FROM || MAIL_USER,
    to: STAFF_NOTIFY_EMAIL,
    subject: flow.type === 'posada'
      ? `Solicitud de posada · ${flow.date} · ${flow.guests} personas`
      : `Solicitud de mesa · ${flow.date} · ${flow.guests} personas`,
    text: flow.type === 'posada'
      ? [
          'Nueva solicitud de posada de WhatsApp. Pendiente de confirmar con el cliente.',
          `Teléfono de WhatsApp: ${sender}`,
          `Fecha: ${flow.date}`,
          `Hora solicitada: ${flow.time}`,
          `Personas: ${flow.guests}`,
          `Menú: $${flow.packagePrice} MXN por persona`,
          `Total estimado de alimentos: $${flow.total} MXN`,
          `Apartado publicado (30%): $${flow.deposit} MXN`,
          flow.drinkPrice > 0 ? `Paquete de bebidas: $${flow.drinkPrice} MXN por persona; subtotal ${flow.guests * flow.drinkPrice} MXN` : 'Paquete de bebidas: no seleccionado',
          'No confirmar disponibilidad hasta revisar agenda y horario.',
        ].join('\n')
      : [
          'Nueva solicitud de mesa de WhatsApp. Pendiente de confirmar con el cliente.',
          `Teléfono de WhatsApp: ${sender}`,
          `Fecha: ${flow.date}`,
          `Hora solicitada: ${flow.time}`,
          `Personas: ${flow.guests}`,
          'No confirmar disponibilidad hasta revisar la agenda.',
        ].join('\n'),
  });
  return true;
}

function parsePosadaDetails(text) {
  const normalized = normalizeSpanish(text).replace(/\./g, '');
  const update = {};
  const monthNames = '(enero|ene|febrero|feb|marzo|mar|abril|abr|mayo|may|junio|jun|julio|jul|agosto|ago|septiembre|setiembre|sept|sep|octubre|oct|noviembre|nov|diciembre|dicmbre|dicimebre|diciembre|dic)';
  const monthMap = {
    ene: 'enero', enero: 'enero', feb: 'febrero', febrero: 'febrero', mar: 'marzo', marzo: 'marzo',
    abr: 'abril', abril: 'abril', may: 'mayo', mayo: 'mayo', jun: 'junio', junio: 'junio',
    jul: 'julio', julio: 'julio', ago: 'agosto', agosto: 'agosto', sep: 'septiembre', sept: 'septiembre',
    septiembre: 'septiembre', setiembre: 'septiembre', oct: 'octubre', octubre: 'octubre',
    nov: 'noviembre', noviembre: 'noviembre', dic: 'diciembre', dicmbre: 'diciembre',
    dicimebre: 'diciembre', diciembre: 'diciembre',
  };
  const relativeDateIsTimeOfDay = /\b\d{1,2}(?::\d{2})?\s*(?:de\s+la\s*)?manana\b/.test(normalized);
  const tomorrowIsDate = /\bmanana\b/.test(normalized) && (
    !relativeDateIsTimeOfDay || /^\s*(?:para\s+)?(?:el\s+)?manana\b/.test(normalized)
  );
  if (/\bpasado manana\b/.test(normalized)) {
    update.date = dateAtCancunOffset(2);
  } else if (/\bhoy\b/.test(normalized)) {
    update.date = dateAtCancunOffset(0);
  } else if (tomorrowIsDate) {
    update.date = dateAtCancunOffset(1);
  }

  const monthMatch = normalized.match(new RegExp(`\\b(\\d{1,2})\\s*(?:de\\s*)?${monthNames}\\b`));
  if (!update.date && monthMatch) {
    const yearMatch = normalized.match(new RegExp(`\\b${monthMatch[1]}\\s*(?:de\\s*)?${monthMatch[2]}\\s*(?:de\\s*)?(20\\d{2})\\b`));
    const year = yearMatch?.[3] ?? currentCancunYear();
    const candidate = `${Number(monthMatch[1])} de ${monthMap[monthMatch[2]]} de ${year}`;
    if (parseSpanishDate(candidate)) update.date = candidate;
  } else if (!update.date) {
    const numericDate = normalized.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}))?\b/);
    if (numericDate) {
      const months = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      const day = Number(numericDate[1]);
      const month = Number(numericDate[2]);
      if (day <= 31 && month >= 1 && month <= 12) {
        const candidate = `${day} de ${months[month]} de ${numericDate[3] ?? currentCancunYear()}`;
        if (parseSpanishDate(candidate)) update.date = candidate;
      }
    }
  }
  if (!update.date) {
    const weekdays = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
    const weekdayMatch = normalized.match(/\b(?:el\s+)?(proximo\s+|este\s+)?(domingo|lunes|martes|miercoles|jueves|viernes|sabado)\b/);
    if (weekdayMatch) {
      update.date = dateForCancunWeekday(weekdays[weekdayMatch[2]], weekdayMatch[1]?.trim() === 'este', weekdayMatch[1]?.trim() === 'proximo');
    }
  }

  const naturalTime = normalized.match(/\b(?:a\s+las?\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:de\s+la\s*)?(manana|tarde|noche)\b/);
  const explicitTime = normalized.match(/\b(?:a\s+las?\s+)?(\d{1,2})(?::(\d{2}))?\s*(a\s*m|p\s*m|am|pm)\b/);
  if (naturalTime) {
    let hour = Number(naturalTime[1]);
    const minute = Number(naturalTime[2] ?? 0);
    const isPm = naturalTime[3] === 'tarde' || naturalTime[3] === 'noche';
    if (isPm && hour < 12) hour += 12;
    if (!isPm && hour === 12) hour = 0;
    if (hour >= 0 && hour <= 23 && minute <= 59) {
      update.hour24 = hour + minute / 60;
      const displayHour = hour % 12 || 12;
      update.time = `${displayHour}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'p. m.' : 'a. m.'}`;
    }
  } else if (explicitTime) {
    let hour = Number(explicitTime[1]);
    const minute = Number(explicitTime[2] ?? 0);
    const suffix = explicitTime[3].replace(/\s/g, '');
    if (suffix === 'pm' && hour < 12) hour += 12;
    if (suffix === 'am' && hour === 12) hour = 0;
    if (hour >= 0 && hour <= 23 && minute <= 59) {
      update.hour24 = hour + minute / 60;
      const displayHour = hour % 12 || 12;
      update.time = `${displayHour}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'p. m.' : 'a. m.'}`;
    }
  } else {
    const twentyFourHour = normalized.match(/\b(?:a\s+las?\s+)?(\d{1,2}):(\d{2})\b/);
    if (twentyFourHour) {
      const hour = Number(twentyFourHour[1]);
      const minute = Number(twentyFourHour[2]);
      if (hour <= 23 && minute <= 59) {
        update.hour24 = hour + minute / 60;
        const displayHour = hour % 12 || 12;
        update.time = `${displayHour}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'p. m.' : 'a. m.'}`;
      }
    }
  }

  const guests = normalized.match(/\b(\d{1,3})\s*(?:personas|invitados|comensales|asistentes)\b/)
    ?? normalized.match(/\b(?:somos|seremos|seran|asistiran|para)\s+(\d{1,3})\b/);
  if (guests) update.guests = Number(guests[1]);

  const packageMatch = normalized.match(/\b(?:paquete|menu|el|de)?\s*\$?\s*(380|480|540|620|950)\b/);
  if (packageMatch) update.packagePrice = Number(packageMatch[1]);
  if (!update.packagePrice) {
    const packageNumber = normalized.match(/\b(?:paquete|menu|opcion)\s*(?:numero\s*)?([1-5])\b/);
    if (packageNumber) update.packagePrice = [380, 480, 540, 620, 950][Number(packageNumber[1]) - 1];
  }
  if (/\b(sin bebidas|sin paquete de bebidas|solo menu|solo menus)\b/.test(normalized)) {
    update.drinkPrice = 0;
  } else if (/\b(refresque|369)\b/.test(normalized)) {
    update.drinkPrice = 369;
  } else if (/\b(festejes|579)\b/.test(normalized)) {
    update.drinkPrice = 579;
  }
  return update;
}

function currentCancunYear() {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Cancun', year: 'numeric' }).format(new Date()));
}

function closingNoteForRequest(dateText, hour24) {
  const date = parseSpanishDate(dateText);
  if (!date || !Number.isFinite(hour24)) return '';
  const closesAtMidnight = [5, 6].includes(date.getUTCDay());
  const closingHour = closesAtMidnight ? 24 : 23;
  if (hour24 < closingHour - 1) return '';
  const closingLabel = closesAtMidnight ? 'medianoche' : '11:00 p. m.';
  return ` La hora de inicio queda cerca del cierre publicado (${closingLabel}); el equipo debe confirmarla.`;
}

function parseSpanishDate(dateText) {
  const match = String(dateText).match(/^(\d{1,2}) de ([a-z]+) de (20\d{2})$/i);
  if (!match) return null;
  const months = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
  const day = Number(match[1]);
  const month = months[match[2].toLowerCase()];
  const year = Number(match[3]);
  if (!month) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
  return date;
}

function cancunDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Cancun',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
}

function formatSpanishDate(year, month, day) {
  const months = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${day} de ${months[month]} de ${year}`;
}

function dateAtCancunOffset(offsetDays) {
  const { year, month, day } = cancunDateParts();
  const target = new Date(Date.UTC(year, month - 1, day + offsetDays));
  return formatSpanishDate(target.getUTCFullYear(), target.getUTCMonth() + 1, target.getUTCDate());
}

function dateForCancunWeekday(targetWeekday, thisWeek = false, nextWeek = false) {
  const { year, month, day } = cancunDateParts();
  const todayUtc = new Date(Date.UTC(year, month - 1, day));
  let offset = (targetWeekday - todayUtc.getUTCDay() + 7) % 7;
  if (nextWeek) offset += 7;
  else if (offset === 0 && !thisWeek) offset = 7;
  const target = new Date(Date.UTC(year, month - 1, day + offset));
  return formatSpanishDate(target.getUTCFullYear(), target.getUTCMonth() + 1, target.getUTCDate());
}

function posadaMenu(price) {
  const menus = {
    380: 'sopa de lima; pechuga rellena de espinaca y champiñones en salsa poblana con puré de papa y verduras asadas; budín de la casa',
    480: 'pescadilla de mantarraya; pescado en salsa de pimienta blanca con arroz y ensalada fresca; carlota de limón',
    540: 'ensalada con queso de cabra y vinagreta de fresa; camarones momia rellenos de queso crema con aderezo de chipotle, zanahorias baby y puré de papa; cheesecake de temporada',
    620: 'crema de papa y poro; salmón glaseado con miel y mostaza, verduras salteadas, salsa teriyaki y papas cambray; brownie con helado de vainilla',
    950: 'tacos de carnita de atún; rib eye con chimichurri, elotes asados y papas gajo; ensalada navideña',
  };
  return menus[price] ?? null;
}

function normalizeSpanish(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function knowledgeForQuery(query) {
  const stopWords = new Set(['con', 'para', 'del', 'una', 'uno', 'que', 'tiene', 'tienen', 'hay', 'como', 'cuanto', 'cuantos', 'precio', 'precios', 'quiero', 'puedo', 'pueden', 'este', 'esta', 'eso', 'ese', 'por', 'favor']);
  const tokens = [...new Set(normalizeSpanish(query).match(/[a-z0-9]+/g) ?? [])]
    .filter((token) => token.length > 2 && !stopWords.has(token));
  const relevantItems = menuEntries
    .map((item) => {
      const content = normalizeSpanish(`${item.category} ${item.name} ${item.description}`);
      const score = tokens.reduce((total, token) => total + (content.includes(token) ? 1 : 0), 0);
      return { ...item, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 10)
    .map(({ score, ...item }) => item);
  const menuContext = relevantItems.length
    ? JSON.stringify(relevantItems)
    : 'No se encontraron platillos coincidentes en la carta capturada. Comparte el enlace del menú o deriva al equipo; no inventes platillos.';
  return `${businessKnowledge}\n\nFragmento relevante del menú oficial (precios MXN; confirma disponibilidad):\n${menuContext}`;
}

function answerCommonQuestion(text) {
  const normalized = normalizeSpanish(text);

  if (/\b(noches? de salsa|sabados? de salsa|dia de salsa|cuando (?:es|hay) salsa|hay salsa|salsa en vivo|musica en vivo|musica viva|bailar)\b/.test(normalized)) {
    return 'El sitio oficial anuncia Sábados de Salsa. Una publicación reciente de Facebook también mencionó música en vivo viernes y sábados desde las 8:30 p. m.; la programación puede variar. ¿Qué fecha te interesa? Puedes confirmar llamando al +52 998 255 6502.';
  }
  if (/\b(reservar|reservacion|reservaciones|mesa)\b/.test(normalized)) {
    return '¡Con gusto! ¿Para qué fecha, a qué hora y para cuántas personas? El equipo debe confirmar disponibilidad para que la mesa quede reservada.';
  }
  if (/\b(donde|ubicacion|direccion|llegar|mapa)\b/.test(normalized)) {
    return 'Estamos en Av. Xpuhil Sur, Supermanzana 19, Manzana 2, Lote 26, 77505 Cancún. Mapa: https://www.google.com/maps/search/?api=1&query=La%20Casa%20de%20la%20Mantarraya%20Cancun';
  }
  if (/\b(horario|horarios|abren|abierto|cierran|cierra)\b/.test(normalized)) {
    return 'El horario publicado es domingo a jueves de 1:00 a 11:00 p. m., y viernes y sábado de 1:00 p. m. a medianoche, hora de Cancún. En días festivos conviene confirmar.';
  }
  if (/\b(menu|carta|platillos|comida|comer|precio|precios)\b/.test(normalized)) {
    return 'La carta incluye cocina de mar, especialidades de mantarraya, pastas, pizzas, parrilla y bebidas. Por ejemplo, los tacos de mantarraya al tamarindo (3 piezas) cuestan $179 MXN. Menú completo: https://casadelamantarraya.com/menu/';
  }
  if (/\b(hola|buenas|buenos dias|buenas tardes|buenas noches)\b/.test(normalized)) {
    return '¡Hola! 🐟 Cuéntame qué necesitas y te ayudo; puedo orientarte con el menú, una visita, las promociones o una posada.';
  }
  return null;
}

async function sendWhatsAppText(to, body) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = process.env.META_GRAPH_API_VERSION;
  if (!token || !phoneNumberId || !apiVersion) throw new Error('WhatsApp configuration is incomplete');

  const result = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body },
    }),
  });
  if (!result.ok) throw new Error(`WhatsApp send failed (${result.status})`);
}

app.listen(port, '0.0.0.0', () => {
  console.log(`La Casa de la Mantarraya WhatsApp agent listening on port ${port}`);
});
