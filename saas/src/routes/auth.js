import express from 'express';
import { z } from 'zod';
import { HttpError, fieldError, parse } from '../lib/http.js';
import { CURRENCIES } from '../plans.js';
import { SUPPORTED_LOCALES, t } from '../i18n.js';
import { errorFields } from '../lib/logger.js';
import { hashPassword, normalizeEmail, verifyPassword } from '../lib/security.js';
import { consumeAuthToken, issueAuthToken } from '../services/authTokens.js';
import { emails } from '../services/mailer.js';
import { rateLimit } from '../services/rateLimit.js';
import { clearSessionCookie, createSession, deleteSession, deleteUserSessions, setSessionCookie } from '../services/sessions.js';
import { createUser, findUserByEmail, findUserById } from '../services/users.js';
import { requireUser } from '../middleware/auth.js';

export const passwordSchema = z.string().min(10, 'v.min_chars').max(128, 'v.max_chars');

const emailSchema = z.string().trim().max(254).pipe(z.email('v.email'));

export const localeSchema = z.enum(SUPPORTED_LOCALES);
export const currencySchema = z.enum(CURRENCIES);
export const countrySchema = z.string().trim().max(60);

const registerSchema = z.object({
  name: z.string().trim().min(2, 'v.name').max(100),
  email: emailSchema,
  password: passwordSchema,
  businessName: z.string().trim().max(150).optional(),
  acceptTerms: z.literal(true, { error: 'v.terms' }),
  locale: localeSchema.optional(),
  currency: currencySchema.optional(),
  country: countrySchema.optional(),
});

const loginSchema = z.object({
  email: z.string().trim().max(254),
  password: z.string().max(200),
});

const tokenSchema = z.object({ token: z.string().min(10).max(100) });

export function authRouter(ctx) {
  const { db, config, logger, mailer, limits, sendUser } = ctx;
  const router = express.Router();
  const byIp = (req) => `ip:${req.ip}`;
  const byEmail = (req) => (typeof req.body?.email === 'string' ? `email:${normalizeEmail(req.body.email)}` : null);
  let dummyHash;

  const sendVerification = async (user) => {
    const token = await issueAuthToken(db, user.id, 'verify_email');
    const message = emails.verifyEmail({ appName: config.appName, locale: user.locale, name: user.name, url: `${config.appUrl}/verificar?token=${token}` });
    await mailer.send({ to: user.email, ...message }).catch((error) => logger.error('no se envió verificación', errorFields(error)));
  };

  // Promueve a administrador los correos de ADMIN_EMAILS solo cuando el correo ya está comprobado.
  const maybePromoteAdmin = async (user) => {
    const verified = user.email_verified_at || !config.auth.requireEmailVerification;
    if (user.role !== 'admin' && verified && config.auth.adminEmails.includes(user.email_normalized)) {
      await db.query("UPDATE users SET role = 'admin', updated_at = now() WHERE id = $1", [user.id]);
      logger.info('usuario promovido a administrador por ADMIN_EMAILS', { user: user.id });
      return { ...user, role: 'admin' };
    }
    return user;
  };

  const startSession = async (req, res, user) => {
    if (req.sessionToken) await deleteSession(db, req.sessionToken);
    const token = await createSession(db, user.id, { ttlMs: config.auth.sessionTtlMs, ip: req.ip, userAgent: req.get('user-agent') });
    setSessionCookie(res, config, token);
  };

  router.post('/register',
    rateLimit(db, { name: 'register', ...limits.register, keys: (req) => [byIp(req)] }),
    async (req, res) => {
      const data = parse(registerSchema, req.body);
      const localPart = normalizeEmail(data.email).split('@')[0];
      if (localPart.length >= 4 && data.password.toLowerCase().includes(localPart)) {
        throw fieldError('password', 'v.password_contains_email');
      }
      const created = await createUser(db, {
        name: data.name,
        email: data.email,
        businessName: data.businessName || null,
        passwordHash: await hashPassword(data.password),
        locale: data.locale ?? req.locale,
        currency: data.currency ?? (req.locale === 'es' ? 'mxn' : 'usd'),
        country: data.country || null,
      });
      if (!created) {
        throw new HttpError(409, 'email_taken', 'auth.email_taken');
      }
      const user = await maybePromoteAdmin(created);
      await sendVerification(user);
      await startSession(req, res, user);
      logger.info('registro', { user: user.id });
      res.status(201);
      await sendUser(res, user);
    });

  router.post('/login',
    rateLimit(db, { name: 'login', ...limits.login, keys: (req) => [byIp(req), byEmail(req)] }),
    async (req, res) => {
      const data = parse(loginSchema, req.body);
      const user = await findUserByEmail(db, data.email);
      dummyHash ??= await hashPassword('contraseña-de-relleno-para-igualar-tiempos');
      // Se calcula el hash aunque el usuario no exista para no revelar qué correos están registrados.
      const valid = await verifyPassword(data.password, user?.password_hash ?? dummyHash);
      if (!user || !valid) {
        if (user) await db.query('UPDATE users SET failed_logins = failed_logins + 1 WHERE id = $1', [user.id]);
        throw new HttpError(401, 'invalid_credentials', 'auth.invalid_credentials');
      }
      if (user.status !== 'active') throw new HttpError(403, 'account_suspended', 'err.account_suspended');
      await db.query('UPDATE users SET failed_logins = 0, last_login_at = now() WHERE id = $1', [user.id]);
      const current = await maybePromoteAdmin(user);
      await startSession(req, res, current);
      await sendUser(res, current);
    });

  router.post('/logout', async (req, res) => {
    await deleteSession(db, req.sessionToken);
    clearSessionCookie(res, config);
    res.status(204).end();
  });

  router.get('/me', requireUser, async (req, res) => {
    await sendUser(res, req.user);
  });

  router.post('/verify-email',
    rateLimit(db, { name: 'verify', ...limits.token, keys: (req) => [byIp(req)] }),
    async (req, res) => {
      const { token } = parse(tokenSchema, req.body);
      const userId = await consumeAuthToken(db, token, 'verify_email');
      if (!userId) throw new HttpError(400, 'invalid_token', 'auth.invalid_verify_token');
      await db.query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()), updated_at = now() WHERE id = $1', [userId]);
      await maybePromoteAdmin(await findUserById(db, userId));
      res.json({ ok: true });
    });

  router.post('/resend-verification',
    requireUser,
    rateLimit(db, { name: 'resend', ...limits.email, keys: (req) => [`user:${req.user.id}`] }),
    async (req, res) => {
      if (req.user.email_verified_at) throw new HttpError(400, 'already_verified', 'auth.already_verified');
      await sendVerification(req.user);
      res.json({ ok: true, emailEnabled: mailer.enabled });
    });

  router.post('/forgot-password',
    rateLimit(db, { name: 'forgot', ...limits.email, keys: (req) => [byIp(req), byEmail(req)] }),
    async (req, res) => {
      const { email } = parse(z.object({ email: emailSchema }), req.body);
      const user = await findUserByEmail(db, email);
      if (user && user.status === 'active') {
        const token = await issueAuthToken(db, user.id, 'reset_password');
        const message = emails.resetPassword({ appName: config.appName, locale: user.locale, name: user.name, url: `${config.appUrl}/restablecer?token=${token}` });
        await mailer.send({ to: user.email, ...message }).catch((error) => logger.error('no se envió recuperación', errorFields(error)));
      }
      // Misma respuesta exista o no la cuenta.
      res.json({ ok: true, message: t(req.locale, 'auth.reset_sent') });
    });

  router.post('/reset-password',
    rateLimit(db, { name: 'reset', ...limits.token, keys: (req) => [byIp(req)] }),
    async (req, res) => {
      const data = parse(z.object({ token: tokenSchema.shape.token, password: passwordSchema }), req.body);
      const userId = await consumeAuthToken(db, data.token, 'reset_password');
      if (!userId) throw new HttpError(400, 'invalid_token', 'auth.invalid_reset_token');
      const { rows } = await db.query(
        `UPDATE users SET password_hash = $2, failed_logins = 0,
           email_verified_at = COALESCE(email_verified_at, now()), updated_at = now()
         WHERE id = $1 RETURNING *`,
        [userId, await hashPassword(data.password)],
      );
      await deleteUserSessions(db, userId);
      const user = rows[0];
      await mailer.send({ to: user.email, ...emails.passwordChanged({ appName: config.appName, locale: user.locale, name: user.name }) })
        .catch((error) => logger.error('no se envió aviso de cambio', errorFields(error)));
      res.json({ ok: true });
    });

  return router;
}
