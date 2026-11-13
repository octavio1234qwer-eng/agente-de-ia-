// Uso: npm run stripe:setup
// Crea (o reutiliza) en tu cuenta de Stripe los productos y precios mensuales en MXN
// de cada plan de pago, identificados por lookup_key. Úsalo primero en modo de prueba (sk_test_...).
import Stripe from 'stripe';
import { loadConfig, loadEnvFile } from '../src/config.js';
import { buildPlans } from '../src/plans.js';

loadEnvFile();
const config = loadConfig();
if (!config.stripe.secretKey) {
  console.error('Define STRIPE_SECRET_KEY en .env antes de ejecutar este script.');
  process.exit(1);
}
const stripe = new Stripe(config.stripe.secretKey);
const mode = config.stripe.secretKey.startsWith('sk_live') ? 'PRODUCCIÓN' : 'prueba';
console.log(`Cuenta de Stripe en modo ${mode}.`);

for (const plan of buildPlans(config.plans).paid) {
  const amount = plan.priceMxn * 100;
  const existing = await stripe.prices.list({ lookup_keys: [plan.stripeLookupKey], active: true, expand: ['data.product'], limit: 1 });
  const current = existing.data[0];
  if (current && current.unit_amount === amount && current.currency === 'mxn') {
    console.log(`✔ ${plan.name}: ya existe ${current.id} ($${plan.priceMxn} MXN/mes)`);
    continue;
  }
  const productId = typeof current?.product === 'object' ? current.product.id : current?.product;
  const product = productId
    ? await stripe.products.retrieve(productId)
    : await stripe.products.create({ name: `${config.appName} ${plan.name}`, metadata: { plan_id: plan.id } });
  // Si cambió el precio se crea uno nuevo y se le transfiere el lookup_key; las suscripciones existentes conservan el anterior.
  const price = await stripe.prices.create({
    product: product.id,
    currency: 'mxn',
    unit_amount: amount,
    recurring: { interval: 'month' },
    lookup_key: plan.stripeLookupKey,
    transfer_lookup_key: true,
    tax_behavior: 'inclusive',
    metadata: { plan_id: plan.id },
  });
  console.log(`✚ ${plan.name}: creado ${price.id} ($${plan.priceMxn} MXN/mes, IVA incluido)`);
}
console.log('\nSiguiente paso: crea el webhook en Stripe apuntando a <APP_URL>/api/webhooks/stripe (ver docs/DESPLIEGUE.md).');
