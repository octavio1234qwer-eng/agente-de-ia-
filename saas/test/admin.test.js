import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { PASSWORD, setup, signUp } from './helpers.js';

describe('panel de administración', () => {
  let ctx;
  let admin;
  let adminUser;
  let member;
  let memberUser;
  before(async () => {
    ctx = await setup();
    ({ client: admin, user: adminUser } = await signUp(ctx, { email: 'jefa@ejemplo.mx', name: 'Jefa' }));
    ({ client: member, user: memberUser } = await signUp(ctx, { email: 'socio@ejemplo.mx', name: 'Socio' }));
    await member.post('/api/tools/resenas/run', { input: { negocio: 'Café', estrellas: '4 estrellas', resena: 'Buen café' } });
  });
  after(() => ctx.close());

  it('solo permite el acceso a administradores', async () => {
    assert.equal((await member.get('/api/admin/stats')).status, 403);
    assert.equal((await ctx.client().get('/api/admin/stats')).status, 401);
    assert.equal((await admin.get('/api/admin/stats')).status, 200);
  });

  it('calcula estadísticas del negocio', async () => {
    const { body } = await admin.get('/api/admin/stats');
    assert.equal(body.users.total, 2);
    assert.equal(body.users.verified, 2);
    assert.equal(body.usage30d.generations, 1);
    assert.equal(body.daily.length, 30);
    assert.equal(body.daily.at(-1).generations, 1);
    assert.equal(body.topTools[0].toolId, 'resenas');
    assert.deepEqual(body.plans.map((p) => p.id), ['free', 'pro', 'negocio']);
  });

  it('busca usuarios y muestra solo metadatos de su actividad', async () => {
    const list = await admin.get('/api/admin/users?q=socio');
    assert.equal(list.body.items.length, 1);
    assert.equal(list.body.items[0].usedThisMonth, 1);
    const pct = await admin.get('/api/admin/users?q=%25');
    assert.equal(pct.body.items.length, 0, 'los comodines se escapan');
    const detail = await admin.get(`/api/admin/users/${memberUser.id}`);
    assert.equal(detail.body.recentGenerations.length, 1);
    assert.equal('output' in detail.body.recentGenerations[0], false);
    assert.equal('input' in detail.body.recentGenerations[0], false);
    assert.equal((await admin.get('/api/admin/users/no-es-uuid')).status, 404);
  });

  it('asigna un plan manual con vencimiento y vuelve a Gratis al vencer', async () => {
    const future = new Date(Date.now() + 15 * 86400000).toISOString();
    const res = await admin.patch(`/api/admin/users/${memberUser.id}`, { planId: 'pro', planExpiresAt: future });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.plan.id, 'pro');
    assert.equal(res.body.user.plan.source, 'manual');
    assert.equal((await member.get('/api/auth/me')).body.user.plan.id, 'pro');

    await ctx.db.query("UPDATE users SET plan_expires_at = now() - interval '1 minute' WHERE id = $1", [memberUser.id]);
    assert.equal((await member.get('/api/auth/me')).body.user.plan.id, 'free');
    const past = await admin.patch(`/api/admin/users/${memberUser.id}`, { planId: 'pro', planExpiresAt: '2020-01-01' });
    assert.equal(past.status, 400);
    assert.equal((await admin.patch(`/api/admin/users/${memberUser.id}`, { planId: 'platino' })).status, 400);
  });

  it('suspende cuentas cerrando sus sesiones y no permite suspenderse a sí mismo', async () => {
    assert.equal((await admin.patch(`/api/admin/users/${adminUser.id}`, { status: 'suspended' })).status, 400);
    assert.equal((await admin.patch(`/api/admin/users/${adminUser.id}`, { role: 'user' })).status, 400);
    const res = await admin.patch(`/api/admin/users/${memberUser.id}`, { status: 'suspended' });
    assert.equal(res.status, 200);
    assert.equal((await member.get('/api/auth/me')).status, 401);
    const login = await ctx.client().post('/api/auth/login', { email: 'socio@ejemplo.mx', password: PASSWORD });
    assert.equal(login.status, 403);
    await admin.patch(`/api/admin/users/${memberUser.id}`, { status: 'active' });
  });

  it('reinicia créditos y deja todo en la bitácora de auditoría', async () => {
    assert.equal((await admin.post(`/api/admin/users/${memberUser.id}/reset-usage`)).status, 200);
    const detail = await admin.get(`/api/admin/users/${memberUser.id}`);
    assert.equal(detail.body.usage.used, 0);
    const audit = await admin.get('/api/admin/audit');
    const actions = audit.body.items.map((item) => item.action);
    assert.ok(actions.includes('admin.usage_reset'));
    assert.ok(actions.includes('admin.user_updated'));
    const statusChange = audit.body.items.find((item) => item.details?.status?.to === 'suspended');
    assert.equal(statusChange.actor_email, 'jefa@ejemplo.mx');
    assert.equal(statusChange.target_email, 'socio@ejemplo.mx');
  });
});

describe('cuenta del usuario', () => {
  let ctx;
  before(async () => { ctx = await setup(); });
  after(() => ctx.close());

  it('actualiza el perfil y cambia la contraseña cerrando otras sesiones', async () => {
    const { client } = await signUp(ctx, { email: 'perfil@ejemplo.mx' });
    const other = ctx.client();
    await other.post('/api/auth/login', { email: 'perfil@ejemplo.mx', password: PASSWORD });
    const updated = await client.patch('/api/account', { name: 'Nombre Nuevo', businessName: '' });
    assert.equal(updated.body.user.name, 'Nombre Nuevo');
    assert.equal(updated.body.user.businessName, null);
    assert.equal((await client.post('/api/account/password', { currentPassword: 'equivocada', newPassword: 'nueva frase segura 1' })).status, 400);
    assert.equal((await client.post('/api/account/password', { currentPassword: PASSWORD, newPassword: 'nueva frase segura 1' })).status, 200);
    assert.equal((await client.get('/api/auth/me')).status, 200, 'la sesión actual sigue activa');
    assert.equal((await other.get('/api/auth/me')).status, 401, 'las demás sesiones se cierran');
  });

  it('exporta los datos del usuario', async () => {
    const { client } = await signUp(ctx, { email: 'exporta@ejemplo.mx' });
    await client.post('/api/tools/resenas/run', { input: { negocio: 'Café', estrellas: '5 estrellas', resena: 'Excelente' } });
    const res = await client.get('/api/account/export');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-disposition'), /attachment/);
    assert.equal(res.body.account.email, 'exporta@ejemplo.mx');
    assert.equal(res.body.generations.length, 1);
    assert.equal(JSON.stringify(res.body).includes('password'), false);
  });

  it('elimina la cuenta solo con contraseña y confirmación', async () => {
    const { client, user } = await signUp(ctx, { email: 'adios@ejemplo.mx' });
    assert.equal((await client.del('/api/account', { password: PASSWORD, confirm: 'si' })).status, 400);
    assert.equal((await client.del('/api/account', { password: 'mala', confirm: 'ELIMINAR' })).status, 400);
    assert.equal((await client.del('/api/account', { password: PASSWORD, confirm: 'ELIMINAR' })).status, 204);
    assert.equal((await client.get('/api/auth/me')).status, 401);
    const { rows } = await ctx.db.query('SELECT COUNT(*)::int AS n FROM generations WHERE user_id = $1', [user.id]);
    assert.equal(rows[0].n, 0);
    const audit = await ctx.db.query("SELECT target_email FROM audit_log WHERE action = 'account.deleted'");
    assert.equal(audit.rows[0].target_email, 'adios@ejemplo.mx');
  });

  it('impide que el único administrador elimine su cuenta', async () => {
    const { client } = await signUp(ctx, { email: 'jefa@ejemplo.mx' });
    const res = await client.del('/api/account', { password: PASSWORD, confirm: 'ELIMINAR' });
    assert.equal(res.status, 409);
  });
});
