import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { fakeStripe, sendWebhook, setup, signUp } from './helpers.js';

describe('suscripciones con Stripe', () => {
  let ctx;
  let stripe;
  let client;
  let user;
  before(async () => {
    stripe = fakeStripe();
    ctx = await setup({ stripe });
    ({ client, user } = await signUp(ctx, { email: 'cliente@ejemplo.mx' }));
  });
  after(() => ctx.close());

  it('crea el cliente y la sesión de Checkout en MXN con el precio del plan', async () => {
    const res = await client.post('/api/billing/checkout', { planId: 'pro' });
    assert.equal(res.status, 200);
    assert.match(res.body.url, /^https:\/\/checkout\.stripe\.com\//);
    assert.equal(stripe.calls.customers.length, 1);
    const session = stripe.calls.checkout[0];
    assert.equal(session.mode, 'subscription');
    assert.equal(session.customer, 'cus_1');
    assert.equal(session.client_reference_id, user.id);
    assert.equal(session.line_items[0].price, 'price_impulsaia_pro_mensual');
    assert.equal(session.subscription_data.metadata.plan_id, 'pro');
    assert.equal((await client.post('/api/billing/checkout', { planId: 'free' })).status, 400);
    await client.post('/api/billing/checkout', { planId: 'negocio' });
    assert.equal(stripe.calls.customers.length, 1, 'reutiliza el cliente de Stripe');
  });

  it('rechaza webhooks sin firma válida', async () => {
    const res = await sendWebhook(ctx, stripe, { type: 'customer.subscription.updated', data: { object: { id: 'sub_1' } } }, { secret: 'whsec_otro' });
    assert.equal(res.status, 400);
    const unsigned = await fetch(`${ctx.base}/api/webhooks/stripe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(unsigned.status, 400);
  });

  it('activa el plan Pro al confirmarse la suscripción y desbloquea herramientas', async () => {
    stripe.setSubscription({ id: 'sub_1', customer: 'cus_1', status: 'active' });
    const res = await sendWebhook(ctx, stripe, { type: 'checkout.session.completed', data: { object: { mode: 'subscription', subscription: 'sub_1', customer: 'cus_1', client_reference_id: user.id } } });
    assert.equal(res.status, 200);
    const me = await client.get('/api/auth/me');
    assert.equal(me.body.user.plan.id, 'pro');
    assert.equal(me.body.user.plan.monthlyCredits, 500);
    assert.equal(me.body.user.subscription.status, 'active');
    const run = await client.post('/api/tools/cobranza/run', { input: { cliente: 'Roberto', concepto: 'Factura A-1', monto: '$1,000', vencimiento: '1 de noviembre', etapa: 'Primer aviso (1 a 15 días de atraso)', canal: 'WhatsApp' } });
    assert.equal(run.status, 201);
    assert.equal((await client.post('/api/billing/checkout', { planId: 'negocio' })).status, 409);
  });

  it('procesa cada evento una sola vez', async () => {
    const first = await sendWebhook(ctx, stripe, { type: 'customer.subscription.updated', data: { object: { id: 'sub_1' } } });
    const payload = JSON.parse(first.payload);
    const replay = await fetch(`${ctx.base}/api/webhooks/stripe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': stripe.webhooks.generateTestHeaderString({ payload: first.payload, secret: 'whsec_test_secret' }) },
      body: first.payload,
    });
    assert.equal((await replay.json()).duplicate, true);
    const { rows } = await ctx.db.query('SELECT COUNT(*)::int AS n FROM billing_events WHERE id = $1', [payload.id]);
    assert.equal(rows[0].n, 1);
  });

  it('registra pagos y avisa por correo si un cobro falla', async () => {
    await sendWebhook(ctx, stripe, { type: 'invoice.paid', data: { object: { id: 'in_1', customer: 'cus_1', amount_paid: 19900, currency: 'mxn', status_transitions: { paid_at: Math.floor(Date.now() / 1000) } } } });
    await sendWebhook(ctx, stripe, { type: 'invoice.paid', data: { object: { id: 'in_1', customer: 'cus_1', amount_paid: 19900, currency: 'mxn' } } });
    const { rows } = await ctx.db.query('SELECT amount_cents, user_id FROM payments');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].amount_cents, 19900);
    assert.equal(rows[0].user_id, user.id);

    const before = ctx.mails.length;
    await sendWebhook(ctx, stripe, { type: 'invoice.payment_failed', data: { object: { id: 'in_2', customer: 'cus_1' } } });
    assert.equal(ctx.mails.length, before + 1);
    assert.match(ctx.mails.at(-1).subject, /No pudimos cobrar/);
  });

  it('mantiene el plan con pago pendiente y regresa a Gratis al cancelarse', async () => {
    stripe.setSubscription({ id: 'sub_1', customer: 'cus_1', status: 'past_due' });
    await sendWebhook(ctx, stripe, { type: 'customer.subscription.updated', data: { object: { id: 'sub_1' } } });
    assert.equal((await client.get('/api/auth/me')).body.user.plan.id, 'pro');

    stripe.setSubscription({ id: 'sub_1', customer: 'cus_1', status: 'canceled' });
    await sendWebhook(ctx, stripe, { type: 'customer.subscription.deleted', data: { object: { id: 'sub_1' } } });
    const me = await client.get('/api/auth/me');
    assert.equal(me.body.user.plan.id, 'free');
    assert.equal(me.body.user.subscription, null);
  });

  it('abre el portal de cliente de Stripe', async () => {
    const res = await client.post('/api/billing/portal');
    assert.equal(res.status, 200);
    assert.equal(stripe.calls.portal[0].customer, 'cus_1');
    const { client: nuevo } = await signUp(ctx, { email: 'sinstripe@ejemplo.mx' });
    assert.equal((await nuevo.post('/api/billing/portal')).status, 400);
  });

  it('cancela la suscripción en Stripe al eliminar la cuenta', async () => {
    stripe.setSubscription({ id: 'sub_2', customer: 'cus_1', status: 'active', lookupKey: 'impulsaia_negocio_mensual', amount: 49900 });
    await sendWebhook(ctx, stripe, { type: 'customer.subscription.created', data: { object: { id: 'sub_2' } } });
    assert.equal((await client.get('/api/auth/me')).body.user.plan.id, 'negocio');
    const res = await client.del('/api/account', { password: 'una frase bastante segura', confirm: 'ELIMINAR' });
    assert.equal(res.status, 204);
    assert.deepEqual(stripe.calls.canceled, ['sub_2']);
    const { rows } = await ctx.db.query('SELECT COUNT(*)::int AS n FROM users WHERE id = $1', [user.id]);
    assert.equal(rows[0].n, 0);
    const payments = await ctx.db.query('SELECT user_id FROM payments');
    assert.equal(payments.rows[0].user_id, null, 'el pago se conserva para contabilidad, sin datos personales');
  });
});

describe('sin Stripe configurado', () => {
  let ctx;
  before(async () => { ctx = await setup(); });
  after(() => ctx.close());

  it('deshabilita los pagos con un mensaje claro', async () => {
    const plans = await ctx.client().get('/api/plans');
    assert.equal(plans.body.billingEnabled, false);
    const { client } = await signUp(ctx, { email: 'nopago@ejemplo.mx' });
    const res = await client.post('/api/billing/checkout', { planId: 'pro' });
    assert.equal(res.status, 503);
    assert.equal(res.body.error.code, 'billing_disabled');
  });
});
