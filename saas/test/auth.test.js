import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { PASSWORD, setup, signUp } from './helpers.js';

describe('autenticación', () => {
  let ctx;
  before(async () => { ctx = await setup(); });
  after(() => ctx.close());

  it('registra, crea una sesión con cookie segura y no expone el hash', async () => {
    const client = ctx.client();
    const res = await client.post('/api/auth/register', { name: 'Ana López', email: 'Ana@Ejemplo.mx', password: PASSWORD, acceptTerms: true, businessName: 'Tacos Ana' });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.email, 'Ana@Ejemplo.mx');
    assert.equal(res.body.user.plan.id, 'free');
    assert.equal(res.body.user.emailVerified, false);
    assert.equal(JSON.stringify(res.body).includes('scrypt'), false);
    const cookie = res.headers.getSetCookie()[0];
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    const me = await client.get('/api/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.user.businessName, 'Tacos Ana');
  });

  it('rechaza correos duplicados (sin importar mayúsculas), contraseñas débiles y términos sin aceptar', async () => {
    const client = ctx.client();
    const dup = await client.post('/api/auth/register', { name: 'Otra', email: 'ana@ejemplo.MX', password: PASSWORD, acceptTerms: true });
    assert.equal(dup.status, 409);
    const weak = await client.post('/api/auth/register', { name: 'Beto', email: 'beto@ejemplo.mx', password: 'corta', acceptTerms: true });
    assert.equal(weak.status, 400);
    assert.ok(weak.body.error.fields.password);
    const terms = await client.post('/api/auth/register', { name: 'Beto', email: 'beto@ejemplo.mx', password: PASSWORD, acceptTerms: false });
    assert.equal(terms.status, 400);
    assert.ok(terms.body.error.fields.acceptTerms);
    const containsEmail = await client.post('/api/auth/register', { name: 'Beto', email: 'beto.perez@ejemplo.mx', password: 'beto.perez-2026!', acceptTerms: true });
    assert.equal(containsEmail.status, 400);
  });

  it('inicia y cierra sesión; el error de credenciales es genérico', async () => {
    const client = ctx.client();
    const wrong = await client.post('/api/auth/login', { email: 'ana@ejemplo.mx', password: 'incorrecta-123' });
    assert.equal(wrong.status, 401);
    const unknown = await client.post('/api/auth/login', { email: 'nadie@ejemplo.mx', password: 'incorrecta-123' });
    assert.equal(unknown.status, 401);
    assert.equal(wrong.body.error.message, unknown.body.error.message);
    const { rows } = await ctx.db.query("SELECT failed_logins FROM users WHERE email_normalized = 'ana@ejemplo.mx'");
    assert.equal(rows[0].failed_logins, 1);

    const ok = await client.post('/api/auth/login', { email: 'ANA@ejemplo.mx', password: PASSWORD });
    assert.equal(ok.status, 200);
    assert.equal((await client.get('/api/auth/me')).status, 200);
    assert.equal((await client.post('/api/auth/logout')).status, 204);
    assert.equal((await client.get('/api/auth/me')).status, 401);
  });

  it('bloquea peticiones de otros orígenes (CSRF) y cuerpos que no son JSON', async () => {
    const client = ctx.client();
    const evil = await client.post('/api/auth/logout', {}, { Origin: 'https://sitio-malicioso.com' });
    assert.equal(evil.status, 403);
    assert.equal(evil.body.error.code, 'csrf');
    const crossSite = await client.post('/api/auth/logout', {}, { Origin: '', 'Sec-Fetch-Site': 'cross-site' });
    assert.equal(crossSite.status, 403);
    const form = await client.request('POST', '/api/auth/login', 'email=a&password=b', { 'Content-Type': 'application/x-www-form-urlencoded' });
    assert.equal(form.status, 415);
  });

  it('confirma el correo con un token de un solo uso y promueve ADMIN_EMAILS solo después de confirmar', async () => {
    const client = ctx.client();
    const res = await client.post('/api/auth/register', { name: 'Jefa', email: 'jefa@ejemplo.mx', password: PASSWORD, acceptTerms: true });
    assert.equal(res.body.user.role, 'user');
    const token = ctx.tokenFor('jefa@ejemplo.mx', '/verificar');
    assert.ok(token);
    assert.equal((await client.post('/api/auth/verify-email', { token })).status, 200);
    assert.equal((await client.post('/api/auth/verify-email', { token })).status, 400);
    const me = await client.get('/api/auth/me');
    assert.equal(me.body.user.emailVerified, true);
    assert.equal(me.body.user.role, 'admin');
  });

  it('recupera la contraseña sin revelar si el correo existe y cierra todas las sesiones', async () => {
    const { client: oldSession } = await signUp(ctx, { email: 'olvido@ejemplo.mx' });
    const anon = ctx.client();
    const before = ctx.mails.length;
    const unknown = await anon.post('/api/auth/forgot-password', { email: 'noexiste@ejemplo.mx' });
    const known = await anon.post('/api/auth/forgot-password', { email: 'olvido@ejemplo.mx' });
    assert.equal(unknown.status, 200);
    assert.deepEqual(unknown.body, known.body);
    assert.equal(ctx.mails.length, before + 1);

    const token = ctx.tokenFor('olvido@ejemplo.mx', '/restablecer');
    const weak = await anon.post('/api/auth/reset-password', { token, password: 'corta' });
    assert.equal(weak.status, 400);
    const reset = await anon.post('/api/auth/reset-password', { token, password: 'otra frase nueva y segura' });
    assert.equal(reset.status, 200);
    assert.equal((await anon.post('/api/auth/reset-password', { token, password: 'otra frase nueva y segura' })).status, 400);
    assert.equal((await oldSession.get('/api/auth/me')).status, 401);
    assert.equal((await anon.post('/api/auth/login', { email: 'olvido@ejemplo.mx', password: PASSWORD })).status, 401);
    assert.equal((await anon.post('/api/auth/login', { email: 'olvido@ejemplo.mx', password: 'otra frase nueva y segura' })).status, 200);
  });

  it('impide el acceso a cuentas suspendidas', async () => {
    const { client } = await signUp(ctx, { email: 'suspendida@ejemplo.mx' });
    await ctx.db.query("UPDATE users SET status = 'suspended' WHERE email_normalized = 'suspendida@ejemplo.mx'");
    assert.equal((await client.get('/api/auth/me')).status, 403);
    const login = await ctx.client().post('/api/auth/login', { email: 'suspendida@ejemplo.mx', password: PASSWORD });
    assert.equal(login.status, 403);
  });

  it('envía cabeceras de seguridad y no guarda en caché la API', async () => {
    const res = await ctx.client().get('/api/plans');
    assert.match(res.headers.get('content-security-policy'), /script-src 'self'/);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal(res.headers.get('x-powered-by'), null);
  });
});

describe('límite de intentos', () => {
  let ctx;
  before(async () => { ctx = await setup({ limits: { login: { limit: 4, windowMs: 3_600_000 } } }); });
  after(() => ctx.close());

  it('limita los intentos de inicio de sesión por correo', async () => {
    await signUp(ctx, { email: 'fuerza@ejemplo.mx' });
    const attacker = ctx.client();
    const statuses = [];
    for (let i = 0; i < 5; i += 1) {
      statuses.push((await attacker.post('/api/auth/login', { email: 'fuerza@ejemplo.mx', password: `intento-${i}-xxxx` })).status);
    }
    assert.deepEqual(statuses, [401, 401, 401, 401, 429]);
  });
});
