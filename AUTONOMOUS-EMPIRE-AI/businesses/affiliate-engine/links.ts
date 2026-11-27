/**
 * Motor de afiliados. Los enlaces se generan en el panel oficial del Programa de Afiliados de Mercado Libre
 * y se registran aquí; el sistema los redirige por /go/<slug> y mide los clics.
 * Las comisiones solo se registran desde el reporte oficial (CSV) y como ESTIMADAS hasta el pago.
 */
import { z } from "zod";
import type { Db, Queryable } from "../../core/db";
import { appendAudit } from "../../core/audit-log";
import { authorize, type Actor } from "../../core/permissions";
import { recordEstimate } from "../../finance/ledger";

export const UNIT_ID = "affiliate-engine";
const ALLOWED_HOSTS = [/(^|\.)mercadolibre\.com\.mx$/, /(^|\.)mercadolibre\.com$/, /^meli\.la$/, /(^|\.)mercadolivre\.com\.br$/];

export const LinkInput = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,64}$/, { error: "slug: 3–64 caracteres a-z, 0-9 o guiones" }),
  title: z.string().trim().min(3).max(160),
  destinationUrl: z.url({ protocol: /^https$/, error: "URL https requerida" }),
  commissionRateBps: z.number().int().min(0).max(10000).nullable().default(null),
});

export function isAllowedDestination(url: string, program = "mercadolibre") {
  const host = new URL(url).hostname.toLowerCase();
  return program !== "mercadolibre" || ALLOWED_HOSTS.some((re) => re.test(host));
}

export async function createLink(db: Db, actor: Actor, raw: unknown) {
  const v = LinkInput.parse(raw);
  if (!isAllowedDestination(v.destinationUrl)) throw new Error("El destino debe ser un dominio oficial de Mercado Libre");
  return db.transaction(async (tx) => {
    const d = await authorize(tx, actor, "affiliate.link.manage", { target: v.slug });
    if (!d.allowed) throw new Error(d.reason);
    const r = await tx.query<{ id: string }>(
      `insert into affiliate_links(slug, title, destination_url, commission_rate_bps, created_by) values ($1,$2,$3,$4,$5) returning id`,
      [v.slug, v.title, v.destinationUrl, v.commissionRateBps, actor.id]);
    await appendAudit(tx, { actor: actor.id, action: "affiliate.link.create", level: "yellow", target: r.rows[0]!.id, result: "created", detail: { slug: v.slug } });
    return r.rows[0]!.id;
  });
}

/** Resuelve un slug activo y registra el clic. Devuelve null si no existe o está pausado/roto. */
export async function resolveAndRecordClick(q: Queryable, slug: string, meta: { referrer?: string | null; visitorHash?: string }) {
  if (!/^[a-z0-9-]{3,64}$/.test(slug)) return null;
  const r = await q.query<{ id: string; destination_url: string }>("select id, destination_url from affiliate_links where slug=$1 and status='active'", [slug]);
  const l = r.rows[0];
  if (!l) return null;
  await q.query("insert into affiliate_clicks(link_id, referrer, visitor_hash) values ($1,$2,$3)", [l.id, meta.referrer?.slice(0, 300) ?? null, meta.visitorHash ?? null]);
  return l.destination_url;
}

/**
 * Importa el reporte de comisiones exportado del panel de afiliados.
 * Columnas esperadas (encabezado): order_id,date,commission_mxn,status
 * status "paid"/"pagada" ⇒ sigue como estimada hasta conciliar el depósito (ver FINANCIAL_RULES.md §4).
 */
export async function importCommissionsCsv(db: Db, csv: string, actor: string) {
  const [header, ...lines] = csv.trim().split(/\r?\n/);
  const cols = header!.split(",").map((c) => c.trim().toLowerCase());
  const idx = (n: string) => { const i = cols.indexOf(n); if (i < 0) throw new Error(`Falta la columna ${n}`); return i; };
  const [iId, iDate, iAmt, iSt] = [idx("order_id"), idx("date"), idx("commission_mxn"), idx("status")];
  let imported = 0;
  for (const line of lines) {
    const c = line.split(",").map((x) => x.trim());
    const amount = Math.round(Number(c[iAmt]) * 100);
    if (!c[iId] || !Number.isFinite(amount) || amount <= 0) continue;
    if (/cancel|rechaz/i.test(c[iSt] ?? "")) continue;
    await recordEstimate(db, { kind: "commission", source: "mercadolibre-affiliates", externalId: c[iId], amountCents: amount, currency: "MXN", businessUnitId: UNIT_ID, occurredAt: new Date(c[iDate]!), description: `Comisión ML (${c[iSt]})`, actor });
    imported++;
  }
  return { imported };
}
