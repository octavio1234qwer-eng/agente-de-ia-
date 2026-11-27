import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Token aleatorio de 256 bits en base64url. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Hash canónico de un objeto JSON (claves ordenadas) para aprobar versiones exactas. */
export function hashPayload(payload: unknown): string {
  const canonical = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(canonical);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.keys(v as Record<string, unknown>)
          .sort()
          .map((k) => [k, canonical((v as Record<string, unknown>)[k])]),
      );
    }
    return v;
  };
  return sha256Hex(JSON.stringify(canonical(payload)));
}

/**
 * Cifrado simétrico AES-256-GCM para tokens de integraciones y datos personales.
 * Formato: v1.<iv>.<tag>.<ciphertext> (base64url). La clave (32 bytes en base64)
 * vive solo en el servidor: ENCRYPTION_KEY.
 */
export function parseEncryptionKey(raw: string | undefined): Buffer {
  if (!raw) throw new Error("ENCRYPTION_KEY no está configurada (genera una con `npm run secrets:generate`).");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY debe ser de 32 bytes codificados en base64.");
  return key;
}

export function encryptSecret(plaintext: string, key: Buffer, aad = "vmf"): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptSecret(payload: string, key: Buffer, aad = "vmf"): string {
  const [version, iv, tag, ct] = payload.split(".");
  if (version !== "v1" || !iv || !tag || ct === undefined) throw new Error("Formato de secreto cifrado no válido.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}
