/**
 * Sincronización de SOLO LECTURA desde Gumroad (api.gumroad.com/v2).
 * - Importa productos al Product Studio del negocio (sin tocar nada en Gumroad).
 * - Importa ventas como transacciones confirmadas (Gumroad ya cobró), con su reembolso si aplica.
 * - Idempotente: productos por (business_id, gumroad id en files/meta), ventas por (provider, provider_ref).
 * Credenciales: GUMROAD_ACCESS_TOKEN en el servidor, o un proxy que las inyecte (sin token).
 * Ninguna cifra se inventa: si la API falla, la sincronización falla y se reporta.
 */
import { randomUUID } from 'node:crypto';
import { get, run, transaction, audit, type DB } from '../../database/src/index.ts';

export type Fetcher = (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

interface GProduct { id: string; name: string; price: number; currency: string; published: boolean; short_url?: string; description?: string; deleted?: boolean }
interface GSale { id: string; product_id: string; price: number; currency_symbol?: string; created_at: string; refunded?: boolean; partially_refunded?: boolean; amount_refundable_in_currency?: string; gumroad_fee?: number; email?: string; referrer?: string }

const BASE = 'https://api.gumroad.com';

async function fetchPaged<T>(fetcher: Fetcher, path: string, key: 'products' | 'sales', token?: string, maxPages = 50): Promise<T[]> {
  const out: T[] = [];
  let next: string | null = path;
  for (let page = 0; next && page < maxPages; page++) {
    const url = new URL(next, BASE);
    if (token) url.searchParams.set('access_token', token);
    const res = await fetcher(url.toString());
    if (!res.ok) throw new Error(`Gumroad respondió ${res.status} en ${url.pathname}`);
    const data = (await res.json()) as Record<string, unknown>;
    if (data.success !== true) throw new Error(`Gumroad devolvió success=false en ${url.pathname}`);
    out.push(...((data[key] as T[]) ?? []));
    next = typeof data.next_page_url === 'string' && data.next_page_url ? data.next_page_url : null;
  }
  return out;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

export interface GumroadSyncResult {
  productsSeen: number;
  productsCreated: number;
  productsUpdated: number;
  salesSeen: number;
  salesImported: number;
  refundsImported: number;
  revenueCentsImported: number;
  currency: string;
}

export async function syncGumroad(db: DB, opts: { businessId: string; fetcher?: Fetcher; token?: string; actor?: string; since?: string }): Promise<GumroadSyncResult> {
  const fetcher: Fetcher = opts.fetcher ?? ((u) => fetch(u));
  const biz = get<{ id: string; currency: string }>(db, 'SELECT id, currency FROM businesses WHERE id = ?', opts.businessId);
  if (!biz) throw new Error('negocio no encontrado');

  const products = await fetchPaged<GProduct>(fetcher, '/v2/products', 'products', opts.token);
  const salesPath = `/v2/sales${opts.since ? `?after=${encodeURIComponent(opts.since)}` : ''}`;
  const sales = await fetchPaged<GSale>(fetcher, salesPath, 'sales', opts.token);

  const result: GumroadSyncResult = { productsSeen: products.length, productsCreated: 0, productsUpdated: 0, salesSeen: sales.length, salesImported: 0, refundsImported: 0, revenueCentsImported: 0, currency: 'USD' };
  const now = new Date().toISOString();

  transaction(db, () => {
    const localIds = new Map<string, string>();
    for (const p of products) {
      if (p.deleted) continue;
      const marker = JSON.stringify([{ provider: 'gumroad', id: p.id, url: p.short_url ?? null }]);
      const existing = get<{ id: string }>(db, "SELECT id FROM products WHERE business_id = ? AND files LIKE ?", biz.id, `%"provider":"gumroad","id":${JSON.stringify(p.id)}%`);
      const status = p.published ? 'published' : 'draft';
      const currency = (p.currency || 'usd').toUpperCase();
      if (existing) {
        run(db, 'UPDATE products SET name = ?, price_cents = ?, currency = ?, status = ?, updated_at = ? WHERE id = ?', p.name, p.price, currency, status, now, existing.id);
        localIds.set(p.id, existing.id);
        result.productsUpdated++;
      } else {
        const id = `prd_${randomUUID().replace(/-/g, '')}`;
        run(db, `INSERT INTO products (id, business_id, name, kind, description, price_cents, cost_cents, currency, status, files, qa_report, created_at, updated_at)
          VALUES (?, ?, ?, 'download', ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
          id, biz.id, p.name, stripHtml(p.description ?? '').slice(0, 5000), p.price, currency, status, marker,
          JSON.stringify({ passed: p.published, issues: [], warnings: ['Importado de Gumroad: QA realizado en origen'], checkedAt: now }), now, now);
        localIds.set(p.id, id);
        result.productsCreated++;
      }
    }

    for (const s of sales) {
      const productId = localIds.get(s.product_id) ?? null;
      const ins = run(db, `INSERT OR IGNORE INTO transactions (id, business_id, kind, amount_cents, currency, category, description, status, source, provider, provider_ref, product_id, channel, occurred_at, created_at)
        VALUES (?, ?, 'income', ?, 'USD', 'venta', 'Venta Gumroad', 'confirmed', 'payment_provider', 'gumroad', ?, ?, ?, ?, ?)`,
        `txn_${randomUUID().replace(/-/g, '')}`, biz.id, s.price, s.id, productId, (s.referrer || 'direct').slice(0, 40), new Date(s.created_at).toISOString(), now);
      if (ins.changes) { result.salesImported++; result.revenueCentsImported += s.price; }
      if (s.gumroad_fee && s.gumroad_fee > 0) {
        run(db, `INSERT OR IGNORE INTO transactions (id, business_id, kind, amount_cents, currency, category, description, status, source, provider, provider_ref, product_id, occurred_at, created_at)
          VALUES (?, ?, 'fee', ?, 'USD', 'comision', 'Comisión Gumroad', 'confirmed', 'payment_provider', 'gumroad', ?, ?, ?, ?)`,
          `txn_${randomUUID().replace(/-/g, '')}`, biz.id, s.gumroad_fee, `${s.id}:fee`, productId, new Date(s.created_at).toISOString(), now);
      }
      if (s.refunded) {
        const r = run(db, `INSERT OR IGNORE INTO transactions (id, business_id, kind, amount_cents, currency, category, description, status, source, provider, provider_ref, product_id, occurred_at, created_at)
          VALUES (?, ?, 'refund', ?, 'USD', 'reembolso', 'Reembolso Gumroad', 'confirmed', 'payment_provider', 'gumroad', ?, ?, ?, ?)`,
          `txn_${randomUUID().replace(/-/g, '')}`, biz.id, s.price, `${s.id}:refund`, productId, now, now);
        if (r.changes) result.refundsImported++;
      }
    }
    audit(db, { actor: opts.actor ?? 'system', action: 'integration.gumroad_sync', entity: 'business', entityId: biz.id, businessId: biz.id, details: result });
  });
  return result;
}
