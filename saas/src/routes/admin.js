import express from 'express';
import { z } from 'zod';
import { HttpError, fieldError, notFound, parse } from '../lib/http.js';
import { requireAdmin, requireUser } from '../middleware/auth.js';
import { effectivePlanId, planName } from '../plans.js';
import { audit } from '../services/audit.js';
import { adminStats } from '../services/stats.js';
import { deleteUserSessions } from '../services/sessions.js';
import { periodFor, usageSummary } from '../services/usage.js';
import { getTool, toolName } from '../ai/tools.js';

const uuid = z.uuid();
const pageSchema = z.coerce.number().int().min(1).max(10000).default(1);
const EFFECTIVE_PLAN_SQL = "CASE WHEN u.plan_expires_at IS NULL OR u.plan_expires_at > now() THEN u.plan_id ELSE 'free' END";

function adminUserRow(row, plans) {
  const plan = plans.get(effectivePlanId(row));
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    businessName: row.business_name,
    role: row.role,
    status: row.status,
    emailVerified: Boolean(row.email_verified_at),
    plan: { id: plan.id, name: planName(plan.id, 'es'), source: plan.id === 'free' ? 'default' : row.plan_source, expiresAt: row.plan_expires_at },
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    usedThisMonth: row.used ?? 0,
  };
}

export function adminRouter(ctx) {
  const { db, config, plans, ai, billing, mailer } = ctx;
  const router = express.Router();
  router.use(requireUser, requireAdmin);

  const loadTarget = async (id) => {
    if (!uuid.safeParse(id).success) throw notFound('admin.user_not_found');
    const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    if (!rows[0]) throw notFound('admin.user_not_found');
    return rows[0];
  };

  router.get('/stats', async (_req, res) => {
    res.json(await adminStats(db, { timezone: config.timezone, plans, ai: config.ai }));
  });

  router.get('/system', (_req, res) => {
    res.json({
      appName: config.appName,
      environment: config.env,
      database: db.kind,
      ai: { provider: ai.name, model: ai.model },
      billingEnabled: billing.enabled,
      emailEnabled: mailer.enabled,
      requireEmailVerification: config.auth.requireEmailVerification,
      warnings: config.warnings,
    });
  });

  router.get('/users', async (req, res) => {
    const query = parse(z.object({
      q: z.string().trim().max(120).optional(),
      plan: z.string().max(40).optional(),
      status: z.enum(['active', 'suspended']).optional(),
      page: pageSchema,
    }), req.query);
    const pageSize = 25;
    const search = query.q ? `%${query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
    const { rows } = await db.query(
      `SELECT u.*, uc.used FROM users u
       LEFT JOIN usage_counters uc ON uc.user_id = u.id AND uc.period = $1
       WHERE ($2::text IS NULL OR u.email ILIKE $2 OR u.name ILIKE $2 OR u.business_name ILIKE $2)
         AND ($3::text IS NULL OR (${EFFECTIVE_PLAN_SQL}) = $3)
         AND ($4::text IS NULL OR u.status = $4)
       ORDER BY u.created_at DESC
       LIMIT $5 OFFSET $6`,
      [periodFor(new Date(), config.timezone), search, query.plan ?? null, query.status ?? null, pageSize + 1, (query.page - 1) * pageSize],
    );
    res.json({ items: rows.slice(0, pageSize).map((row) => adminUserRow(row, plans)), page: query.page, hasMore: rows.length > pageSize });
  });

  router.get('/users/:id', async (req, res) => {
    const target = await loadTarget(req.params.id);
    const plan = plans.get(effectivePlanId(target));
    const [usage, subscriptions, payments, generations, sessions] = await Promise.all([
      usageSummary(db, target.id, plan, config.timezone),
      db.query('SELECT plan_id, status, amount_cents, currency, current_period_end, cancel_at_period_end, created_at FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC', [target.id]),
      db.query('SELECT amount_cents, currency, status, paid_at FROM payments WHERE user_id = $1 ORDER BY paid_at DESC LIMIT 20', [target.id]),
      // Solo metadatos: el contenido de las generaciones es privado del usuario.
      db.query(
        `SELECT tool_id, status, credits, input_tokens, output_tokens, latency_ms, error_code, created_at
         FROM generations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [target.id],
      ),
      db.query('SELECT COUNT(*)::int AS n FROM sessions WHERE user_id = $1 AND expires_at > now()', [target.id]),
    ]);
    res.json({
      user: {
        ...adminUserRow(target, plans),
        failedLogins: target.failed_logins,
        stripeCustomer: Boolean(target.stripe_customer_id),
        activeSessions: sessions.rows[0].n,
      },
      usage,
      subscriptions: subscriptions.rows,
      payments: payments.rows,
      recentGenerations: generations.rows.map((row) => ({ ...row, toolName: getTool(row.tool_id) ? toolName(getTool(row.tool_id), 'es') : row.tool_id })),
    });
  });

  router.patch('/users/:id', async (req, res) => {
    const target = await loadTarget(req.params.id);
    const data = parse(z.object({
      status: z.enum(['active', 'suspended']).optional(),
      role: z.enum(['user', 'admin']).optional(),
      planId: z.string().max(40).refine((id) => plans.has(id), 'v.plan').optional(),
      planExpiresAt: z.union([z.iso.datetime({ offset: true }), z.iso.date(), z.null()]).optional(),
    }).strict(), req.body);
    if (target.id === req.user.id && (data.status === 'suspended' || data.role === 'user')) {
      throw new HttpError(400, 'self_change', 'admin.self_change');
    }

    const changes = {};
    if (data.status && data.status !== target.status) changes.status = data.status;
    if (data.role && data.role !== target.role) changes.role = data.role;
    if (data.planId !== undefined) {
      changes.plan_id = data.planId;
      changes.plan_source = data.planId === 'free' ? 'default' : 'manual';
      changes.plan_expires_at = data.planId === 'free' || !data.planExpiresAt ? null : new Date(data.planExpiresAt);
      if (changes.plan_expires_at && changes.plan_expires_at <= new Date()) {
        throw fieldError('planExpiresAt', 'v.future_date');
      }
    }
    const columns = Object.keys(changes);
    if (!columns.length) return res.json({ user: adminUserRow(target, plans) });

    const assignments = columns.map((column, index) => `${column} = $${index + 2}`).join(', ');
    const { rows } = await db.query(
      `UPDATE users SET ${assignments}, updated_at = now() WHERE id = $1 RETURNING *`,
      [target.id, ...columns.map((column) => changes[column])],
    );
    if (changes.status === 'suspended') await deleteUserSessions(db, target.id);
    await audit(db, {
      actor: req.user,
      action: 'admin.user_updated',
      target,
      details: Object.fromEntries(columns.map((column) => [column, { from: target[column] ?? null, to: changes[column] }])),
      ip: req.ip,
    });
    res.json({ user: adminUserRow(rows[0], plans) });
  });

  router.post('/users/:id/reset-usage', async (req, res) => {
    const target = await loadTarget(req.params.id);
    const period = periodFor(new Date(), config.timezone);
    await db.query('DELETE FROM usage_counters WHERE user_id = $1 AND period = $2', [target.id, period]);
    await audit(db, { actor: req.user, action: 'admin.usage_reset', target, details: { period }, ip: req.ip });
    res.json({ ok: true });
  });

  router.post('/users/:id/verify-email', async (req, res) => {
    const target = await loadTarget(req.params.id);
    await db.query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()), updated_at = now() WHERE id = $1', [target.id]);
    await audit(db, { actor: req.user, action: 'admin.email_verified', target, ip: req.ip });
    res.json({ ok: true });
  });

  router.get('/payments', async (req, res) => {
    const { page } = parse(z.object({ page: pageSchema }), req.query);
    const { rows } = await db.query(
      `SELECT p.amount_cents, p.currency, p.status, p.paid_at, p.provider_invoice_id, u.email, u.id AS user_id
       FROM payments p LEFT JOIN users u ON u.id = p.user_id
       ORDER BY p.paid_at DESC LIMIT 51 OFFSET $1`,
      [(page - 1) * 50],
    );
    res.json({ items: rows.slice(0, 50), page, hasMore: rows.length > 50 });
  });

  router.get('/audit', async (req, res) => {
    const { page } = parse(z.object({ page: pageSchema }), req.query);
    const { rows } = await db.query(
      `SELECT action, actor_email, target_email, target_user_id, details, ip, created_at
       FROM audit_log ORDER BY created_at DESC LIMIT 51 OFFSET $1`,
      [(page - 1) * 50],
    );
    res.json({ items: rows.slice(0, 50), page, hasMore: rows.length > 50 });
  });

  return router;
}
