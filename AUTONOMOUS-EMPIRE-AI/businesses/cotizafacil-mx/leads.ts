/** Captación de leads de CotizaFácil MX: validación, consentimiento, anti-abuso y registro. */
import { z } from "zod";
import type { Db } from "../../core/db";
import { appendAudit } from "../../core/audit-log";
import { publish } from "../../core/event-bus";
import { scoreLead } from "./scoring";

export const PRIVACY_VERSION = "2026-11-27";
export const UNIT_ID = "cotizafacil-mx";

export const LeadInput = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().pipe(z.email({ error: "Correo inválido" })).pipe(z.string().max(200)),
  phone: z.string().trim().regex(/^[+\d][\d\s-]{7,19}$/, { error: "Teléfono inválido" }).optional().or(z.literal("").transform(() => undefined)),
  company: z.string().trim().max(120).optional(),
  trade: z.string().trim().max(80).optional(),
  quotesPerMonth: z.coerce.number().int().min(0).max(10000).optional(),
  willingnessToPayMxn: z.coerce.number().min(0).max(100000).optional(),
  need: z.string().trim().max(2000).default(""),
  consentContact: z.literal(true, { error: "Se requiere aceptar el aviso de privacidad" }),
  consentMarketing: z.boolean().default(false),
  website: z.string().max(0).optional(), // honeypot: debe ir vacío
  utm: z.record(z.string(), z.string().max(100)).optional(),
});
export type LeadInput = z.input<typeof LeadInput>;

export async function rateLimit(db: Db, key: string, limit: number, windowSec: number): Promise<boolean> {
  const r = await db.query<{ count: number }>(
    `insert into rate_limits(key, count, window_start) values ($1, 1, now())
     on conflict (key) do update set
       count = case when rate_limits.window_start < now() - ($2 || ' seconds')::interval then 1 else rate_limits.count + 1 end,
       window_start = case when rate_limits.window_start < now() - ($2 || ' seconds')::interval then now() else rate_limits.window_start end
     returning count`,
    [key, String(windowSec)],
  );
  return Number(r.rows[0]!.count) <= limit;
}

export type CaptureResult = { ok: true; leadId: string; duplicate: boolean } | { ok: false; error: string; status: number };

export async function captureLead(db: Db, raw: unknown, meta: { visitorHash?: string } = {}): Promise<CaptureResult> {
  const parsed = LeadInput.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 400, error: parsed.error.issues.map((i) => i.message).join("; ") };
  const v = parsed.data;
  if (v.website) return { ok: false, status: 400, error: "Solicitud inválida" };
  if (meta.visitorHash && !(await rateLimit(db, `lead:${meta.visitorHash}`, 5, 3600)))
    return { ok: false, status: 429, error: "Demasiadas solicitudes. Intenta más tarde." };

  const wtp = v.willingnessToPayMxn == null ? null : Math.round(v.willingnessToPayMxn * 100);
  const score = scoreLead({ quotesPerMonth: v.quotesPerMonth ?? null, willingnessToPayCents: wtp, need: v.need, hasPhone: !!v.phone, hasCompany: !!v.company, trade: v.trade ?? null });

  return db.transaction(async (tx) => {
    const existing = await tx.query<{ id: string }>("select id from leads where business_unit_id=$1 and lower(email)=$2", [UNIT_ID, v.email]);
    if (existing.rows[0]) {
      await tx.query("insert into lead_activities(lead_id, type, detail, actor) values ($1,'resubmitted',$2,'public')", [existing.rows[0].id, v.need.slice(0, 500)]);
      return { ok: true as const, leadId: existing.rows[0].id, duplicate: true };
    }
    const r = await tx.query<{ id: string }>(
      `insert into leads(business_unit_id, name, email, phone, company, trade, quotes_per_month, willingness_to_pay_cents, need,
         source, utm, score, consent_contact, consent_marketing, privacy_version)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'web',$10,$11,true,$12,$13) returning id`,
      [UNIT_ID, v.name, v.email, v.phone ?? null, v.company ?? null, v.trade ?? null, v.quotesPerMonth ?? null, wtp, v.need,
        JSON.stringify(v.utm ?? {}), score, v.consentMarketing, PRIVACY_VERSION],
    );
    const id = r.rows[0]!.id;
    await tx.query("insert into lead_activities(lead_id, type, detail, actor) values ($1,'created','Formulario web','public')", [id]);
    // Auditoría sin datos personales.
    await appendAudit(tx, { actor: "public", action: "lead.capture", level: "green", target: id, result: "created", detail: { unit: UNIT_ID, score } });
    await publish(tx, "lead.created", "cotizafacil-mx", { leadId: id, score });
    return { ok: true as const, leadId: id, duplicate: false };
  });
}

export const LEAD_STATUSES = ["new", "contacted", "qualified", "proposal", "won", "lost"] as const;
