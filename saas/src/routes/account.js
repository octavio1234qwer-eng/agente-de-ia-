import express from 'express';
import { z } from 'zod';
import { HttpError, parse } from '../lib/http.js';
import { errorFields } from '../lib/logger.js';
import { hashPassword, verifyPassword } from '../lib/security.js';
import { requireUser } from '../middleware/auth.js';
import { audit } from '../services/audit.js';
import { emails } from '../services/mailer.js';
import { clearSessionCookie, deleteUserSessions } from '../services/sessions.js';
import { passwordSchema } from './auth.js';

export function accountRouter(ctx) {
  const { db, config, logger, mailer, billing, sendUser } = ctx;
  const router = express.Router();
  router.use(requireUser);

  router.patch('/', async (req, res) => {
    const data = parse(z.object({
      name: z.string().trim().min(2, 'Escribe tu nombre.').max(100).optional(),
      businessName: z.string().trim().max(150).optional(),
    }).strict(), req.body);
    const { rows } = await db.query(
      `UPDATE users SET name = COALESCE($2, name),
         business_name = CASE WHEN $3::text IS NULL THEN business_name ELSE NULLIF($3::text, '') END,
         updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.user.id, data.name ?? null, data.businessName ?? null],
    );
    await sendUser(res, rows[0]);
  });

  router.post('/password', async (req, res) => {
    const data = parse(z.object({ currentPassword: z.string().max(200), newPassword: passwordSchema }), req.body);
    if (!(await verifyPassword(data.currentPassword, req.user.password_hash))) {
      throw new HttpError(400, 'bad_request', 'Revisa los datos enviados.', { fields: { currentPassword: 'La contraseña actual no es correcta.' } });
    }
    await db.query('UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1', [req.user.id, await hashPassword(data.newPassword)]);
    await deleteUserSessions(db, req.user.id, { exceptTokenHash: req.user.session_token_hash });
    await mailer.send({ to: req.user.email, ...emails.passwordChanged(config.appName, req.user.name) })
      .catch((error) => logger.error('no se envió aviso de cambio', errorFields(error)));
    res.json({ ok: true });
  });

  /** Derecho de acceso (ARCO): descarga de todos los datos de la cuenta. */
  router.get('/export', async (req, res) => {
    const [subscriptions, payments, generations] = await Promise.all([
      db.query('SELECT plan_id, status, amount_cents, currency, current_period_end, created_at FROM subscriptions WHERE user_id = $1', [req.user.id]),
      db.query('SELECT amount_cents, currency, status, paid_at FROM payments WHERE user_id = $1', [req.user.id]),
      db.query(
        `SELECT tool_id, title, input, output, credits, created_at FROM generations
         WHERE user_id = $1 AND status = 'succeeded' AND purged_at IS NULL ORDER BY created_at DESC`,
        [req.user.id],
      ),
    ]);
    const u = req.user;
    res.set('Content-Disposition', 'attachment; filename="mis-datos.json"');
    res.json({
      exportedAt: new Date().toISOString(),
      account: {
        email: u.email, name: u.name, businessName: u.business_name, plan: u.plan_id,
        emailVerifiedAt: u.email_verified_at, createdAt: u.created_at, lastLoginAt: u.last_login_at,
      },
      subscriptions: subscriptions.rows,
      payments: payments.rows,
      generations: generations.rows,
    });
  });

  /** Derecho de cancelación (ARCO): borra la cuenta y sus datos; cancela la suscripción en Stripe. */
  router.delete('/', async (req, res) => {
    const data = parse(z.object({
      password: z.string().max(200),
      confirm: z.literal('ELIMINAR', { error: 'Escribe ELIMINAR para confirmar.' }),
    }), req.body);
    if (!(await verifyPassword(data.password, req.user.password_hash))) {
      throw new HttpError(400, 'bad_request', 'Revisa los datos enviados.', { fields: { password: 'La contraseña no es correcta.' } });
    }
    if (req.user.role === 'admin') {
      const { rows } = await db.query("SELECT COUNT(*)::int AS n FROM users WHERE role = 'admin' AND status = 'active'");
      if (rows[0].n <= 1) throw new HttpError(409, 'last_admin', 'Eres el único administrador. Nombra a otro antes de eliminar tu cuenta.');
    }
    await billing.cancelAllForUser(req.user);
    await audit(db, { actor: null, action: 'account.deleted', target: req.user, ip: req.ip });
    await db.query('DELETE FROM users WHERE id = $1', [req.user.id]);
    clearSessionCookie(res, config);
    logger.info('cuenta eliminada', { user: req.user.id });
    res.status(204).end();
  });

  return router;
}
