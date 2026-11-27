import pricing from "@root/businesses/cotizafacil-mx/pricing/pricing.json";
import schedules from "@root/automation/schedules/schedules.json";
import { knownAgents } from "./security/permissions.ts";
import type { Db } from "./db/types.ts";

interface ProductSeed {
  slug: string;
  name: string;
  kind: "free_tool" | "one_time" | "subscription" | "digital_download";
  price_cents: number;
  currency: string;
  billing_interval?: "month" | "year";
  feature?: string;
  initial_status: "draft" | "published";
  description: string;
}

/**
 * Datos iniciales idempotentes: negocio, catálogo, automatizaciones y controles de agentes.
 * Nunca sobrescribe precios ni estados existentes (eso pasa por aprobación).
 */
export async function bootstrap(db: Db): Promise<void> {
  await db.tx(async (q) => {
    const b = await q.query<{ id: string }>(
      `INSERT INTO businesses (slug, name, description, status) VALUES ($1, $2, $3, 'validating')
       ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug RETURNING id`,
      [pricing.business.slug, pricing.business.name, pricing.business.description],
    );
    const businessId = b.rows[0]!.id;

    for (const p of pricing.products as ProductSeed[]) {
      const exists = await q.query("SELECT 1 FROM products WHERE business_id = $1 AND slug = $2", [businessId, p.slug]);
      if (exists.rows.length) continue;
      const isFree = p.kind === "free_tool";
      const ins = await q.query<{ id: string }>(
        `INSERT INTO products (business_id, slug, name, kind, status, price_cents, currency, billing_interval, feature, description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [businessId, p.slug, p.name, p.kind, isFree ? "published" : "draft", p.price_cents, p.currency,
         p.billing_interval ?? null, p.feature ?? null, p.description],
      );
      const productId = ins.rows[0]!.id;
      const v = await q.query<{ id: string }>(
        `INSERT INTO product_versions (product_id, version, changelog, qa_status) VALUES ($1, 1, 'Versión inicial', $2) RETURNING id`,
        [productId, isFree ? "passed" : "pending"],
      );
      await q.query("UPDATE products SET current_version_id = $1 WHERE id = $2", [v.rows[0]!.id, productId]);
    }

    for (const s of schedules.schedules) {
      await q.query(
        `INSERT INTO automations (key, name, task_type, agent, interval_minutes) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, task_type = EXCLUDED.task_type,
           agent = EXCLUDED.agent, interval_minutes = EXCLUDED.interval_minutes`,
        [s.key, s.name, s.task_type, s.agent, s.interval_minutes],
      );
    }

    for (const agent of knownAgents()) {
      await q.query("INSERT INTO agent_controls (agent) VALUES ($1) ON CONFLICT DO NOTHING", [agent]);
    }

    await q.query(
      `INSERT INTO system_settings (key, value, updated_by) VALUES ('kill_switch', $1, 'system') ON CONFLICT DO NOTHING`,
      [JSON.stringify({ active: false, reason: null, at: null, by: null })],
    );
  });
}

export async function businessIdBySlug(db: Pick<Db, "query">, slug = pricing.business.slug): Promise<string> {
  const { rows } = await db.query<{ id: string }>("SELECT id FROM businesses WHERE slug = $1", [slug]);
  if (!rows[0]) throw new Error(`Negocio no encontrado: ${slug}`);
  return rows[0].id;
}
