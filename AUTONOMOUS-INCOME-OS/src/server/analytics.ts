import { z } from "zod";
import { sha256 } from "./crypto.ts";
import type { Db, Queryable } from "./db/types.ts";

// Analítica propia sin cookies: el visitante se identifica con un hash diario de
// IP + navegador + sal secreta. No se guarda la IP ni se puede seguir a nadie entre días.

export const EVENT_NAMES = [
  "page_view", "tool_open", "quote_created", "pdf_downloaded", "quote_shared", "pricing_view",
  "checkout_started", "lead_captured", "pro_activated",
] as const;

export const eventSchema = z.object({
  name: z.enum(EVENT_NAMES),
  path: z.string().max(200).regex(/^\/[^\s]*$/).optional(),
  referrer: z.string().max(500).optional(),
  utm_source: z.string().max(60).optional(),
  utm_medium: z.string().max(60).optional(),
  utm_campaign: z.string().max(60).optional(),
  props: z.record(z.string().max(40), z.union([z.string().max(100), z.number(), z.boolean()])).optional(),
});

export function visitorHash(ip: string | null, userAgent: string | null, day = new Date().toISOString().slice(0, 10)): string {
  const salt = process.env.APP_HASH_SALT ?? "dev-salt";
  return sha256(`${salt}:visitor:${day}:${ip ?? ""}:${userAgent ?? ""}`).slice(0, 24);
}

const BOT_UA = /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|whatsapp/i;

export async function trackEvent(
  db: Db,
  businessId: string,
  raw: unknown,
  ctx: { ip: string | null; userAgent: string | null; host: string },
): Promise<boolean> {
  if (!ctx.userAgent || BOT_UA.test(ctx.userAgent)) return false;
  const e = eventSchema.parse(raw);
  let referrerHost: string | null = null;
  if (e.referrer) {
    try {
      const h = new URL(e.referrer).hostname;
      referrerHost = h === ctx.host ? null : h.slice(0, 100);
    } catch {
      referrerHost = null;
    }
  }
  const device = /mobile|iphone|android/i.test(ctx.userAgent) ? "mobile" : "desktop";
  await db.query(
    `INSERT INTO analytics_events (business_id, name, path, referrer_host, utm_source, utm_medium, utm_campaign, visitor_hash, device, props)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [businessId, e.name, e.path ?? null, referrerHost, e.utm_source ?? null, e.utm_medium ?? null, e.utm_campaign ?? null,
     visitorHash(ctx.ip, ctx.userAgent), device, JSON.stringify(e.props ?? {})],
  );
  return true;
}

export interface Funnel {
  visitors: number;
  toolUsers: number;
  quotesCreated: number;
  pdfs: number;
  pricingViews: number;
  checkoutsStarted: number;
  leads: number;
  paidOrders: number;
  visitorToPaidBp: number | null;
  topReferrers: { host: string; visitors: number }[];
  topPages: { path: string; views: number }[];
}

/** Embudo: visitantes únicos-día → uso de la herramienta → precios → pago verificado. */
export async function funnel(q: Queryable, businessId: string, from: Date, to: Date): Promise<Funnel> {
  const params = [businessId, from.toISOString(), to.toISOString()];
  const { rows } = await q.query<{ name: string; visitors: number; events: number }>(
    `SELECT name, count(DISTINCT visitor_hash)::int AS visitors, count(*)::int AS events FROM analytics_events
     WHERE business_id = $1 AND created_at >= $2 AND created_at < $3 GROUP BY name`,
    params,
  );
  const by = (n: string, f: "visitors" | "events" = "visitors") => rows.find((r) => r.name === n)?.[f] ?? 0;
  const all = await q.query<{ n: number }>(
    "SELECT count(DISTINCT visitor_hash)::int AS n FROM analytics_events WHERE business_id = $1 AND created_at >= $2 AND created_at < $3",
    params,
  );
  const paid = await q.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM orders WHERE business_id = $1 AND paid_at >= $2 AND paid_at < $3
       AND live_mode = true AND status IN ('paid','fulfilled','partially_refunded')`,
    params,
  );
  const leads = await q.query<{ n: number }>("SELECT count(*)::int AS n FROM leads WHERE business_id = $1 AND created_at >= $2 AND created_at < $3", params);
  const refs = await q.query<{ host: string; visitors: number }>(
    `SELECT referrer_host AS host, count(DISTINCT visitor_hash)::int AS visitors FROM analytics_events
     WHERE business_id = $1 AND created_at >= $2 AND created_at < $3 AND referrer_host IS NOT NULL
     GROUP BY referrer_host ORDER BY visitors DESC LIMIT 8`,
    params,
  );
  const pages = await q.query<{ path: string; views: number }>(
    `SELECT path, count(*)::int AS views FROM analytics_events
     WHERE business_id = $1 AND created_at >= $2 AND created_at < $3 AND name = 'page_view' AND path IS NOT NULL
     GROUP BY path ORDER BY views DESC LIMIT 8`,
    params,
  );
  const visitors = all.rows[0]?.n ?? 0;
  const paidOrders = paid.rows[0]?.n ?? 0;
  return {
    visitors,
    toolUsers: by("tool_open"),
    quotesCreated: by("quote_created", "events"),
    pdfs: by("pdf_downloaded", "events"),
    pricingViews: by("pricing_view"),
    checkoutsStarted: by("checkout_started", "events"),
    leads: leads.rows[0]?.n ?? 0,
    paidOrders,
    visitorToPaidBp: visitors > 0 ? Math.round((paidOrders * 10_000) / visitors) : null,
    topReferrers: refs.rows,
    topPages: pages.rows,
  };
}
