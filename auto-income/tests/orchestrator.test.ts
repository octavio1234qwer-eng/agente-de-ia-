import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, run, get } from '../packages/database/src/index.ts';
import { Orchestrator } from '../packages/agents/src/orchestrator.ts';
import { AGENTS } from '../packages/agents/src/agents.ts';
import type { AgentDefinition } from '../packages/agents/src/types.ts';
import { financialSummary } from '../packages/analytics/src/metrics.ts';

function setup(level = 2, extraAgents: AgentDefinition[] = []) {
  const db = openDatabase(':memory:');
  let now = Date.parse('2026-11-19T12:00:00Z');
  const clock = () => now;
  const orch = new Orchestrator(db, [...AGENTS, ...extraAgents], { clock, baseBackoffMs: 1000, env: { SESSION_SECRET: 'x'.repeat(40) } });
  const ts = new Date(now).toISOString();
  run(db, 'INSERT INTO businesses (id, name, normalized_name, slug, autonomy_level, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', 'biz_1', 'CotizaFácil MX', 'cotizafacil mx', 'cotizafacil-mx', level, ts, ts);
  return { db, orch, advance: (ms: number) => { now += ms; } };
}

const PRODUCT = {
  name: 'Plantilla de cotización premium',
  kind: 'template',
  audience: 'Pequeños negocios mexicanos que cotizan por WhatsApp',
  problem: 'Hacer cotizaciones profesionales toma demasiado tiempo',
  valueProposition: 'Cotizaciones con IVA y margen correctos en menos de un minuto.',
  description: 'Plantilla editable con cálculo automático de IVA, descuentos y vigencia, lista para compartir.',
  priceCents: 14900,
  costCents: 0,
};

test('agente o tarea inexistente se rechaza', () => {
  const { orch } = setup(2);
  assert.throws(() => orch.enqueue({ agentId: 'nope' as never, type: 'x' }), /agente desconocido/);
  assert.throws(() => orch.enqueue({ agentId: 'seo', type: 'seo.nope' }), /no tiene la tarea/);
});

test('nivel 2 ejecuta internas; publicar requiere aprobación; dependencias y QA', async () => {
  const { orch } = setup(2);
  const spec = orch.enqueue({ agentId: 'product_creation', type: 'product.create_spec', businessId: 'biz_1', input: PRODUCT });
  assert.equal(spec.status, 'QUEUED');
  await orch.tick();
  const done = orch.getTask(spec.id)!;
  assert.equal(done.status, 'COMPLETED', String(done.error));
  const productId = (done.result as { output: { productId: string } }).output.productId;

  const qa = orch.enqueue({ agentId: 'product_creation', type: 'product.quality_check', businessId: 'biz_1', input: { productId } });
  const pub = orch.enqueue({ agentId: 'product_creation', type: 'product.publish', businessId: 'biz_1', input: { productId }, dependsOn: [qa.id] });
  assert.equal(pub.status, 'WAITING_APPROVAL', 'publicar en nivel 2 requiere aprobación');
  await orch.tick();
  const qaDone = orch.getTask(qa.id)!;
  assert.equal(qaDone.status, 'COMPLETED');
  assert.equal((qaDone.result as { output: { passed: boolean } }).output.passed, true);
  orch.approve(pub.id, 'usr_owner');
  await orch.tick();
  assert.equal(orch.getTask(pub.id)!.status, 'COMPLETED');
  assert.equal(get<{ status: string }>(orch.db, 'SELECT status FROM products WHERE id = ?', productId)!.status, 'published');
  const history = orch.taskHistory(pub.id).map((h) => h.toStatus);
  assert.deepEqual(history, ['WAITING_APPROVAL', 'PENDING', 'QUEUED', 'RUNNING', 'COMPLETED']);
});

test('nivel 1: todo espera aprobación', () => {
  const { orch } = setup(1);
  const t = orch.enqueue({ agentId: 'financial', type: 'finance.report', businessId: 'biz_1' });
  assert.equal(t.status, 'WAITING_APPROVAL');
});

test('idempotencia y prevención de duplicados', () => {
  const { orch } = setup(2);
  const a = orch.enqueue({ agentId: 'financial', type: 'finance.report', businessId: 'biz_1', idempotencyKey: 'k1' });
  const b = orch.enqueue({ agentId: 'financial', type: 'finance.report', businessId: 'biz_1', idempotencyKey: 'k1' });
  assert.equal(a.id, b.id);
  assert.equal(b.deduplicated, true);
  const c = orch.enqueue({ agentId: 'seo', type: 'seo.keyword_plan', businessId: 'biz_1', input: { keywords: ['cotizar'] } });
  const d = orch.enqueue({ agentId: 'seo', type: 'seo.keyword_plan', businessId: 'biz_1', input: { keywords: ['cotizar'] } });
  assert.equal(c.id, d.id, 'misma tarea activa no se duplica');
});

test('reintentos con backoff y fallo definitivo; dependiente se cancela', async () => {
  let calls = 0;
  const flaky: AgentDefinition = {
    id: 'software_engineering', name: 'Flaky', objective: '', instructions: [], tools: [], forbidden: [],
    limits: { maxTasksPerHour: 100, maxAttempts: 2, timeoutMs: 1000 },
    handlers: { 'flaky.run': { description: 'falla', risk: 'internal_low', idempotent: true, run: () => { calls++; throw new Error('boom'); } } },
  };
  const { orch, advance } = setup(2, []);
  orch.agents.set('software_engineering', flaky);
  const t = orch.enqueue({ agentId: 'software_engineering', type: 'flaky.run', businessId: 'biz_1' });
  const dep = orch.enqueue({ agentId: 'financial', type: 'finance.report', businessId: 'biz_1', dependsOn: [t.id] });
  assert.equal(dep.status, 'PENDING');
  await orch.tick();
  assert.equal(orch.getTask(t.id)!.status, 'QUEUED');
  await orch.tick();
  assert.equal(calls, 1, 'respeta el backoff');
  advance(1500);
  await orch.tick();
  assert.equal(calls, 2);
  assert.equal(orch.getTask(t.id)!.status, 'FAILED');
  assert.equal(orch.getTask(dep.id)!.status, 'CANCELLED');
});

test('timeout y recuperación: no idempotente pasa a revisión humana', async () => {
  const { orch, advance } = setup(2);
  const t = orch.enqueue({ agentId: 'product_creation', type: 'product.create_spec', businessId: 'biz_1', input: PRODUCT });
  // Simula caída a mitad de ejecución
  run(orch.db, "UPDATE tasks SET status = 'RUNNING', lease_until = ? WHERE id = ?", new Date(Date.parse('2026-11-19T12:00:10Z')).toISOString(), t.id);
  advance(60_000);
  orch.recover();
  assert.equal(orch.getTask(t.id)!.status, 'WAITING_APPROVAL');

  const r = orch.enqueue({ agentId: 'financial', type: 'finance.report', businessId: 'biz_1' });
  run(orch.db, "UPDATE tasks SET status = 'RUNNING', attempts = 1, lease_until = ? WHERE id = ?", new Date(0).toISOString(), r.id);
  orch.recover();
  assert.equal(orch.getTask(r.id)!.status, 'QUEUED', 'idempotente se reencola');
});

test('cancelación, agente desactivado y límite por hora', async () => {
  const { orch } = setup(2);
  const t = orch.enqueue({ agentId: 'financial', type: 'finance.report', businessId: 'biz_1' });
  orch.cancel(t.id, 'usr');
  assert.equal(orch.getTask(t.id)!.status, 'CANCELLED');
  assert.throws(() => orch.cancel(t.id, 'usr'));
  orch.setAgentEnabled('seo', false, 'usr');
  assert.throws(() => orch.enqueue({ agentId: 'seo', type: 'seo.keyword_plan', input: { keywords: ['a'] } }), /desactivado/);
  run(orch.db, "INSERT INTO agent_settings (agent_id, enabled, max_tasks_per_hour) VALUES ('marketing', 1, 0)");
  // marketing con límite 0 no se ejecuta
  run(orch.db, "INSERT INTO products (id, business_id, name, kind, created_at, updated_at) VALUES ('p1','biz_1','X','template','x','x')");
  const m = orch.enqueue({ agentId: 'marketing', type: 'marketing.draft_posts', businessId: 'biz_1', input: { productId: 'p1' } });
  await orch.tick();
  assert.equal(orch.getTask(m.id)!.status, 'QUEUED');
});

test('agentes: investigación sin datos falla (no inventa); con datos puntúa', async () => {
  const { orch } = setup(2);
  const bad = orch.enqueue({ agentId: 'market_research', type: 'research.evaluate_opportunity', businessId: 'biz_1' });
  await orch.tick();
  const badT = orch.getTask(bad.id)!;
  assert.equal(badT.status, 'FAILED');
  assert.match(String(badT.error), /no inventa/);
  const e = (v: number) => ({ value: v, evidence: 'estimate' });
  const good = orch.enqueue({ agentId: 'market_research', type: 'research.evaluate_opportunity', businessId: 'biz_1', input: { scores: { demand: e(4), competition: e(3), devCost: e(2), opCost: e(1), monetization: e(3), complexity: e(2), risk: e(2), timeToValidate: e(2) } } });
  await orch.tick();
  assert.equal(orch.getTask(good.id)!.status, 'COMPLETED');
  assert.equal(get<{ status: string }>(orch.db, "SELECT status FROM businesses WHERE id = 'biz_1'")!.status, 'validating');
});

test('soporte escala cuando no hay documentación y responde cuando la hay', async () => {
  const { orch } = setup(2);
  const a = orch.enqueue({ agentId: 'customer_support', type: 'support.answer', businessId: 'biz_1', input: { question: '¿Cuál es la política de reembolsos?' } });
  await orch.tick();
  assert.equal((orch.getTask(a.id)!.result as { output: { escalated: boolean } }).output.escalated, true);
  run(orch.db, "INSERT INTO knowledge (id, business_id, kind, title, body, created_by, created_at, updated_at) VALUES ('k1','biz_1','faq','Política de reembolsos','Reembolsos dentro de 7 días si la plantilla no funciona.','owner','x','x')");
  const b = orch.enqueue({ agentId: 'customer_support', type: 'support.answer', businessId: 'biz_1', input: { question: 'política de reembolsos' } });
  await orch.tick();
  const out = (orch.getTask(b.id)!.result as { output: { answered: boolean; answer: string } }).output;
  assert.equal(out.answered, true);
  assert.match(out.answer, /7 días/);
});

test('finanzas: demo y pendientes no cuentan; beneficio ≠ ingreso bruto', () => {
  const { db } = setup(2);
  const ins = (kind: string, amount: number, status: string, source: string, ref: string) =>
    run(db, "INSERT INTO transactions (id, business_id, kind, amount_cents, currency, status, source, provider, provider_ref, occurred_at, created_at) VALUES (?, 'biz_1', ?, ?, 'MXN', ?, ?, 'p', ?, '2026-11-19T00:00:00Z', 'x')", ref, kind, amount, status, source, ref);
  ins('income', 100000, 'confirmed', 'manual', 'a');
  ins('income', 50000, 'pending', 'manual', 'b');
  ins('income', 999999, 'confirmed', 'demo', 'c');
  ins('refund', 10000, 'confirmed', 'manual', 'd');
  ins('fee', 4000, 'confirmed', 'manual', 'e');
  ins('expense', 20000, 'confirmed', 'manual', 'f');
  const s = financialSummary(db, { businessId: 'biz_1' });
  assert.equal(s.grossIncomeCents, 100000);
  assert.equal(s.pendingIncomeCents, 50000);
  assert.equal(s.netRevenueCents, 86000);
  assert.equal(s.netProfitCents, 66000);
  assert.equal(s.demoTransactionsExcluded, 1);
});
