import { createHmac } from "node:crypto";
import { sha256 } from "./crypto.ts";
import type { Queryable } from "./db/types.ts";

// Clave de licencia: CF-XXXX-XXXX-XXXX-XXXX (Crockford base32, 80 bits).
// Se deriva con HMAC(LICENSE_SECRET, entitlement_id:versión): no se guarda en claro,
// se puede volver a mostrar al dueño legítimo y se puede rotar subiendo la versión.
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function licenseSecret(): string {
  const s = process.env.LICENSE_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") throw new Error("Falta LICENSE_SECRET (mínimo 32 caracteres)");
  return "dev-license-secret-not-for-production-use-000";
}

export function deriveLicenseKey(entitlementId: string, version: number): string {
  const mac = createHmac("sha256", licenseSecret()).update(`${entitlementId}:${version}`).digest();
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of mac.subarray(0, 10)) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += CROCKFORD[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return `CF-${out.match(/.{4}/g)!.join("-")}`;
}

/** Acepta minúsculas, espacios y las confusiones típicas (O→0, I/L→1). */
export function normalizeLicenseKey(input: string): string | null {
  const raw = input.toUpperCase().replace(/[\s-]/g, "").replace(/^CF/, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  if (!/^[0-9A-HJKMNP-TV-Z]{16}$/.test(raw)) return null;
  return `CF-${raw.match(/.{4}/g)!.join("-")}`;
}

export function hashLicenseKey(key: string): string {
  return sha256(`license:${key}`);
}

export interface LicenseInfo {
  entitlementId: string;
  customerId: string;
  feature: string;
  status: string;
  features: string[];
  expiresAt: string | null;
}

/** Los planes superiores incluyen a los inferiores. */
export function featuresFor(feature: string): string[] {
  return feature === "cotizafacil_nube" ? ["cotizafacil_pro", "cotizafacil_nube"] : [feature];
}

export async function findActiveLicense(q: Queryable, key: string): Promise<LicenseInfo | null> {
  const normalized = normalizeLicenseKey(key);
  if (!normalized) return null;
  const { rows } = await q.query<{ id: string; customer_id: string; feature: string; status: string; expires_at: Date | null }>(
    "SELECT id, customer_id, feature, status, expires_at FROM entitlements WHERE license_key_hash = $1",
    [hashLicenseKey(normalized)],
  );
  const e = rows[0];
  if (!e || e.status !== "active") return null;
  if (e.expires_at && new Date(e.expires_at).getTime() < Date.now()) return null;
  return {
    entitlementId: e.id,
    customerId: e.customer_id,
    feature: e.feature,
    status: e.status,
    features: featuresFor(e.feature),
    expiresAt: e.expires_at ? new Date(e.expires_at).toISOString() : null,
  };
}
