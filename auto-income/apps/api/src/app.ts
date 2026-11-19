/**
 * AUTO-INCOME AI — API principal.
 * createApp() devuelve un request handler listo para node:http, más el orquestador.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, normalize, extname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { all, get, run, transaction, audit, parseJson, schemaVersion, type DB } from '../../../packages/database/src/index.ts';
import { asObject, str, num, oneOf, bool, strList, arr, EMAIL_RE, PHONE_RE, ValidationError } from '../../../packages/shared/src/validate.ts';
import { isValidCurrency, formatMoney } from '../../../packages/shared/src/money.ts';
import {
  priceFromMargin, priceFromMarkup, profitBreakdown, marginPct, markupPct, breakEvenUnits,
  calculateQuote, quoteToWhatsAppText, whatsAppShareUrl, normalizeName, describeLevel, type QuoteInput,
} from '../../../packages/core/src/index.ts';
import { Orchestrator, addKnowledge, searchKnowledge } from '../../../packages/agents/src/orchestrator.ts';
import { AGENTS, publicAgentInfo } from '../../../packages/agents/src/agents.ts';
import { TASK_STATUSES, type AgentId, type TaskStatus } from '../../../packages/agents/src/types.ts';
import { dashboard, financialSummary, periodRange, topProducts, trafficSummary, type PeriodKey } from '../../../packages/analytics/src/metrics.ts';
import { can, hashPassword, verifyPassword, randomToken, sha256, safeEqual, RateLimiter, type Permission, type Role } from '../../../packages/security/src/index.ts';
import { DemoPaymentProvider, HmacWebhookProvider, applyPaymentEvent, simulateDemoPayment, startCheckout, type PaymentProvider } from '../../../packages/integrations/src/payments.ts';
import { Router, HttpError, parseCookies, readBody, sendJson, errorToResponse, SECURITY_HEADERS, type Ctx } from './http.ts';

export interface AppOptions {
  env?: Record<string, string | undefined>;
  clock?: () => number;
  staticDir?: string;
}

const SESSION_COOKIE = 'aia_session';
const SESSION_TTL_MS = 7 * 24 * 3_600_000;

export function createApp(db: DB, opts: AppOptions = {}) {
  const env = opts.env ?? process.env;
  const clock = opts.clock ?? Date.now;
  const isProd = env.NODE_ENV === 'production';
  const orchestrator = new Orchestrator(db, AGENTS, { clock, env });
  const providers = new Map<string, PaymentProvider>([['demo', new DemoPaymentProvider()]]);
  if (env.PAYMENT_WEBHOOK_SECRET) providers.set('external', new HmacWebhookProvider('external', env.PAYMENT_WEBHOOK_SECRET, clock));
  const limiters = {
    auth: new RateLimiter(10, 15 * 60_000, clock),
    public: new RateLimiter(120, 60_000, clock),
    default: new RateLimiter(600, 60_000, clock),
  };
  const r = new Router();
  const nowIso = () => new Date(clock()).toISOString();
  const id = (p: string) => `${p}_${randomUUID().replace(/-/g, '')}`;

  // ---------- helpers ----------
  const actor = (c: Ctx) => (c.user ? `user:${c.user.id}` : 'anon');
  const need = (c: Ctx, p: Permission) => { if (!c.user || !can(c.user.role, p)) throw new HttpError(403, 'permiso insuficiente', 'forbidden'); };
  const body = (c: Ctx) => asObject(c.body ?? {});
  function business(bid: string) {
    const b = get<Record<string, unknown>>(db, 'SELECT * FROM businesses WHERE id = ?', bid);
    if (!b) throw new HttpError(404, 'negocio no encontrado', 'not_found');
    return b;
  }
  function owned(table: string, rid: string, bid?: string) {
    const row = get<Record<string, unknown>>(db, `SELECT * FROM ${table} WHERE id = ?`, rid);
    if (!row || (bid && row.business_id !== bid)) throw new HttpError(404, 'no encontrado', 'not_found');
    return row;
  }
  const cents = (o: Record<string, unknown>, f: string, optional = false) => num(o, f, { min: 0, max: 10_000_000_000, integer: true, optional });
  const period = (c: Ctx) => {
    const p = (c.query.get('period') ?? '30d') as PeriodKey;
    if (!['today', '7d', '30d', '90d', 'all', 'custom'].includes(p)) throw new ValidationError('period', 'inválido');
    return periodRange(p, new Date(clock()), { from: c.query.get('from') ?? undefined, to: c.query.get('to') ?? undefined });
  };

  // ---------- salud ----------
  r.get('/health', () => ({
    ok: true,
    service: 'auto-income-ai',
    schemaVersion: schemaVersion(db),
    time: nowIso(),
    ownerConfigured: (get<{ n: number }>(db, "SELECT COUNT(*) n FROM users WHERE role = 'owner'")!.n) > 0,
    paymentsMode: providers.has('external') ? 'external+demo' : 'demo',
  }), { auth: false, rateKey: 'public' });

  // ---------- autenticación ----------
  function createSession(c: Ctx, userId: string) {
    const token = randomToken();
    const csrf = randomToken(24);
    run(db, 'INSERT INTO sessions (id, user_id, token_hash, csrf_token, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)', id('ses'), userId, sha256(token), csrf, nowIso(), new Date(clock() + SESSION_TTL_MS).toISOString());
    const cookie = `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_MS / 1000}${isProd ? '; Secure' : ''}`;
    c.res.setHeader('Set-Cookie', cookie);
    return csrf;
  }

  r.post('/api/auth/setup', (c) => {
    const b = body(c);
    const setupToken = env.OWNER_SETUP_TOKEN;
    if (!setupToken || setupToken.length < 16) throw new HttpError(403, 'configura OWNER_SETUP_TOKEN (mínimo 16 caracteres) en el servidor para crear la cuenta', 'setup_disabled');
    if (!safeEqual(sha256(str(b, 'setupToken', { max: 200 })), sha256(setupToken))) throw new HttpError(403, 'token de configuración inválido', 'forbidden');
    if (get<{ n: number }>(db, "SELECT COUNT(*) n FROM users WHERE role = 'owner'")!.n > 0) throw new HttpError(409, 'el propietario ya existe', 'conflict');
    const email = str(b, 'email', { max: 200, pattern: EMAIL_RE }).toLowerCase();
    const name = str(b, 'name', { max: 100 });
    let hash: string;
    try { hash = hashPassword(String(b.password ?? '')); } catch (e) { throw new ValidationError('password', (e as Error).message); }
    const uid = id('usr');
    run(db, 'INSERT INTO users (id, email, name, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)', uid, email, name, 'owner', hash, nowIso());
    audit(db, { actor: `user:${uid}`, action: 'auth.setup', entity: 'user', entityId: uid });
    const csrfToken = createSession(c, uid);
    return { user: { id: uid, email, name, role: 'owner' }, csrfToken };
  }, { auth: false, rateKey: 'auth' });

  r.post('/api/auth/login', (c) => {
    const b = body(c);
    const email = str(b, 'email', { max: 200 }).toLowerCase();
    const password = str(b, 'password', { max: 200 });
    const u = get<Record<string, unknown>>(db, 'SELECT * FROM users WHERE email = ? AND disabled = 0', email);
    // Siempre se ejecuta scrypt para no revelar si el correo existe (tiempo constante aproximado).
    const ok = verifyPassword(password, (u?.password_hash as string) ?? 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + 'A'.repeat(86) + '==');
    if (!u || !ok) {
      audit(db, { actor: 'anon', action: 'auth.login_failed', entity: 'user', details: { email } });
      throw new HttpError(401, 'credenciales inválidas', 'unauthorized');
    }
    const csrfToken = createSession(c, u.id as string);
    audit(db, { actor: `user:${u.id}`, action: 'auth.login', entity: 'user', entityId: u.id as string });
    return { user: { id: u.id, email: u.email, name: u.name, role: u.role }, csrfToken };
  }, { auth: false, rateKey: 'auth' });

  r.post('/api/auth/logout', (c) => {
    run(db, 'DELETE FROM sessions WHERE id = ?', c.user!.sessionId);
    c.res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${isProd ? '; Secure' : ''}`);
    return { ok: true };
  });

  r.get('/api/auth/me', (c) => ({ user: { id: c.user!.id, email: c.user!.email, name: c.user!.name, role: c.user!.role }, csrfToken: c.user!.csrfToken }));

  r.post('/api/users', (c) => {
    need(c, 'users.manage');
    const b = body(c);
    const email = str(b, 'email', { max: 200, pattern: EMAIL_RE }).toLowerCase();
    const role = oneOf(b, 'role', ['admin', 'viewer'] as const);
    let hash: string;
    try { hash = hashPassword(String(b.password ?? '')); } catch (e) { throw new ValidationError('password', (e as Error).message); }
    if (get(db, 'SELECT id FROM users WHERE email = ?', email)) throw new HttpError(409, 'el correo ya existe', 'conflict');
    const uid = id('usr');
    run(db, 'INSERT INTO users (id, email, name, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)', uid, email, str(b, 'name', { max: 100 }), role, hash, nowIso());
    audit(db, { actor: actor(c), action: 'user.create', entity: 'user', entityId: uid, details: { role } });
    return { id: uid, email, role };
  });

  // ---------- Command Center ----------
  r.get('/api/dashboard', (c) => dashboard(db, period(c)));

  r.get('/api/search', (c) => {
    const q = (c.query.get('q') ?? '').trim().slice(0, 100);
    if (q.length < 2) return { results: [] };
    const like = `%${q.replace(/[%_]/g, '')}%`;
    const results = [
      ...all<Record<string, unknown>>(db, "SELECT 'business' type, id, name title, id business_id FROM businesses WHERE name LIKE ? LIMIT 10", like),
      ...all<Record<string, unknown>>(db, "SELECT 'product' type, id, name title, business_id FROM products WHERE name LIKE ? OR description LIKE ? LIMIT 10", like, like),
      ...all<Record<string, unknown>>(db, "SELECT 'customer' type, id, name title, business_id FROM customers WHERE name LIKE ? OR email LIKE ? OR company LIKE ? LIMIT 10", like, like, like),
      ...all<Record<string, unknown>>(db, "SELECT 'quote' type, id, number || ' ' || customer_name title, business_id FROM quotes WHERE number LIKE ? OR customer_name LIKE ? LIMIT 10", like, like),
      ...all<Record<string, unknown>>(db, "SELECT 'task' type, id, objective title, business_id FROM tasks WHERE objective LIKE ? LIMIT 10", like),
    ];
    return { results };
  });

  r.get('/api/notifications', (c) => ({
    notifications: all(db, `SELECT * FROM notifications ${c.query.get('unread') === '1' ? 'WHERE read = 0' : ''} ORDER BY created_at DESC LIMIT 100`),
  }));
  r.post('/api/notifications/:id/read', (c) => { run(db, 'UPDATE notifications SET read = 1 WHERE id = ?', c.params.id); return { ok: true }; });
  r.post('/api/notifications/read-all', () => { run(db, 'UPDATE notifications SET read = 1 WHERE read = 0'); return { ok: true }; });
  r.get('/api/audit', (c) => { need(c, 'settings.manage'); return { entries: all(db, 'SELECT * FROM audit_log ORDER BY id DESC LIMIT 200') }; });

  // ---------- negocios ----------
  r.get('/api/businesses', () => ({
    businesses: all<Record<string, unknown>>(db, 'SELECT * FROM businesses ORDER BY created_at').map((b) => ({ ...b, opportunity_data: parseJson(b.opportunity_data, null) })),
  }));

  r.post('/api/businesses', (c) => {
    need(c, 'business.write');
    const b = body(c);
    const name = str(b, 'name', { max: 80 });
    const normalized = normalizeName(name);
    if (!normalized) throw new ValidationError('name', 'nombre inválido');
    const dup = get<{ id: string }>(db, 'SELECT id FROM businesses WHERE normalized_name = ?', normalized);
    if (dup && !b.duplicateJustification) throw new HttpError(409, 'ya existe un negocio con ese nombre; no se crean duplicados sin justificación', 'duplicate');
    if (dup) throw new HttpError(409, 'usa otro nombre aunque haya justificación; los nombres deben ser únicos', 'duplicate');
    const currency = (str(b, 'currency', { optional: true, max: 3 }) || 'MXN').toUpperCase();
    if (!isValidCurrency(currency)) throw new ValidationError('currency', 'moneda ISO 4217 inválida');
    const level = num(b, 'autonomyLevel', { min: 0, max: 4, integer: true, optional: true, fallback: 2 });
    const color = str(b, 'brandColor', { optional: true, max: 7, pattern: /^#[0-9a-fA-F]{6}$/ }) || '#3b82f6';
    const bid = id('biz');
    let slug = normalized.replace(/ /g, '-');
    if (get(db, 'SELECT id FROM businesses WHERE slug = ?', slug)) slug = `${slug}-${bid.slice(-6)}`;
    run(db, `INSERT INTO businesses (id, name, normalized_name, slug, description, monetization_model, currency, autonomy_level, budget_cents, brand_color, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'idea', ?, ?)`,
      bid, name, normalized, slug, str(b, 'description', { optional: true, max: 2000 }), str(b, 'monetizationModel', { optional: true, max: 100 }) || 'por_definir',
      currency, level, cents(b, 'budgetCents', true), color, nowIso(), nowIso());
    audit(db, { actor: actor(c), action: 'business.create', entity: 'business', entityId: bid, businessId: bid });
    return business(bid);
  });

  r.get('/api/businesses/:bid', (c) => {
    const b = business(c.params.bid);
    return { ...b, opportunity_data: parseJson(b.opportunity_data, null), autonomyDescription: describeLevel(b.autonomy_level as 0), finance: financialSummary(db, { businessId: c.params.bid }) };
  });

  r.patch('/api/businesses/:bid', (c) => {
    need(c, 'business.write');
    const cur = business(c.params.bid);
    const b = body(c);
    const sets: string[] = [];
    const vals: (string | number)[] = [];
    if (b.description !== undefined) { sets.push('description = ?'); vals.push(str(b, 'description', { optional: true, max: 2000 })); }
    if (b.monetizationModel !== undefined) { sets.push('monetization_model = ?'); vals.push(str(b, 'monetizationModel', { max: 100 })); }
    if (b.status !== undefined) { sets.push('status = ?'); vals.push(oneOf(b, 'status', ['idea', 'validating', 'building', 'active', 'paused', 'archived'] as const)); }
    if (b.budgetCents !== undefined) { sets.push('budget_cents = ?'); vals.push(cents(b, 'budgetCents')); }
    if (b.brandColor !== undefined) { sets.push('brand_color = ?'); vals.push(str(b, 'brandColor', { pattern: /^#[0-9a-fA-F]{6}$/ })); }
    if (b.currency !== undefined) {
      const cur2 = str(b, 'currency', { max: 3 }).toUpperCase();
      if (!isValidCurrency(cur2)) throw new ValidationError('currency', 'moneda inválida');
      sets.push('currency = ?'); vals.push(cur2);
    }
    if (b.autonomyLevel !== undefined) {
      need(c, 'settings.manage');
      sets.push('autonomy_level = ?'); vals.push(num(b, 'autonomyLevel', { min: 0, max: 4, integer: true }));
    }
    if (!sets.length) return cur;
    run(db, `UPDATE businesses SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`, ...vals, nowIso(), c.params.bid);
    audit(db, { actor: actor(c), action: 'business.update', entity: 'business', entityId: c.params.bid, businessId: c.params.bid, details: Object.keys(b) });
    return business(c.params.bid);
  });

  // ---------- agentes y tareas ----------
  r.get('/api/agents', () => ({
    agents: AGENTS.map((a) => {
      const stats = Object.fromEntries(all<{ status: string; n: number }>(db, 'SELECT status, COUNT(*) n FROM tasks WHERE agent_id = ? GROUP BY status', a.id).map((s) => [s.status, s.n]));
      const done = (stats.COMPLETED ?? 0) + (stats.FAILED ?? 0);
      return {
        ...publicAgentInfo(a),
        enabled: orchestrator.isAgentEnabled(a.id),
        status: (stats.RUNNING ?? 0) > 0 ? 'trabajando' : orchestrator.isAgentEnabled(a.id) ? 'disponible' : 'desactivado',
        metrics: { ...stats, successRatePct: done ? Math.round(((stats.COMPLETED ?? 0) / done) * 1000) / 10 : null },
      };
    }),
  }));
  r.post('/api/agents/:agentId/enabled', (c) => {
    need(c, 'agent.manage');
    orchestrator.setAgentEnabled(c.params.agentId as AgentId, bool(body(c), 'enabled'), actor(c));
    return { ok: true };
  });

  r.get('/api/tasks', (c) => {
    const status = c.query.get('status');
    if (status && !TASK_STATUSES.includes(status as TaskStatus)) throw new ValidationError('status', 'inválido');
    return { tasks: orchestrator.listTasks({ businessId: c.query.get('businessId') ?? undefined, status: (status as TaskStatus) ?? undefined, agentId: c.query.get('agentId') ?? undefined, limit: Number(c.query.get('limit') ?? 100) || 100 }) };
  });
  r.get('/api/tasks/:id', (c) => {
    const t = orchestrator.getTask(c.params.id);
    if (!t) throw new HttpError(404, 'tarea no encontrada', 'not_found');
    return { task: t, history: orchestrator.taskHistory(t.id) };
  });
  r.post('/api/tasks', (c) => {
    need(c, 'task.create');
    const b = body(c);
    const agentId = str(b, 'agentId', { max: 50 }) as AgentId;
    const businessId = str(b, 'businessId', { optional: true, max: 60 }) || null;
    if (businessId) business(businessId);
    const task = orchestrator.enqueue({
      agentId,
      type: str(b, 'type', { max: 80 }),
      objective: str(b, 'objective', { optional: true, max: 300 }) || undefined,
      input: b.input === undefined ? {} : asObject(b.input, 'input'),
      businessId,
      priority: num(b, 'priority', { min: 0, max: 100, integer: true, optional: true, fallback: 50 }),
      dependsOn: strList(b, 'dependsOn', { max: 20 }),
      idempotencyKey: str(b, 'idempotencyKey', { optional: true, max: 200 }) || undefined,
      createdBy: actor(c),
    });
    audit(db, { actor: actor(c), action: 'task.create', entity: 'task', entityId: task.id, businessId });
    return task;
  });
  r.post('/api/tasks/:id/approve', (c) => { need(c, 'task.approve'); return orchestrator.approve(c.params.id, actor(c)); });
  r.post('/api/tasks/:id/cancel', (c) => { need(c, 'task.create'); return orchestrator.cancel(c.params.id, actor(c), str(body(c), 'reason', { optional: true, max: 300 }) || 'cancelada por el usuario'); });
  r.post('/api/tasks/:id/retry', (c) => { need(c, 'task.approve'); return orchestrator.retry(c.params.id, actor(c)); });
  r.post('/api/orchestrator/tick', async (c) => { need(c, 'task.create'); return orchestrator.tick(10); });

  // ---------- Product Studio ----------
  const PRODUCT_KINDS = ['template', 'calculator', 'web_tool', 'ebook', 'document', 'download', 'micro_app', 'saas', 'service', 'license', 'subscription'] as const;
  r.get('/api/businesses/:bid/products', (c) => {
    business(c.params.bid);
    return { products: all<Record<string, unknown>>(db, 'SELECT * FROM products WHERE business_id = ? ORDER BY updated_at DESC', c.params.bid).map((p) => ({ ...p, files: parseJson(p.files, []), qa_report: parseJson(p.qa_report, null), marginPct: marginPct(p.price_cents as number, p.cost_cents as number) })) };
  });
  r.post('/api/businesses/:bid/products', (c) => {
    need(c, 'product.write');
    const biz = business(c.params.bid);
    const b = body(c);
    const pid = id('prd');
    run(db, `INSERT INTO products (id, business_id, name, kind, description, audience, problem, value_proposition, price_cents, cost_cents, currency, status, sales_page, documentation, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
      pid, c.params.bid, str(b, 'name', { max: 120 }), oneOf(b, 'kind', PRODUCT_KINDS, 'template'), str(b, 'description', { optional: true, max: 5000 }),
      str(b, 'audience', { optional: true, max: 1000 }), str(b, 'problem', { optional: true, max: 1000 }), str(b, 'valueProposition', { optional: true, max: 1000 }),
      cents(b, 'priceCents', true), cents(b, 'costCents', true), biz.currency as string, str(b, 'salesPage', { optional: true, max: 20000 }), str(b, 'documentation', { optional: true, max: 20000 }), nowIso(), nowIso());
    audit(db, { actor: actor(c), action: 'product.create', entity: 'product', entityId: pid, businessId: c.params.bid });
    return owned('products', pid);
  });
  r.patch('/api/businesses/:bid/products/:pid', (c) => {
    need(c, 'product.write');
    const cur = owned('products', c.params.pid, c.params.bid);
    const b = body(c);
    if (b.status === 'published') throw new HttpError(400, 'la publicación se hace con la tarea product.publish (requiere QA aprobado)', 'use_task');
    const fields: [string, string, () => string | number][] = [
      ['name', 'name', () => str(b, 'name', { max: 120 })],
      ['description', 'description', () => str(b, 'description', { optional: true, max: 5000 })],
      ['audience', 'audience', () => str(b, 'audience', { optional: true, max: 1000 })],
      ['problem', 'problem', () => str(b, 'problem', { optional: true, max: 1000 })],
      ['valueProposition', 'value_proposition', () => str(b, 'valueProposition', { optional: true, max: 1000 })],
      ['priceCents', 'price_cents', () => cents(b, 'priceCents')],
      ['costCents', 'cost_cents', () => cents(b, 'costCents')],
      ['salesPage', 'sales_page', () => str(b, 'salesPage', { optional: true, max: 20000 })],
      ['documentation', 'documentation', () => str(b, 'documentation', { optional: true, max: 20000 })],
      ['status', 'status', () => oneOf(b, 'status', ['draft', 'review', 'archived'] as const)],
    ];
    const sets: string[] = [];
    const vals: (string | number)[] = [];
    for (const [key, col, read] of fields) if (b[key] !== undefined) { sets.push(`${col} = ?`); vals.push(read()); }
    if (!sets.length) return cur;
    transaction(db, () => {
      // Historial de versiones: guarda la versión anterior completa.
      run(db, 'INSERT INTO product_versions (id, product_id, version, snapshot, created_at) VALUES (?, ?, ?, ?, ?)', id('pv'), cur.id as string, cur.version as number, JSON.stringify(cur), nowIso());
      // Cualquier cambio de contenido invalida el QA anterior y saca el producto de publicado.
      const contentChanged = sets.some((s) => !s.startsWith('status'));
      run(db, `UPDATE products SET ${sets.join(', ')}, version = version + 1, ${contentChanged ? "qa_report = NULL, status = CASE WHEN status IN ('ready','published') THEN 'review' ELSE status END," : ''} updated_at = ? WHERE id = ?`, ...vals, nowIso(), cur.id as string);
    });
    audit(db, { actor: actor(c), action: 'product.update', entity: 'product', entityId: cur.id as string, businessId: c.params.bid });
    return owned('products', c.params.pid);
  });
  r.get('/api/businesses/:bid/products/:pid/versions', (c) => {
    owned('products', c.params.pid, c.params.bid);
    return { versions: all<Record<string, unknown>>(db, 'SELECT version, created_at, snapshot FROM product_versions WHERE product_id = ? ORDER BY version DESC', c.params.pid).map((v) => ({ ...v, snapshot: parseJson(v.snapshot, {}) })) };
  });

  // ---------- CRM ----------
  const STAGES = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'] as const;
  function customerFields(b: Record<string, unknown>, partial: boolean) {
    const out: Record<string, string | number> = {};
    const set = (k: string, col: string, read: () => string | number) => { if (!partial || b[k] !== undefined) out[col] = read(); };
    set('name', 'name', () => str(b, 'name', { max: 120 }));
    set('email', 'email', () => str(b, 'email', { optional: true, max: 200, pattern: EMAIL_RE }).toLowerCase());
    set('phone', 'phone', () => str(b, 'phone', { optional: true, max: 30, pattern: PHONE_RE }));
    set('company', 'company', () => str(b, 'company', { optional: true, max: 120 }));
    set('kind', 'kind', () => oneOf(b, 'kind', ['lead', 'customer'] as const, 'lead'));
    set('stage', 'stage', () => oneOf(b, 'stage', STAGES, 'new'));
    set('source', 'source', () => str(b, 'source', { optional: true, max: 60 }) || 'manual');
    set('tags', 'tags', () => JSON.stringify(strList(b, 'tags', { max: 20, itemMax: 40 })));
    set('marketingConsent', 'marketing_consent', () => (bool(b, 'marketingConsent') ? 1 : 0));
    set('nextFollowUp', 'next_follow_up', () => str(b, 'nextFollowUp', { optional: true, max: 30 }));
    return out;
  }
  r.get('/api/businesses/:bid/customers', (c) => {
    business(c.params.bid);
    const stage = c.query.get('stage');
    const rows = all<Record<string, unknown>>(db, `SELECT * FROM customers WHERE business_id = ? ${stage ? 'AND stage = ?' : ''} ORDER BY updated_at DESC LIMIT 500`, c.params.bid, ...(stage ? [stage] : []));
    return { customers: rows.map((x) => ({ ...x, tags: parseJson(x.tags, []) })) };
  });
  r.post('/api/businesses/:bid/customers', (c) => {
    need(c, 'crm.write');
    business(c.params.bid);
    const f = customerFields(body(c), false);
    const cid = id('cus');
    const cols = Object.keys(f);
    run(db, `INSERT INTO customers (id, business_id, ${cols.join(', ')}, created_at, updated_at) VALUES (?, ?, ${cols.map(() => '?').join(', ')}, ?, ?)`, cid, c.params.bid, ...cols.map((k) => f[k]), nowIso(), nowIso());
    audit(db, { actor: actor(c), action: 'customer.create', entity: 'customer', entityId: cid, businessId: c.params.bid });
    return owned('customers', cid);
  });
  r.patch('/api/businesses/:bid/customers/:cid', (c) => {
    need(c, 'crm.write');
    owned('customers', c.params.cid, c.params.bid);
    const f = customerFields(body(c), true);
    const cols = Object.keys(f);
    if (cols.length) run(db, `UPDATE customers SET ${cols.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`, ...cols.map((k) => f[k]), nowIso(), c.params.cid);
    return owned('customers', c.params.cid);
  });
  r.get('/api/businesses/:bid/customers/:cid', (c) => {
    const cu = owned('customers', c.params.cid, c.params.bid);
    return {
      customer: { ...cu, tags: parseJson(cu.tags, []) },
      notes: all(db, 'SELECT * FROM customer_notes WHERE customer_id = ? ORDER BY created_at DESC', c.params.cid),
      quotes: all(db, 'SELECT id, number, status, total_cents, currency, created_at FROM quotes WHERE customer_id = ? ORDER BY created_at DESC', c.params.cid),
      transactions: all(db, "SELECT id, kind, amount_cents, currency, status, occurred_at FROM transactions WHERE customer_id = ? AND source != 'demo' ORDER BY occurred_at DESC", c.params.cid),
    };
  });
  r.post('/api/businesses/:bid/customers/:cid/notes', (c) => {
    need(c, 'crm.write');
    owned('customers', c.params.cid, c.params.bid);
    const nid = id('note');
    run(db, 'INSERT INTO customer_notes (id, customer_id, body, author, created_at) VALUES (?, ?, ?, ?, ?)', nid, c.params.cid, str(body(c), 'body', { max: 5000 }), c.user!.name, nowIso());
    return { id: nid };
  });
  r.get('/api/businesses/:bid/customers/:cid/export', (c) => {
    need(c, 'crm.export');
    const cu = owned('customers', c.params.cid, c.params.bid);
    audit(db, { actor: actor(c), action: 'customer.export', entity: 'customer', entityId: c.params.cid, businessId: c.params.bid });
    return {
      exportedAt: nowIso(),
      customer: { ...cu, tags: parseJson(cu.tags, []) },
      notes: all(db, 'SELECT body, author, created_at FROM customer_notes WHERE customer_id = ?', c.params.cid),
      quotes: all(db, 'SELECT number, status, totals, created_at FROM quotes WHERE customer_id = ?', c.params.cid).map((q) => ({ ...q, totals: parseJson(q.totals, {}) })),
      transactions: all(db, 'SELECT kind, amount_cents, currency, status, occurred_at FROM transactions WHERE customer_id = ?', c.params.cid),
    };
  });
  r.delete('/api/businesses/:bid/customers/:cid', (c) => {
    need(c, 'crm.delete');
    owned('customers', c.params.cid, c.params.bid);
    if (str(body(c), 'confirm', { max: 20 }) !== 'ELIMINAR') throw new HttpError(400, 'confirma escribiendo ELIMINAR', 'confirmation_required');
    transaction(db, () => {
      // Derecho de supresión: se borran datos personales; las cotizaciones/transacciones quedan anonimizadas por obligaciones contables.
      run(db, "UPDATE quotes SET customer_name = '[eliminado]' WHERE customer_id = ?", c.params.cid);
      run(db, 'DELETE FROM customers WHERE id = ?', c.params.cid);
    });
    audit(db, { actor: actor(c), action: 'customer.delete', entity: 'customer', entityId: c.params.cid, businessId: c.params.bid });
    return { deleted: true };
  });

  // ---------- CotizaFácil MX: calculadoras (públicas, sin datos personales) ----------
  r.post('/api/cotizafacil/calc/price', (c) => {
    const b = body(c);
    const costCents = cents(b, 'costCents');
    const mode = oneOf(b, 'mode', ['markup', 'margin'] as const);
    const pct = num(b, 'percent', { min: -100, max: 10_000 });
    const priceCents = mode === 'markup' ? priceFromMarkup(costCents, pct) : priceFromMargin(costCents, pct);
    return { priceCents, profitCents: priceCents - costCents, marginPct: marginPct(priceCents, costCents), markupPct: markupPct(priceCents, costCents) };
  }, { auth: false, rateKey: 'public' });
  r.post('/api/cotizafacil/calc/profit', (c) => {
    const b = body(c);
    const res = profitBreakdown(cents(b, 'priceCents'), cents(b, 'costCents'), num(b, 'quantity', { min: 0.0001, max: 1_000_000, optional: true, fallback: 1 }));
    const fixed = b.fixedCostsCents === undefined ? null : breakEvenUnits(cents(b, 'fixedCostsCents'), res.priceCents, res.costCents);
    return { ...res, breakEvenUnits: fixed };
  }, { auth: false, rateKey: 'public' });
  r.post('/api/cotizafacil/calc/quote', (c) => calculateQuote(parseQuoteInput(body(c))), { auth: false, rateKey: 'public' });

  function parseQuoteInput(b: Record<string, unknown>): QuoteInput {
    const lines = arr(b, 'lines', { max: 200 }).map((raw, i) => {
      const l = asObject(raw, `lines[${i}]`);
      return {
        description: str(l, 'description', { max: 300 }),
        quantity: num(l, 'quantity', { min: 0.0001, max: 1_000_000 }),
        unitPriceCents: cents(l, 'unitPriceCents'),
        unitCostCents: l.unitCostCents === undefined || l.unitCostCents === null ? undefined : cents(l, 'unitCostCents'),
        discountPct: num(l, 'discountPct', { min: 0, max: 100, optional: true }),
      };
    });
    return {
      lines,
      globalDiscountPct: num(b, 'globalDiscountPct', { min: 0, max: 100, optional: true }),
      taxRatePct: num(b, 'taxRatePct', { min: 0, max: 100, optional: true, fallback: 16 }),
      pricesIncludeTax: bool(b, 'pricesIncludeTax'),
    };
  }

  // ---------- CotizaFácil: catálogo y cotizaciones persistentes ----------
  r.get('/api/businesses/:bid/catalog', (c) => { business(c.params.bid); return { items: all(db, 'SELECT * FROM catalog_items WHERE business_id = ? ORDER BY name', c.params.bid) }; });
  r.post('/api/businesses/:bid/catalog', (c) => {
    need(c, 'quote.write');
    business(c.params.bid);
    const b = body(c);
    const iid = id('itm');
    run(db, 'INSERT INTO catalog_items (id, business_id, name, unit, price_cents, cost_cents, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      iid, c.params.bid, str(b, 'name', { max: 200 }), str(b, 'unit', { optional: true, max: 30 }) || 'pieza', cents(b, 'priceCents'), b.costCents === undefined ? null : cents(b, 'costCents'), nowIso(), nowIso());
    return owned('catalog_items', iid);
  });
  r.delete('/api/businesses/:bid/catalog/:iid', (c) => { need(c, 'quote.write'); owned('catalog_items', c.params.iid, c.params.bid); run(db, 'DELETE FROM catalog_items WHERE id = ?', c.params.iid); return { deleted: true }; });

  function quoteView(q: Record<string, unknown>) {
    const biz = business(q.business_id as string);
    const totals = parseJson<ReturnType<typeof calculateQuote>>(q.totals, null as never);
    const customer = q.customer_id ? get<{ phone: string }>(db, 'SELECT phone FROM customers WHERE id = ?', q.customer_id as string) : undefined;
    const text = quoteToWhatsAppText({ businessName: biz.name as string, quoteNumber: q.number as string, customerName: q.customer_name as string, totals, validUntil: (q.valid_until as string) ?? undefined, notes: q.notes as string, format: (v) => formatMoney(v, q.currency as string) });
    return { ...q, input: parseJson(q.input, {}), totals, whatsappText: text, whatsappUrl: whatsAppShareUrl(text, customer?.phone || undefined), businessName: biz.name, brandColor: biz.brand_color };
  }
  r.get('/api/businesses/:bid/quotes', (c) => { business(c.params.bid); return { quotes: all(db, 'SELECT id, number, kind, status, customer_name, customer_id, total_cents, currency, valid_until, created_at FROM quotes WHERE business_id = ? ORDER BY seq DESC LIMIT 500', c.params.bid) }; });
  r.get('/api/businesses/:bid/quotes/:qid', (c) => quoteView(owned('quotes', c.params.qid, c.params.bid)));
  r.post('/api/businesses/:bid/quotes', (c) => {
    need(c, 'quote.write');
    const biz = business(c.params.bid);
    const b = body(c);
    const input = parseQuoteInput(b);
    const totals = calculateQuote({ ...input, currency: biz.currency as string });
    const customerId = str(b, 'customerId', { optional: true, max: 60 }) || null;
    let customerName = str(b, 'customerName', { optional: true, max: 120 });
    if (customerId) customerName = (owned('customers', customerId, c.params.bid).name as string);
    const kind = oneOf(b, 'kind', ['quote', 'budget'] as const, 'quote');
    const validUntil = str(b, 'validUntil', { optional: true, max: 10, pattern: /^\d{4}-\d{2}-\d{2}$/ }) || null;
    const qid = id('quo');
    transaction(db, () => {
      const seq = (get<{ s: number | null }>(db, 'SELECT MAX(seq) s FROM quotes WHERE business_id = ?', c.params.bid)!.s ?? 0) + 1;
      const number = `${kind === 'quote' ? 'COT' : 'PRE'}-${String(seq).padStart(4, '0')}`;
      run(db, `INSERT INTO quotes (id, business_id, number, seq, customer_id, customer_name, status, kind, currency, input, totals, total_cents, valid_until, notes, template, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        qid, c.params.bid, number, seq, customerId, customerName, kind, biz.currency as string, JSON.stringify(input), JSON.stringify(totals), totals.totalCents,
        validUntil, str(b, 'notes', { optional: true, max: 2000 }), oneOf(b, 'template', ['basic', 'premium_dark', 'premium_classic'] as const, 'basic'), nowIso(), nowIso());
    });
    audit(db, { actor: actor(c), action: 'quote.create', entity: 'quote', entityId: qid, businessId: c.params.bid });
    return quoteView(owned('quotes', qid));
  });
  r.patch('/api/businesses/:bid/quotes/:qid', (c) => {
    need(c, 'quote.write');
    owned('quotes', c.params.qid, c.params.bid);
    run(db, 'UPDATE quotes SET status = ?, updated_at = ? WHERE id = ?', oneOf(body(c), 'status', ['draft', 'sent', 'accepted', 'rejected', 'expired'] as const), nowIso(), c.params.qid);
    return quoteView(owned('quotes', c.params.qid));
  });

  // ---------- Finanzas ----------
  r.get('/api/businesses/:bid/transactions', (c) => { business(c.params.bid); return { transactions: all(db, 'SELECT * FROM transactions WHERE business_id = ? ORDER BY occurred_at DESC LIMIT 500', c.params.bid) }; });
  r.post('/api/businesses/:bid/transactions', (c) => {
    need(c, 'finance.write');
    const biz = business(c.params.bid);
    const b = body(c);
    const kind = oneOf(b, 'kind', ['income', 'expense', 'refund', 'fee'] as const);
    const occurredAt = str(b, 'occurredAt', { optional: true, max: 30 });
    if (occurredAt && Number.isNaN(Date.parse(occurredAt))) throw new ValidationError('occurredAt', 'fecha inválida');
    const tid = id('txn');
    run(db, `INSERT INTO transactions (id, business_id, kind, amount_cents, currency, category, description, status, source, product_id, customer_id, channel, occurred_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed', 'manual', ?, ?, ?, ?, ?)`,
      tid, c.params.bid, kind, cents(b, 'amountCents'), biz.currency as string, str(b, 'category', { optional: true, max: 60 }) || 'general',
      str(b, 'description', { optional: true, max: 300 }), str(b, 'productId', { optional: true, max: 60 }) || null, str(b, 'customerId', { optional: true, max: 60 }) || null,
      str(b, 'channel', { optional: true, max: 40 }) || null, occurredAt ? new Date(occurredAt).toISOString() : nowIso(), nowIso());
    audit(db, { actor: actor(c), action: 'transaction.manual', entity: 'transaction', entityId: tid, businessId: c.params.bid, details: { kind } });
    return owned('transactions', tid);
  });
  r.get('/api/analytics', (c) => {
    const range = period(c);
    const businessId = c.query.get('businessId') ?? undefined;
    if (businessId) business(businessId);
    const filter = { businessId, ...range };
    return { range, finance: financialSummary(db, filter), traffic: trafficSummary(db, filter), topProducts: topProducts(db, filter), infrastructureMonthlyCents: get<{ t: number }>(db, 'SELECT COALESCE(SUM(monthly_cents),0) t FROM service_costs WHERE enabled = 1')!.t, aiCostCents: get<{ t: number }>(db, 'SELECT COALESCE(SUM(actual_cost_cents),0) t FROM tasks')!.t };
  });
  r.get('/api/costs', () => ({ services: all(db, 'SELECT * FROM service_costs ORDER BY category, name') }));

  // ---------- Pagos ----------
  r.post('/api/businesses/:bid/checkout', async (c) => {
    need(c, 'finance.write');
    const biz = business(c.params.bid);
    const b = body(c);
    const p = owned('products', str(b, 'productId', { max: 60 }), c.params.bid);
    const providerId = oneOf(b, 'provider', ['demo', 'external'] as const, 'demo');
    const provider = providers.get(providerId);
    if (!provider) throw new HttpError(400, 'proveedor no configurado (modo demo disponible)', 'provider_not_configured');
    if ((p.price_cents as number) <= 0) throw new HttpError(400, 'el producto no tiene precio', 'invalid');
    return startCheckout(db, provider, { businessId: c.params.bid, productId: p.id as string, amountCents: p.price_cents as number, currency: biz.currency as string, customerId: str(b, 'customerId', { optional: true, max: 60 }) || null, channel: str(b, 'channel', { optional: true, max: 40 }) || 'direct' });
  });
  r.post('/api/businesses/:bid/transactions/:tid/simulate-demo-payment', (c) => {
    need(c, 'finance.write');
    owned('transactions', c.params.tid, c.params.bid);
    try { simulateDemoPayment(db, c.params.tid); } catch (e) { throw new HttpError(400, (e as Error).message, 'invalid'); }
    return { ok: true, note: 'Pago de DEMOSTRACIÓN: no cuenta en métricas reales.' };
  });
  r.post('/api/payments/webhook/:provider', (c) => {
    const provider = providers.get(c.params.provider);
    if (!provider || provider.isDemo) throw new HttpError(404, 'proveedor desconocido', 'not_found');
    const event = provider.parseWebhook(c.rawBody, c.headers);
    if (!event) {
      audit(db, { actor: `provider:${c.params.provider}`, action: 'webhook.rejected', entity: 'payment', details: { ip: c.ip } });
      throw new HttpError(401, 'firma inválida', 'invalid_signature');
    }
    return applyPaymentEvent(db, provider.id, event, c.rawBody);
  }, { auth: false, rateKey: 'public', rawBody: true });

  // ---------- Analítica pública (ingesta de eventos) ----------
  r.post('/api/track', (c) => {
    const b = body(c);
    const biz = get<{ id: string }>(db, 'SELECT id FROM businesses WHERE slug = ?', str(b, 'business', { max: 100 }));
    if (!biz) throw new HttpError(404, 'negocio desconocido', 'not_found');
    const day = new Date(clock()).toISOString().slice(0, 10);
    // Hash diario anónimo: no guarda IP ni identificadores persistentes.
    const visitor = sha256(`${c.ip}|${c.headers['user-agent'] ?? ''}|${day}|${env.SESSION_SECRET ?? ''}`).slice(0, 32);
    run(db, 'INSERT INTO analytics_events (business_id, type, channel, path, visitor_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      biz.id, oneOf(b, 'type', ['page_view', 'signup', 'lead', 'checkout', 'purchase'] as const), (str(b, 'channel', { optional: true, max: 40 }) || 'direct').toLowerCase(), str(b, 'path', { optional: true, max: 200 }) || '/', visitor, nowIso());
    return { ok: true };
  }, { auth: false, rateKey: 'public' });

  // ---------- Base de conocimiento ----------
  r.get('/api/knowledge', (c) => {
    const businessId = c.query.get('businessId');
    const q = c.query.get('q');
    if (q) return { entries: searchKnowledge(db, '*', businessId, q) };
    return { entries: all(db, `SELECT * FROM knowledge ${businessId ? 'WHERE business_id = ? OR business_id IS NULL' : ''} ORDER BY updated_at DESC LIMIT 200`, ...(businessId ? [businessId] : [])) };
  });
  r.post('/api/knowledge', (c) => {
    need(c, 'knowledge.write');
    const b = body(c);
    const businessId = str(b, 'businessId', { optional: true, max: 60 }) || null;
    if (businessId) business(businessId);
    const kid = addKnowledge(db, actor(c), businessId, {
      kind: oneOf(b, 'kind', ['doc', 'decision', 'research', 'strategy', 'result', 'error', 'experiment', 'lesson', 'faq'] as const),
      title: str(b, 'title', { max: 200 }), body: str(b, 'body', { max: 20000 }), tags: strList(b, 'tags'),
      allowedAgents: strList(b, 'allowedAgents').length ? strList(b, 'allowedAgents') : ['*'], locked: bool(b, 'locked'),
    });
    return { id: kid };
  });
  r.patch('/api/knowledge/:kid', (c) => {
    need(c, 'knowledge.write');
    const k = owned('knowledge', c.params.kid);
    if (k.locked && c.user!.role !== 'owner') throw new HttpError(403, 'entrada protegida: solo el propietario puede modificarla', 'locked');
    const b = body(c);
    run(db, 'UPDATE knowledge SET title = ?, body = ?, updated_at = ? WHERE id = ?', str(b, 'title', { max: 200 }), str(b, 'body', { max: 20000 }), nowIso(), c.params.kid);
    return owned('knowledge', c.params.kid);
  });

  // ---------- estáticos (web compilada) ----------
  const staticDir = opts.staticDir && existsSync(opts.staticDir) ? resolve(opts.staticDir) : null;
  const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
  function serveStatic(c: Ctx): boolean {
    if (!staticDir || c.method !== 'GET' || c.path.startsWith('/api/')) return false;
    let file = normalize(join(staticDir, decodeURIComponent(c.path)));
    if (!file.startsWith(staticDir)) return false;
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(staticDir, 'index.html'); // SPA fallback
    if (!existsSync(file)) return false;
    const immutable = c.path.startsWith('/assets/');
    c.res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream', 'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache' });
    c.res.end(readFileSync(file));
    return true;
  }

  // ---------- pipeline de petición ----------
  async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://local');
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers[k] = v;
    const ip = (env.TRUST_PROXY === '1' ? headers['x-forwarded-for']?.split(',')[0]?.trim() : undefined) || req.socket.remoteAddress || 'unknown';
    const c: Ctx = { req, res, method: req.method ?? 'GET', path: url.pathname, params: {}, query: url.searchParams, rawBody: '', body: undefined, ip, cookies: parseCookies(headers.cookie), headers };
    try {
      const m = r.match(c.method, c.path);
      if (!m) {
        if (serveStatic(c)) return;
        throw new HttpError(404, 'ruta no encontrada', 'not_found');
      }
      if ('allowed' in m) throw new HttpError(405, 'método no permitido', 'method_not_allowed');
      const { route, params } = m;
      c.params = params;
      const limiter = limiters[route.opts.rateKey ?? 'default'];
      const rl = limiter.take(`${route.opts.rateKey ?? 'default'}:${ip}`);
      if (!rl.allowed) { res.setHeader('Retry-After', String(rl.retryAfterSec)); throw new HttpError(429, 'demasiadas solicitudes; intenta más tarde', 'rate_limited'); }

      if (c.method !== 'GET') {
        const ct = headers['content-type'] ?? '';
        c.rawBody = await readBody(req);
        if (c.rawBody) {
          if (!ct.includes('application/json')) throw new HttpError(415, 'usa Content-Type: application/json', 'unsupported_media_type');
          try { c.body = JSON.parse(c.rawBody); } catch { throw new HttpError(400, 'JSON inválido', 'invalid_json'); }
        }
      }

      if (route.opts.auth !== false) {
        const token = c.cookies[SESSION_COOKIE];
        if (!token) throw new HttpError(401, 'inicia sesión', 'unauthorized');
        const s = get<Record<string, unknown>>(db, 'SELECT s.id sid, s.csrf_token, s.expires_at, u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND u.disabled = 0', sha256(token));
        if (!s || Date.parse(s.expires_at as string) < clock()) throw new HttpError(401, 'sesión expirada', 'unauthorized');
        c.user = { id: s.id as string, email: s.email as string, name: s.name as string, role: s.role as Role, sessionId: s.sid as string, csrfToken: s.csrf_token as string };
        // CSRF: cookie SameSite=Strict + token de doble envío en cabecera para métodos que modifican estado.
        if (c.method !== 'GET' && !safeEqual(headers['x-csrf-token'] ?? '', c.user.csrfToken)) throw new HttpError(403, 'token CSRF inválido', 'csrf');
        if (c.method !== 'GET' && c.user.role === 'viewer') throw new HttpError(403, 'tu rol es de solo lectura', 'forbidden');
      }
      const result = await route.handler(c);
      sendJson(res, 200, result ?? { ok: true });
    } catch (err) {
      const { status, body: errBody } = errorToResponse(err);
      if (status >= 500) console.error('[api]', c.method, c.path, err);
      sendJson(res, status, errBody);
    }
  }

  return { handle, orchestrator, db };
}
