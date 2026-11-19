import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { openDatabase } from '../packages/database/src/index.ts';
import { createApp } from '../apps/api/src/app.ts';
import { signPayload } from '../packages/security/src/index.ts';

const SETUP = 'setup-token-1234567890';
const WEBHOOK = 'w'.repeat(40);
let server: Server;
let base = '';
let app: ReturnType<typeof createApp>;

class Client {
  cookie = '';
  csrf = '';
  async req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(base + path, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(this.cookie ? { cookie: this.cookie } : {}), ...(this.csrf ? { 'x-csrf-token': this.csrf } : {}), ...headers },
      body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) this.cookie = setCookie.split(';')[0];
    const data = await res.json() as Record<string, any>;
    if (data?.csrfToken) this.csrf = data.csrfToken;
    return { status: res.status, data };
  }
}

before(async () => {
  const db = openDatabase(':memory:');
  app = createApp(db, { env: { OWNER_SETUP_TOKEN: SETUP, SESSION_SECRET: 's'.repeat(40), PAYMENT_WEBHOOK_SECRET: WEBHOOK } });
  server = createServer((req, res) => { void app.handle(req, res); });
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

const owner = new Client();
let bizId = '';

test('health y headers de seguridad', async () => {
  const res = await fetch(base + '/health');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  const data = await res.json() as { ok: boolean; ownerConfigured: boolean };
  assert.equal(data.ok, true);
  assert.equal(data.ownerConfigured, false);
});

test('autenticación: setup requiere token, contraseña fuerte; luego login', async () => {
  const anon = new Client();
  assert.equal((await anon.req('GET', '/api/dashboard')).status, 401);
  assert.equal((await anon.req('POST', '/api/auth/setup', { setupToken: 'malo', email: 'a@b.mx', name: 'A', password: 'clave12345segura' })).status, 403);
  assert.equal((await anon.req('POST', '/api/auth/setup', { setupToken: SETUP, email: 'a@b.mx', name: 'A', password: 'corta' })).status, 400);
  const ok = await owner.req('POST', '/api/auth/setup', { setupToken: SETUP, email: 'dueno@ejemplo.mx', name: 'Dueño', password: 'clave12345segura' });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.ok(owner.cookie.startsWith('aia_session='));
  assert.equal((await anon.req('POST', '/api/auth/setup', { setupToken: SETUP, email: 'x@b.mx', name: 'X', password: 'clave12345segura' })).status, 409);
  assert.equal((await anon.req('POST', '/api/auth/login', { email: 'dueno@ejemplo.mx', password: 'incorrecta123' })).status, 401);
  const relog = new Client();
  assert.equal((await relog.req('POST', '/api/auth/login', { email: 'dueno@ejemplo.mx', password: 'clave12345segura' })).status, 200);
});

test('CSRF: sin token se rechazan cambios', async () => {
  const noCsrf = new Client();
  noCsrf.cookie = owner.cookie;
  const r = await noCsrf.req('POST', '/api/businesses', { name: 'Hack' });
  assert.equal(r.status, 403);
  assert.equal(r.data.code, 'csrf');
});

test('dashboard vacío muestra ceros reales', async () => {
  const r = await owner.req('GET', '/api/dashboard');
  assert.equal(r.status, 200);
  assert.equal(r.data.finance.grossIncomeCents, 0);
  assert.equal(r.data.finance.netProfitCents, 0);
  assert.equal(r.data.businesses.total, 0);
});

test('negocios: crear, validar y evitar duplicados', async () => {
  const r = await owner.req('POST', '/api/businesses', { name: 'CotizaFácil MX', description: 'Cotizaciones para pymes', monetizationModel: 'freemium' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  bizId = r.data.id;
  assert.equal(r.data.autonomy_level, 2);
  assert.equal(r.data.currency, 'MXN');
  assert.equal((await owner.req('POST', '/api/businesses', { name: 'cotizafacil mx!' })).status, 409);
  assert.equal((await owner.req('POST', '/api/businesses', { name: 'Otro', currency: 'XYZ1' })).status, 400);
});

test('calculadoras públicas de CotizaFácil', async () => {
  const anon = new Client();
  const p = await anon.req('POST', '/api/cotizafacil/calc/price', { costCents: 10000, mode: 'margin', percent: 50 });
  assert.equal(p.data.priceCents, 20000);
  assert.equal(p.data.markupPct, 100);
  const q = await anon.req('POST', '/api/cotizafacil/calc/quote', { lines: [{ description: 'Servicio', quantity: 1, unitPriceCents: 100000 }] });
  assert.equal(q.data.totalCents, 116000);
  assert.equal((await anon.req('POST', '/api/cotizafacil/calc/price', { costCents: 10000, mode: 'margin', percent: 100 })).status, 400);
});

let customerId = '';
test('CRM + cotización persistente con folio y enlace de WhatsApp', async () => {
  const c = await owner.req('POST', `/api/businesses/${bizId}/customers`, { name: 'Taller Gómez', phone: '+52 998 111 2233', email: 'GOMEZ@ejemplo.mx', tags: ['taller'] });
  assert.equal(c.status, 200, JSON.stringify(c.data));
  customerId = c.data.id;
  assert.equal(c.data.email, 'gomez@ejemplo.mx');
  const q1 = await owner.req('POST', `/api/businesses/${bizId}/quotes`, { customerId, lines: [{ description: 'Mantenimiento', quantity: 2, unitPriceCents: 50000, unitCostCents: 20000 }], validUntil: '2026-12-31' });
  assert.equal(q1.status, 200, JSON.stringify(q1.data));
  assert.equal(q1.data.number, 'COT-0001');
  assert.equal(q1.data.totals.totalCents, 116000);
  assert.ok(q1.data.whatsappUrl.startsWith('https://wa.me/529981112233?text='));
  const q2 = await owner.req('POST', `/api/businesses/${bizId}/quotes`, { kind: 'budget', customerName: 'Ana', lines: [{ description: 'X', quantity: 1, unitPriceCents: 100 }] });
  assert.equal(q2.data.number, 'PRE-0002');
  const exp = await owner.req('GET', `/api/businesses/${bizId}/customers/${customerId}/export`);
  assert.equal(exp.data.quotes.length, 1);
});

test('aislamiento entre negocios', async () => {
  const other = await owner.req('POST', '/api/businesses', { name: 'Negocio B' });
  const r = await owner.req('GET', `/api/businesses/${other.data.id}/customers/${customerId}`);
  assert.equal(r.status, 404, 'un cliente de A no se ve desde B');
});

test('tareas: crear vía API, ejecutar ciclo y aprobación', async () => {
  const t = await owner.req('POST', '/api/tasks', { agentId: 'financial', type: 'finance.report', businessId: bizId });
  assert.equal(t.data.status, 'QUEUED');
  await owner.req('POST', '/api/orchestrator/tick', {});
  const done = await owner.req('GET', `/api/tasks/${t.data.id}`);
  assert.equal(done.data.task.status, 'COMPLETED');
  assert.ok(done.data.history.length >= 3);
  const agents = await owner.req('GET', '/api/agents');
  assert.equal(agents.data.agents.length, 10);
});

test('pagos: demo excluido de métricas; webhook firmado confirma e ignora duplicados', async () => {
  const p = await owner.req('POST', `/api/businesses/${bizId}/products`, { name: 'Plantilla Premium', kind: 'template', priceCents: 14900, costCents: 0 });
  assert.equal(p.status, 200, JSON.stringify(p.data));
  const demo = await owner.req('POST', `/api/businesses/${bizId}/checkout`, { productId: p.data.id });
  assert.equal(demo.data.isDemo, true);
  await owner.req('POST', `/api/businesses/${bizId}/transactions/${demo.data.transactionId}/simulate-demo-payment`, {});
  let dash = await owner.req('GET', '/api/dashboard');
  assert.equal(dash.data.finance.grossIncomeCents, 0, 'demo no cuenta');

  const ext = await owner.req('POST', `/api/businesses/${bizId}/checkout`, { productId: p.data.id, provider: 'external' });
  assert.equal(ext.data.isDemo, false);
  dash = await owner.req('GET', '/api/dashboard');
  assert.equal(dash.data.finance.grossIncomeCents, 0, 'pendiente no cuenta');

  const payload = JSON.stringify({ eventId: 'evt_1', type: 'payment.succeeded', providerRef: ext.data.providerRef, amountCents: 14900, currency: 'MXN', feeCents: 600 });
  const ts = String(Math.floor(Date.now() / 1000));
  const anon = new Client();
  const bad = await anon.req('POST', '/api/payments/webhook/external', payload, { 'x-signature': 'deadbeef', 'x-timestamp': ts });
  assert.equal(bad.status, 401);
  const sig = signPayload(WEBHOOK, payload, ts);
  const good = await anon.req('POST', '/api/payments/webhook/external', payload, { 'x-signature': sig, 'x-timestamp': ts });
  assert.equal(good.data.applied, true);
  const dup = await anon.req('POST', '/api/payments/webhook/external', payload, { 'x-signature': sig, 'x-timestamp': ts });
  assert.equal(dup.data.applied, false);
  dash = await owner.req('GET', '/api/dashboard');
  assert.equal(dash.data.finance.grossIncomeCents, 14900);
  assert.equal(dash.data.finance.feesCents, 600);
  assert.equal(dash.data.finance.netProfitCents, 14300);
});

test('roles: viewer no puede modificar; borrado CRM requiere confirmación', async () => {
  await owner.req('POST', '/api/users', { email: 'ver@ejemplo.mx', name: 'Ver', role: 'viewer', password: 'clave12345lectura' });
  const viewer = new Client();
  await viewer.req('POST', '/api/auth/login', { email: 'ver@ejemplo.mx', password: 'clave12345lectura' });
  assert.equal((await viewer.req('GET', '/api/dashboard')).status, 200);
  assert.equal((await viewer.req('POST', '/api/businesses', { name: 'Z' })).status, 403);
  assert.equal((await owner.req('DELETE', `/api/businesses/${bizId}/customers/${customerId}`, {})).status, 400);
  assert.equal((await owner.req('DELETE', `/api/businesses/${bizId}/customers/${customerId}`, { confirm: 'ELIMINAR' })).status, 200);
});

test('rate limiting en login', async () => {
  const c = new Client();
  let last = 0;
  for (let i = 0; i < 12; i++) last = (await c.req('POST', '/api/auth/login', { email: 'nadie@x.mx', password: 'x' })).status;
  assert.equal(last, 429);
});
