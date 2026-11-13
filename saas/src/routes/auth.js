import express from 'express';
import { z } from 'zod';
import { HttpError, parse } from '../lib/http.js';
import { errorFields } from '../lib/logger.js';
import { hashPassword, normalizeEmail, verifyPassword } from '../lib/security.js';
import { consumeAuthToken, issueAuthToken } from '../services/authTokens.js';
import { emails } from '../services/mailer.js';
import { rateLimit } from '../services/rateLimit.js';
import { clearSessionCookie, createSession, deleteSession, deleteUserSessions, setSessionCookie } from '../services/sessions.js';
import { createUser, findUserByEmail, findUserById } from '../services/users.js';
import { requireUser } from '../middleware/auth.js';

export const passwordSchema = z.string()
  .min(10, 'Usa al menos 10 caracteres.')
  .max(128, 'Usa como máximo 128 caracteres.');

const emailSchema = z.string().trim().max(254).pipe(z.email('Escribe un correo válido.'));

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Escribe tu nombre.').max(100),
  email: emailSchema,
  password: passwordSchema,
  businessName: z.string().trim().max(150).optional(),
  acceptTerms: z.literal(true, { error: 'Debes aceptar los términos y el aviso de privacidad.' }),
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
    const message = emails.verifyEmail(config.appName, user.name, `${config.appUrl}/verificar?token=${token}`);
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
        throw new HttpError(400, 'bad_request', 'Revisa los datos enviados.', { fields: { password: 'La contraseña no debe contener tu correo.' } });
      }
      const created = await createUser(db, {
        name: data.name,
        email: data.email,
        businessName: data.businessName || null,
        passwordHash: await hashPassword(data.password),
      });
      if (!created) {
        throw new HttpError(409, 'email_taken', 'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.');
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
        throw new HttpError(401, 'invalid_credentials', 'Correo o contraseña incorrectos.');
      }
      if (user.status !== 'active') throw new HttpError(403, 'account_suspended', 'Tu cuenta está suspendida. Escríbenos para revisarla.');
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
      if (!userId) throw new HttpError(400, 'invalid_token', 'El enlace no es válido o ya venció. Pide uno nuevo desde tu cuenta.');
      await db.query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()), updated_at = now() WHERE id = $1', [userId]);
      await maybePromoteAdmin(await findUserById(db, userId));
      res.json({ ok: true });
    });

  router.post('/resend-verification',
    requireUser,
    rateLimit(db, { name: 'resend', ...limits.email, keys: (req) => [`user:${req.user.id}`] }),
    async (req, res) => {
      if (req.user.email_verified_at) throw new HttpError(400, 'already_verified', 'Tu correo ya está confirmado.');
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
        const message = emails.resetPassword(config.appName, user.name, `${config.appUrl}/restablecer?token=${token}`);
        await mailer.send({ to: user.email, ...message }).catch((error) => logger.error('no se envió recuperación', errorFields(error)));
      }
      // Misma respuesta exista o no la cuenta.
      res.json({ ok: true, message: 'Si existe una cuenta con ese correo, te enviamos un enlace para restablecer tu contraseña.' });
    });

  router.post('/reset-password',
    rateLimit(db, { name: 'reset', ...limits.token, keys: (req) => [byIp(req)] }),
    async (req, res) => {
      const data = parse(z.object({ token: tokenSchema.shape.token, password: passwordSchema }), req.body);
      const userId = await consumeAuthToken(db, data.token, 'reset_password');
      if (!userId) throw new HttpError(400, 'invalid_token', 'El enlace no es válido o ya venció. Solicita uno nuevo.');
      const { rows } = await db.query(
        `UPDATE users SET password_hash = $2, failed_logins = 0,
           email_verified_at = COALESCE(email_verified_at, now()), updated_at = now()
         WHERE id = $1 RETURNING *`,
        [userId, await hashPassword(data.password)],
      );
      await deleteUserSessions(db, userId);
      const user = rows[0];
      await mailer.send({ to: user.email, ...emails.passwordChanged(config.appName, user.name) })
        .catch((error) => logger.error('no se envió aviso de cambio', errorFields(error)));
      res.json({ ok: true });
    });

  return router;
}
