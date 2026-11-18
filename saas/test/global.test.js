import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { PASSWORD, fakeStripe, sendWebhook, setup } from './helpers.js';

const EN = { 'X-Locale': 'en' };

async function signUpEn(ctx, email, extra = {}) {
  const client = ctx.client();
  const res = await client.post('/api/auth/register', { name: 'Jane Doe', email, password: PASSWORD, acceptTerms: true, ...extra }, EN);
  assert.equal(res.status, 201);
  const token = ctx.tokenFor(email, '/verificar');
  await client.post('/api/auth/verify-email', { token });
  return { client, user: res.body.user };
}

describe('mercado global: idiomas y monedas', () => {
  let ctx;
  let stripe;
  before(async () => {
    stripe = fakeStripe();
    ctx = await setup({ stripe });
  });
  after(() => ctx.close());

  it('un cliente que se registra en inglés queda con idioma inglés, dólares y correos en inglés', async () => {
    const { user } = await signUpEn(ctx, 'jane@example.com', { country: 'United States' });
    assert.equal(user.locale, 'en');
    assert.equal(user.currency, 'usd');
    assert.equal(user.country, 'United States');
    assert.equal(user.plan.name, 'Free');
    const mail = ctx.mails.find((m) => m.to === 'jane@example.com');
    assert.match(mail.subject, /^Confirm your email/);
    assert.match(mail.html, /<html lang="en">/);
  });

  it('los errores y validaciones llegan en el idioma de la interfaz', async () => {
    const anon = ctx.client();
    const login = await anon.post('/api/auth/login', { email: 'nobody@example.com', password: 'wrong-password' }, EN);
    assert.equal(login.body.error.message, 'Incorrect email or password.');
    const register = await anon.post('/api/auth/register', { name: 'J', email: 'bad', password: 'short', acceptTerms: false }, EN);
    assert.deepEqual(register.body.error.fields, {
      name: 'Enter your name.',
      email: 'Enter a valid email.',
      password: 'Use at least 10 characters.',
      acceptTerms: 'You must accept the terms and the privacy policy.',
    });
    const es = await anon.post('/api/auth/login', { email: 'nadie@ejemplo.mx', password: 'incorrecta-xx' });
    assert.equal(es.body.error.message, 'Correo o contraseña incorrectos.');
  });

  it('el catálogo de herramientas y los planes se traducen', async () => {
    const tools = await ctx.client().get('/api/tools', EN);
    const replies = tools.body.tools.find((tool) => tool.id === 'respuesta-clientes');
    assert.equal(replies.name, 'Customer replies');
    assert.deepEqual(replies.fields.find((f) => f.name === 'tono').options[0], { value: 'warm', label: 'Warm and professional' });
    assert.equal(replies.defaults.outputLanguage, 'en');
    assert.match(replies.example.negocio, /Austin/);
    assert.equal(replies.fields.at(-1).name, 'outputLanguage');

    const plans = await ctx.client().get('/api/plans', EN);
    assert.deepEqual(plans.body.plans.map((p) => p.name), ['Free', 'Pro', 'Business']);
    assert.deepEqual(plans.body.plans[1].prices, { mxn: 199, usd: 12 });
    assert.match(plans.body.plans[1].highlights[0], /500 credits per month/);
    assert.deepEqual(plans.body.currencies, ['mxn', 'usd']);
  });

  it('cobra en dólares con el precio en USD y activa el plan desde la suscripción en USD', async () => {
    const { client, user } = await signUpEn(ctx, 'buyer@example.com');
    const res = await client.post('/api/billing/checkout', { planId: 'pro' }, EN);
    assert.equal(res.status, 200);
    const session = stripe.calls.checkout.at(-1);
    assert.equal(session.line_items[0].price, 'price_impulsaia_pro_mensual_usd');
    assert.equal(session.locale, 'en');

    const customer = `cus_${stripe.calls.customers.length}`;
    stripe.setSubscription({ id: 'sub_usd', customer, status: 'active', lookupKey: 'impulsaia_pro_mensual_usd', amount: 1200 });
    stripe.subscriptions.retrieve = ((original) => async (id) => {
      const sub = await original(id);
      sub.items.data[0].price.currency = 'usd';
      return sub;
    })(stripe.subscriptions.retrieve);
    await sendWebhook(ctx, stripe, { type: 'customer.subscription.created', data: { object: { id: 'sub_usd' } } });
    const me = await client.get('/api/auth/me', EN);
    assert.equal(me.body.user.plan.id, 'pro');
    assert.equal(me.body.user.subscription.status, 'active');
    assert.equal(user.id, me.body.user.id);

    // Con suscripción activa no se puede cambiar de moneda.
    const change = await client.patch('/api/account', { currency: 'mxn' }, EN);
    assert.equal(change.status, 409);
    assert.match(change.body.error.message, /active subscription/);
  });

  it('permite elegir la moneda al pagar y separa los ingresos por moneda en el panel', async () => {
    const mx = ctx.client();
    await mx.post('/api/auth/register', { name: 'Ana', email: 'ana@ejemplo.mx', password: PASSWORD, acceptTerms: true });
    await mx.post('/api/auth/verify-email', { token: ctx.tokenFor('ana@ejemplo.mx', '/verificar') });
    assert.equal((await mx.get('/api/auth/me')).body.user.currency, 'mxn');
    await mx.post('/api/billing/checkout', { planId: 'negocio', currency: 'usd' });
    assert.equal(stripe.calls.checkout.at(-1).line_items[0].price, 'price_impulsaia_negocio_mensual_usd');
    assert.equal((await mx.get('/api/auth/me')).body.user.currency, 'usd');

    await sendWebhook(ctx, stripe, { type: 'invoice.paid', data: { object: { id: 'in_usd', customer: 'cus_1', amount_paid: 1200, currency: 'usd' } } });
    await sendWebhook(ctx, stripe, { type: 'invoice.paid', data: { object: { id: 'in_mxn', customer: 'cus_1', amount_paid: 19900, currency: 'mxn' } } });
    await ctx.db.query("UPDATE users SET role = 'admin' WHERE email_normalized = 'ana@ejemplo.mx'");
    const stats = await mx.get('/api/admin/stats');
    assert.deepEqual(stats.body.revenue.byCurrency, {
      mxn: { paid30dCents: 19900, paidTotalCents: 19900 },
      usd: { paid30dCents: 1200, paidTotalCents: 1200 },
    });
    assert.equal(stats.body.subscriptions.mrrByCurrency.usd, 1200);
    assert.ok(stats.body.usersByLocale.some((row) => row.locale === 'en'));
  });

  it('cambia idioma y país desde la cuenta; acepta DELETE para borrar en inglés', async () => {
    const { client } = await signUpEn(ctx, 'switch@example.com');
    const res = await client.patch('/api/account', { locale: 'es', country: 'España' });
    assert.equal(res.body.user.locale, 'es');
    assert.equal(res.body.user.country, 'España');
    assert.equal(res.body.user.plan.name, 'Gratis');
    assert.equal((await client.del('/api/account', { password: PASSWORD, confirm: 'DELETE' }, EN)).status, 204);
  });
});
