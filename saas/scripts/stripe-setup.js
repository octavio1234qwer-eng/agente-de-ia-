// Uso: npm run stripe:setup
// Crea (o reutiliza) en tu cuenta de Stripe los productos y precios mensuales
// de cada plan de pago en pesos (MXN) y dólares (USD), identificados por lookup_key.
// Úsalo primero en modo de prueba (sk_test_...).
import Stripe from 'stripe';
import { loadConfig, loadEnvFile } from '../src/config.js';
import { CURRENCIES, buildPlans } from '../src/plans.js';

loadEnvFile();
const config = loadConfig();
if (!config.stripe.secretKey) {
  console.error('Define STRIPE_SECRET_KEY en .env antes de ejecutar este script.');
  process.exit(1);
}
const stripe = new Stripe(config.stripe.secretKey);
const mode = config.stripe.secretKey.startsWith('sk_live') ? 'PRODUCCIÓN' : 'prueba';
console.log(`Cuenta de Stripe en modo ${mode}.`);

// Pesos con IVA incluido (costumbre en México); dólares sin impuestos incluidos (Stripe Tax los agrega si lo activas).
const TAX_BEHAVIOR = { mxn: 'inclusive', usd: 'exclusive' };
const LABELS = { pro: 'Pro', negocio: 'Business' };

for (const plan of buildPlans(config.plans).paid) {
  let productId;
  for (const currency of CURRENCIES) {
    const amount = plan.prices[currency] * 100;
    const lookupKey = plan.stripeLookupKeys[currency];
    const existing = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
    const current = existing.data[0];
    if (current && current.unit_amount === amount && current.currency === currency) {
      console.log(`✔ ${LABELS[plan.id]} ${currency.toUpperCase()}: ya existe ${current.id} (${plan.prices[currency]} ${currency.toUpperCase()}/mes)`);
      productId ??= typeof current.product === 'string' ? current.product : current.product.id;
      continue;
    }
    if (!productId && current) productId = typeof current.product === 'string' ? current.product : current.product.id;
    if (!productId) {
      const found = await stripe.products.search({ query: `metadata['plan_id']:'${plan.id}'` }).catch(() => ({ data: [] }));
      productId = found.data[0]?.id
        ?? (await stripe.products.create({ name: `${config.appName} ${LABELS[plan.id]}`, metadata: { plan_id: plan.id } })).id;
    }
    // Si cambió el monto se crea un precio nuevo y se le transfiere el lookup_key; las suscripciones existentes conservan el anterior.
    const price = await stripe.prices.create({
      product: productId,
      currency,
      unit_amount: amount,
      recurring: { interval: 'month' },
      lookup_key: lookupKey,
      transfer_lookup_key: true,
      tax_behavior: TAX_BEHAVIOR[currency],
      metadata: { plan_id: plan.id },
    });
    console.log(`✚ ${LABELS[plan.id]} ${currency.toUpperCase()}: creado ${price.id} (${plan.prices[currency]} ${currency.toUpperCase()}/mes)`);
  }
}
console.log('\nSiguiente paso: crea el webhook en Stripe apuntando a <APP_URL>/api/webhooks/stripe (ver docs/DESPLIEGUE.md).');
