/**
 * Proveedores de IA intercambiables con la misma interfaz:
 *   generate({ system, user, maxOutputTokens }) -> { text, inputTokens, outputTokens, model, provider }
 * Selecciona con AI_PROVIDER=openai|anthropic|mock y AI_MODEL.
 */

export class AiError extends Error {
  constructor(message, { status, retryable = false } = {}) {
    super(message);
    this.code = 'ai_error';
    this.status = status;
    this.retryable = retryable;
  }
}

async function postJson(url, { headers, body, timeoutMs }) {
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new AiError(`No se pudo contactar al proveedor de IA: ${error.name}`, { retryable: true });
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    const detail = payload?.error?.message ?? payload?.error?.type ?? '';
    throw new AiError(`El proveedor de IA respondió ${response.status} ${detail}`.trim(), { status: response.status, retryable });
  }
  return payload;
}

async function withRetry(fn, attempts = 2) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (!(error instanceof AiError) || !error.retryable || attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
    }
  }
}

function openAiProvider({ apiKey, model, timeoutMs }) {
  return {
    name: 'openai',
    model,
    async generate({ system, user, maxOutputTokens }) {
      const payload = await withRetry(() => postJson('https://api.openai.com/v1/responses', {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeoutMs,
        body: {
          model,
          instructions: system,
          input: [{ role: 'user', content: user }],
          max_output_tokens: maxOutputTokens,
          store: false,
        },
      }));
      // La API REST devuelve el texto dentro de output[].content[]; `output_text` solo existe en los SDK.
      const text = typeof payload.output_text === 'string' && payload.output_text
        ? payload.output_text
        : (payload.output ?? [])
          .filter((item) => item.type === 'message')
          .flatMap((item) => item.content ?? [])
          .filter((part) => part.type === 'output_text')
          .map((part) => part.text)
          .join('');
      return {
        text,
        inputTokens: payload.usage?.input_tokens ?? 0,
        outputTokens: payload.usage?.output_tokens ?? 0,
        model: payload.model ?? model,
        provider: 'openai',
      };
    },
  };
}

// Modelos que aceptan el respaldo automático del servidor cuando el modelo rechaza una solicitud.
const SERVER_FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-fable-5-2', 'claude-fable-5-1']);
// Margen para el razonamiento interno: en los modelos actuales cuenta dentro de max_tokens.
const THINKING_HEADROOM_TOKENS = 3000;

function anthropicProvider({ apiKey, model, timeoutMs, effort }) {
  const fallback = SERVER_FALLBACK_MODELS.has(model);
  return {
    name: 'anthropic',
    model,
    async generate({ system, user, maxOutputTokens }) {
      const payload = await withRetry(() => postJson('https://api.anthropic.com/v1/messages', {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          ...(fallback ? { 'anthropic-beta': 'server-side-fallback-2026-07-01' } : {}),
        },
        timeoutMs,
        body: {
          model,
          max_tokens: maxOutputTokens + THINKING_HEADROOM_TOKENS,
          // Textos cortos de negocio: esfuerzo bajo = más rápido y barato sin perder calidad.
          ...(effort ? { output_config: { effort } } : {}),
          ...(fallback ? { fallbacks: 'default' } : {}),
          system,
          messages: [{ role: 'user', content: user }],
        },
      }));
      if (payload.stop_reason === 'refusal') {
        throw new AiError(`El modelo rechazó la solicitud (${payload.stop_details?.category ?? 'sin categoría'})`, { status: 'refusal' });
      }
      const text = (payload.content ?? [])
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('');
      return {
        text,
        inputTokens: payload.usage?.input_tokens ?? 0,
        outputTokens: payload.usage?.output_tokens ?? 0,
        model: payload.model ?? model,
        provider: 'anthropic',
      };
    },
  };
}

/** Proveedor de demostración: no llama a ninguna API. Útil para desarrollo y pruebas. */
function mockProvider() {
  return {
    name: 'mock',
    model: 'demo',
    async generate({ user }) {
      const task = user.split('Task:').pop().trim().slice(0, 160);
      const text = [
        'Demo result / Resultado de demostración',
        '',
        'This text was produced by demo mode (AI_PROVIDER=mock) without calling an AI model.',
        'Este texto lo generó el modo de demostración, sin llamar a un modelo de IA.',
        'Set AI_PROVIDER, AI_MODEL and the provider key to get real results.',
        '',
        `Task: ${task}…`,
      ].join('\n');
      return { text, inputTokens: Math.ceil(user.length / 4), outputTokens: Math.ceil(text.length / 4), model: 'demo', provider: 'mock' };
    },
  };
}

export function createAiProvider(aiConfig) {
  switch (aiConfig.provider) {
    case 'openai':
      return openAiProvider({ apiKey: aiConfig.openaiApiKey, model: aiConfig.model, timeoutMs: aiConfig.timeoutMs });
    case 'anthropic':
      return anthropicProvider({ apiKey: aiConfig.anthropicApiKey, model: aiConfig.model, timeoutMs: aiConfig.timeoutMs, effort: aiConfig.effort });
    default:
      return mockProvider();
  }
}
