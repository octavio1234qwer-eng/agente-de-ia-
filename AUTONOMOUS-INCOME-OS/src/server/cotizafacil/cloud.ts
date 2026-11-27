import { z } from "zod";
import { audit } from "../audit.ts";
import { randomToken } from "../crypto.ts";
import type { Db } from "../db/types.ts";
import { appUrl } from "../env.ts";
import { findActiveLicense, type LicenseInfo } from "../licenses.ts";
import { enforceRateLimit } from "../security/rate-limit.ts";
import { calculateQuote } from "@/lib/quote/engine";
import { sharedSnapshotSchema, type SharedSnapshot } from "@/lib/quote/document";

export class LicenseError extends Error {
  constructor(message = "Licencia inválida o vencida.", public status = 401) {
    super(message);
    this.name = "LicenseError";
  }
}

/** Funciones Nube: exige una licencia activa con el permiso indicado. */
export async function requireFeature(db: Db, licenseKey: string | null, feature: "cotizafacil_pro" | "cotizafacil_nube"): Promise<LicenseInfo> {
  if (!licenseKey) throw new LicenseError("Falta la clave de licencia.");
  const lic = await findActiveLicense(db, licenseKey);
  if (!lic) throw new LicenseError();
  if (!lic.features.includes(feature)) throw new LicenseError("Tu plan no incluye esta función.", 403);
  return lic;
}

// ───── Cotizaciones compartidas con aceptación en línea ─────
export const SHARE_DAYS = 60;

export async function shareQuote(db: Db, lic: LicenseInfo, raw: unknown): Promise<{ url: string; publicId: string }> {
  await enforceRateLimit(db, `share:${lic.entitlementId}`, 60, 3600);
  const snapshot = sharedSnapshotSchema.parse(raw);
  const publicId = randomToken(18);
  await db.query(
    `INSERT INTO shared_quotes (entitlement_id, public_id, folio, snapshot, expires_at) VALUES ($1,$2,$3,$4, now() + make_interval(days => $5::int))`,
    [lic.entitlementId, publicId, snapshot.quote.folio, JSON.stringify(snapshot), SHARE_DAYS],
  );
  return { url: `${appUrl()}/c/${publicId}`, publicId };
}

export interface PublicQuote {
  snapshot: SharedSnapshot;
  totals: ReturnType<typeof calculateQuote>;
  status: string;
  decidedAt: string | null;
  decisionName: string | null;
  expired: boolean;
}

/** Vista pública. Los totales se recalculan en el servidor a partir de los conceptos. */
export async function viewSharedQuote(db: Db, publicId: string, countView: boolean): Promise<PublicQuote | null> {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(publicId)) return null;
  const { rows } = await db.query<{ id: string; snapshot: SharedSnapshot; status: string; decided_at: Date | null; decision_name: string | null; expires_at: Date }>(
    "SELECT id, snapshot, status, decided_at, decision_name, expires_at FROM shared_quotes WHERE public_id = $1",
    [publicId],
  );
  const r = rows[0];
  if (!r || r.status === "withdrawn") return null;
  if (countView) {
    await db.query(
      `UPDATE shared_quotes SET view_count = view_count + 1, first_viewed_at = COALESCE(first_viewed_at, now()),
         status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END WHERE id = $1`,
      [r.id],
    );
  }
  const snap = sharedSnapshotSchema.parse(r.snapshot);
  return {
    snapshot: snap,
    totals: calculateQuote(snap.quote.lines, snap.quote.tax, snap.quote.discount),
    status: countView && r.status === "sent" ? "viewed" : r.status,
    decidedAt: r.decided_at ? new Date(r.decided_at).toISOString() : null,
    decisionName: r.decision_name,
    expired: new Date(r.expires_at).getTime() < Date.now(),
  };
}

export const decisionSchema = z.object({
  decision: z.enum(["accepted", "rejected"]),
  name: z.string().trim().min(2, "Escribe tu nombre.").max(120),
  note: z.string().trim().max(1000).optional(),
});

export async function decideSharedQuote(db: Db, publicId: string, raw: unknown, ipHash: string | null): Promise<void> {
  const d = decisionSchema.parse(raw);
  await enforceRateLimit(db, `decide:${ipHash ?? "x"}`, 20, 3600);
  await db.tx(async (q) => {
    const { rows } = await q.query<{ id: string; status: string; expires_at: Date }>(
      "SELECT id, status, expires_at FROM shared_quotes WHERE public_id = $1 FOR UPDATE",
      [publicId],
    );
    const r = rows[0];
    if (!r || r.status === "withdrawn") throw new Error("Cotización no encontrada.");
    if (r.status === "accepted" || r.status === "rejected") throw new Error("Esta cotización ya tiene una respuesta.");
    if (new Date(r.expires_at).getTime() < Date.now()) throw new Error("Esta cotización ya venció. Pide una nueva.");
    await q.query(
      "UPDATE shared_quotes SET status = $2, decided_at = now(), decision_name = $3, decision_note = $4, updated_at = now() WHERE id = $1",
      [r.id, d.decision, d.name, d.note ?? null],
    );
    await audit(q, { actorType: "anonymous", action: `shared_quote.${d.decision}`, targetType: "shared_quote", targetId: r.id, ipHash });
  });
}

export async function listSharedQuotes(db: Db, lic: LicenseInfo) {
  const { rows } = await db.query<{ public_id: string; folio: string; status: string; view_count: number; decided_at: Date | null; decision_name: string | null; decision_note: string | null; created_at: Date }>(
    `SELECT public_id, folio, status, view_count, decided_at, decision_name, decision_note, created_at FROM shared_quotes
     WHERE entitlement_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [lic.entitlementId],
  );
  return rows.map((r) => ({ ...r, url: `${appUrl()}/c/${r.public_id}` }));
}

// ───── Página pública de solicitudes ─────
export const profileSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{3,40}$/, "Usa de 3 a 40 letras, números o guiones."),
  businessName: z.string().trim().min(2).max(120),
  intro: z.string().trim().max(500).optional(),
});

export async function setRequestPage(db: Db, lic: LicenseInfo, raw: unknown): Promise<string> {
  const p = profileSchema.parse(raw);
  try {
    await db.query("UPDATE entitlements SET public_slug = $2, public_profile = $3, updated_at = now() WHERE id = $1", [
      lic.entitlementId, p.slug, JSON.stringify({ businessName: p.businessName, intro: p.intro ?? "" }),
    ]);
  } catch {
    throw new Error("Esa dirección ya está ocupada. Elige otra.");
  }
  return `${appUrl()}/s/${p.slug}`;
}

export const requestSchema = z
  .object({
    name: z.string().trim().min(2, "Escribe tu nombre.").max(120),
    email: z.string().trim().toLowerCase().email().max(254).optional().or(z.literal("").transform(() => undefined)),
    phone: z.string().trim().regex(/^[0-9 +()-]{8,20}$/, "Teléfono inválido.").optional().or(z.literal("").transform(() => undefined)),
    description: z.string().trim().min(10, "Describe lo que necesitas.").max(2000),
    website: z.string().max(0).optional(), // campo trampa contra bots
  })
  .refine((r) => r.email || r.phone, { message: "Deja un correo o un teléfono para responderte." });

export async function requestPageProfile(db: Db, slug: string): Promise<{ entitlementId: string; businessName: string; intro: string } | null> {
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return null;
  const { rows } = await db.query<{ id: string; public_profile: { businessName: string; intro: string }; status: string; expires_at: Date | null; feature: string }>(
    "SELECT id, public_profile, status, expires_at, feature FROM entitlements WHERE public_slug = $1",
    [slug],
  );
  const e = rows[0];
  if (!e || e.status !== "active" || e.feature !== "cotizafacil_nube") return null;
  if (e.expires_at && new Date(e.expires_at).getTime() < Date.now()) return null;
  return { entitlementId: e.id, businessName: e.public_profile.businessName, intro: e.public_profile.intro };
}

export async function submitQuoteRequest(db: Db, slug: string, raw: unknown, ipHash: string | null): Promise<void> {
  const profile = await requestPageProfile(db, slug);
  if (!profile) throw new Error("Página no disponible.");
  const r = requestSchema.parse(raw);
  await enforceRateLimit(db, `request:${ipHash ?? "x"}`, 5, 3600);
  await enforceRateLimit(db, `request-page:${profile.entitlementId}`, 50, 86400);
  await db.query(
    `INSERT INTO quote_requests (entitlement_id, requester_name, requester_email, requester_phone, description) VALUES ($1,$2,$3,$4,$5)`,
    [profile.entitlementId, r.name, r.email ?? null, r.phone ?? null, r.description],
  );
}

export async function listQuoteRequests(db: Db, lic: LicenseInfo) {
  const { rows } = await db.query(
    `SELECT id, requester_name, requester_email, requester_phone, description, status, created_at FROM quote_requests
     WHERE entitlement_id = $1 AND status <> 'spam' ORDER BY created_at DESC LIMIT 200`,
    [lic.entitlementId],
  );
  return rows;
}

export async function updateQuoteRequest(db: Db, lic: LicenseInfo, id: string, status: "new" | "quoted" | "closed" | "spam"): Promise<void> {
  await db.query("UPDATE quote_requests SET status = $3, updated_at = now() WHERE id = $1 AND entitlement_id = $2", [id, lic.entitlementId, status]);
}

// ───── Respaldo en la nube ─────
export const MAX_BACKUP_BYTES = 2_000_000;

export async function saveBackup(db: Db, lic: LicenseInfo, data: unknown): Promise<{ version: number; sizeBytes: number }> {
  const json = JSON.stringify(data);
  const size = Buffer.byteLength(json);
  if (size > MAX_BACKUP_BYTES) throw new Error("El respaldo supera 2 MB. Quita el logo o cotizaciones antiguas.");
  await enforceRateLimit(db, `backup:${lic.entitlementId}`, 30, 3600);
  const { rows } = await db.query<{ version: number }>(
    `INSERT INTO cloud_backups (entitlement_id, data, size_bytes) VALUES ($1,$2,$3)
     ON CONFLICT (entitlement_id) DO UPDATE SET data = EXCLUDED.data, size_bytes = EXCLUDED.size_bytes, version = cloud_backups.version + 1, updated_at = now()
     RETURNING version`,
    [lic.entitlementId, json, size],
  );
  return { version: rows[0]!.version, sizeBytes: size };
}

export async function loadBackup(db: Db, lic: LicenseInfo): Promise<{ data: unknown; version: number; updatedAt: string } | null> {
  const { rows } = await db.query<{ data: unknown; version: number; updated_at: Date }>(
    "SELECT data, version, updated_at FROM cloud_backups WHERE entitlement_id = $1",
    [lic.entitlementId],
  );
  const r = rows[0];
  return r ? { data: r.data, version: r.version, updatedAt: new Date(r.updated_at).toISOString() } : null;
}
