import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, run, get } from '../packages/database/src/index.ts';
import { syncGumroad, type Fetcher } from '../packages/integrations/src/gumroad.ts';
import { financialSummary } from '../packages/analytics/src/metrics.ts';

function fake(pages: Record<string, unknown>): { fetcher: Fetcher; calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    fetcher: async (url) => {
      const u = new URL(url);
      calls.push(u.pathname + u.search);
      const key = u.pathname + (u.searchParams.get('page_key') ? `#${u.searchParams.get('page_key')}` : '');
      const body = pages[key];
      return { ok: body !== undefined, status: body ? 200 : 500, json: async () => body };
    },
  };
}

function setup() {
  const db = openDatabase(':memory:');
  run(db, "INSERT INTO businesses (id, name, normalized_name, slug, currency, created_at, updated_at) VALUES ('biz', 'Tienda Gumroad', 'tienda gumroad', 'tienda-gumroad', 'USD', 'x', 'x')");
  return db;
}

const PAGES = {
  '/v2/products': { success: true, products: [{ id: 'g1', name: 'Plantilla A', price: 500, currency: 'usd', published: true, short_url: 'https://x/l/a', description: '<p>Hola</p>' }], next_page_url: '/v2/products?page_key=p2' },
  '/v2/products#p2': { success: true, products: [{ id: 'g2', name: 'Plantilla B', price: 900, currency: 'usd', published: false }], next_page_url: null },
  '/v2/sales': { success: true, sales: [
    { id: 's1', product_id: 'g1', price: 500, created_at: '2026-11-20T10:00:00Z', gumroad_fee: 85 },
    { id: 's2', product_id: 'g2', price: 900, created_at: '2026-11-21T10:00:00Z', refunded: true },
  ] },
};

test('Gumroad: importa productos paginados y ventas reales; idempotente', async () => {
  const db = setup();
  const { fetcher } = fake(PAGES);
  const r1 = await syncGumroad(db, { businessId: 'biz', fetcher });
  assert.equal(r1.productsCreated, 2);
  assert.equal(r1.salesImported, 2);
  assert.equal(r1.refundsImported, 1);
  const s = financialSummary(db, { businessId: 'biz' });
  assert.equal(s.grossIncomeCents, 1400);
  assert.equal(s.refundsCents, 900);
  assert.equal(s.feesCents, 85);
  assert.equal(s.netProfitCents, 415);
  const r2 = await syncGumroad(db, { businessId: 'biz', fetcher });
  assert.equal(r2.productsCreated, 0);
  assert.equal(r2.productsUpdated, 2);
  assert.equal(r2.salesImported, 0);
  assert.equal(financialSummary(db, { businessId: 'biz' }).grossIncomeCents, 1400, 'no duplica ventas');
  assert.equal(get<{ status: string }>(db, "SELECT status FROM products WHERE name = 'Plantilla B'")!.status, 'draft');
});

test('Gumroad: si la API falla no se registra nada ni se inventa', async () => {
  const db = setup();
  const { fetcher } = fake({});
  await assert.rejects(syncGumroad(db, { businessId: 'biz', fetcher }), /Gumroad respondió 500/);
  assert.equal(get<{ n: number }>(db, 'SELECT COUNT(*) n FROM products')!.n, 0);
});
