/** Concilia las ventas de Gumroad con el libro (ingreso real verificado vía API oficial). Idempotente. */
import type { Db } from "../../core/db";
import { recordVerifiedIncome } from "../../finance/ledger";
import { fetchSales, fetchProducts, type GumroadSale } from "../../infrastructure/integrations/gumroad";

export const UNIT_ID = "digital-products";

export async function syncGumroad(db: Db, opts: { fetchFn?: typeof fetch } = {}) {
  const productList = await fetchProducts({ fetchFn: opts.fetchFn });
  const currencyOf = new Map(productList.map((p) => [p.id, (p.currency ?? "usd").toUpperCase()]));
  const sales: GumroadSale[] = await fetchSales({ fetchFn: opts.fetchFn });
  let inserted = 0, skipped = 0;
  for (const s of sales) {
    if (s.refunded || s.chargedback || s.disputed || !s.price) { skipped++; continue; }
    const currency = (s.currency ?? currencyOf.get(s.product_id) ?? "usd").toUpperCase();
    const r = await db.transaction((tx) => recordVerifiedIncome(tx, {
      source: "gumroad", externalId: s.id, amountCents: s.price, currency, businessUnitId: UNIT_ID,
      occurredAt: new Date(s.created_at), description: `Venta Gumroad: ${s.product_name}`, actor: "system:gumroad-sync",
      feeCents: s.gumroad_fee ?? 0,
    }));
    if (r.inserted) inserted++; else skipped++;
  }
  let products = 0;
  {
    for (const p of productList) {
      await db.query(
        `insert into products(business_unit_id, name, kind, price_cents, currency, status, source, external_id, url)
         values ($1,$2,'digital',$3,$4,$5,'gumroad',$6,$7)
         on conflict (source, external_id) do update set name=excluded.name, price_cents=excluded.price_cents, status=excluded.status, url=excluded.url`,
        [UNIT_ID, p.name, p.price, (p.currency ?? "usd").toUpperCase(), p.published ? "published" : "draft", p.id, p.short_url]);
      products++;
    }
  }
  return { fetched: sales.length, inserted, skipped, products };
}
