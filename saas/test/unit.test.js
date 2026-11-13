import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createAiProvider } from '../src/ai/providers.js';
import { loadConfig } from '../src/config.js';
import { hashPassword, hashToken, verifyPassword } from '../src/lib/security.js';
import { buildPlans, effectivePlanId } from '../src/plans.js';
import { nextPeriodStartLabel, periodFor } from '../src/services/usage.js';

describe('contraseñas', () => {
  it('genera hashes con sal distinta y los verifica', async () => {
    const a = await hashPassword('mi frase secreta');
    const b = await hashPassword('mi frase secreta');
    assert.notEqual(a, b);
    assert.match(a, /^scrypt\$32768\$8\$1\$/);
    assert.equal(await verifyPassword('mi frase secreta', a), true);
    assert.equal(await verifyPassword('mi frase secretA', a), false);
    assert.equal(await verifyPassword('x', 'formato-invalido'), false);
  });

  it('guarda tokens como hash SHA-256', () => {
    assert.equal(hashToken('abc').length, 64);
  });
});

describe('periodos de créditos', () => {
  it('usa el mes calendario de la Ciudad de México', () => {
    // 1 de diciembre a las 05:00 UTC todavía es 30 de noviembre (23:00) en CDMX.
    assert.equal(periodFor(new Date('2026-12-01T05:00:00Z'), 'America/Mexico_City'), '2026-11');
    assert.equal(periodFor(new Date('2026-12-01T06:30:00Z'), 'America/Mexico_City'), '2026-12');
    assert.equal(nextPeriodStartLabel('2026-12'), '2027-01-01');
    assert.equal(nextPeriodStartLabel('2026-03'), '2026-04-01');
  });
});

describe('planes', () => {
  const plans = buildPlans({ freeCredits: 25, proCredits: 500, negocioCredits: 2000, proPriceMxn: 199, negocioPriceMxn: 499 });
  it('resuelve el plan vigente', () => {
    assert.equal(effectivePlanId({ plan_id: 'pro', plan_expires_at: null }), 'pro');
    assert.equal(effectivePlanId({ plan_id: 'pro', plan_expires_at: new Date(Date.now() - 1000) }), 'free');
    assert.equal(effectivePlanId({ plan_id: 'pro', plan_expires_at: new Date(Date.now() + 60000) }), 'pro');
    assert.equal(effectivePlanId(null), 'free');
    assert.equal(plans.get('desconocido').id, 'free');
    assert.deepEqual(plans.paid.map((p) => p.id), ['pro', 'negocio']);
  });
});

describe('configuración', () => {
  it('exige PostgreSQL y HTTPS en producción', () => {
    assert.throws(() => loadConfig({ NODE_ENV: 'production', APP_URL: 'https://x.mx' }), /DATABASE_URL/);
    assert.throws(() => loadConfig({ NODE_ENV: 'production', APP_URL: 'http://x.mx', DATABASE_URL: 'postgres://a' }), /https/);
    const config = loadConfig({ NODE_ENV: 'production', APP_URL: 'https://x.mx', DATABASE_URL: 'postgres://a' });
    assert.equal(config.secureCookies, true);
    assert.ok(config.warnings.length > 0);
  });

  it('exige la clave y el modelo del proveedor de IA elegido', () => {
    assert.throws(() => loadConfig({ AI_PROVIDER: 'openai', AI_MODEL: 'x' }), /OPENAI_API_KEY/);
    assert.throws(() => loadConfig({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k' }), /AI_MODEL/);
    assert.equal(loadConfig({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k', AI_MODEL: 'm' }).ai.provider, 'anthropic');
  });
});

describe('proveedores de IA (respuestas simuladas)', () => {
  const prompt = { system: 'sistema', user: 'usuario', maxOutputTokens: 300 };

  async function withFetch(handler, fn) {
    const original = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push({ url, init, body: JSON.parse(init.body) });
      return handler(calls.length);
    };
    try {
      return { result: await fn(), calls };
    } finally {
      globalThis.fetch = original;
    }
  }
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  it('OpenAI Responses API: arma la petición y lee el texto de output[] (sin output_text)', async () => {
    const ai = createAiProvider({ provider: 'openai', openaiApiKey: 'sk-test', model: 'modelo-x', timeoutMs: 5000 });
    const { result, calls } = await withFetch(() => json(200, {
      model: 'modelo-x',
      output: [{ type: 'reasoning', summary: [] }, { type: 'message', content: [{ type: 'output_text', text: 'Hola ' }, { type: 'output_text', text: 'mundo' }] }],
      usage: { input_tokens: 12, output_tokens: 3 },
    }), () => ai.generate(prompt));
    assert.equal(calls[0].url, 'https://api.openai.com/v1/responses');
    assert.equal(calls[0].init.headers.Authorization, 'Bearer sk-test');
    assert.deepEqual({ ...calls[0].body, input: undefined }, { model: 'modelo-x', instructions: 'sistema', input: undefined, max_output_tokens: 300, store: false });
    assert.deepEqual(result, { text: 'Hola mundo', inputTokens: 12, outputTokens: 3, model: 'modelo-x', provider: 'openai' });
  });

  it('Anthropic Messages API: arma la petición y lee los bloques de texto', async () => {
    const ai = createAiProvider({ provider: 'anthropic', anthropicApiKey: 'sk-ant-test', model: 'modelo-y', timeoutMs: 5000 });
    const { result, calls } = await withFetch(() => json(200, {
      model: 'modelo-y', content: [{ type: 'text', text: 'Respuesta' }], usage: { input_tokens: 20, output_tokens: 5 },
    }), () => ai.generate(prompt));
    assert.equal(calls[0].url, 'https://api.anthropic.com/v1/messages');
    assert.equal(calls[0].init.headers['x-api-key'], 'sk-ant-test');
    assert.equal(calls[0].init.headers['anthropic-version'], '2023-06-01');
    assert.deepEqual(calls[0].body, { model: 'modelo-y', max_tokens: 300, system: 'sistema', messages: [{ role: 'user', content: 'usuario' }] });
    assert.equal(result.text, 'Respuesta');
    assert.equal(result.inputTokens, 20);
  });

  it('reintenta una vez ante 429/5xx y no reintenta errores 4xx', async () => {
    const ai = createAiProvider({ provider: 'anthropic', anthropicApiKey: 'k', model: 'm', timeoutMs: 5000 });
    const retried = await withFetch((n) => (n === 1 ? json(529, { error: { type: 'overloaded_error' } }) : json(200, { content: [{ type: 'text', text: 'ok' }] })), () => ai.generate(prompt));
    assert.equal(retried.calls.length, 2);
    assert.equal(retried.result.text, 'ok');
    await assert.rejects(withFetch(() => json(400, { error: { message: 'mala petición' } }), () => ai.generate(prompt)), /400/);
  });
});
