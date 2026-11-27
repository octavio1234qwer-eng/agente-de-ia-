import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, generateToken, hashPayload, parseEncryptionKey, safeEqual, sha256Hex } from "@/server/security/crypto";
import { hashPassword, passwordPolicyError, verifyPassword } from "@/server/auth/password";
import { can, hasMinRole } from "@/server/auth/permissions";
import { windowStart } from "@/server/security/rate-limit";
import { buildSslConfig, stripSslParams } from "@/server/db/postgres";

describe("cifrado", () => {
  const key = randomBytes(32);
  it("cifra y descifra con AES-256-GCM", () => {
    const enc = encryptSecret("token-secreto", key);
    expect(enc.startsWith("v1.")).toBe(true);
    expect(enc).not.toContain("token-secreto");
    expect(decryptSecret(enc, key)).toBe("token-secreto");
  });
  it("detecta manipulación y clave incorrecta", () => {
    const enc = encryptSecret("dato", key);
    const parts = enc.split(".");
    parts[3] = Buffer.from("otro").toString("base64url");
    expect(() => decryptSecret(parts.join("."), key)).toThrow();
    expect(() => decryptSecret(enc, randomBytes(32))).toThrow();
    expect(() => decryptSecret(enc, key, "otro-contexto")).toThrow();
  });
  it("valida la clave de cifrado", () => {
    expect(() => parseEncryptionKey(undefined)).toThrow(/ENCRYPTION_KEY/);
    expect(() => parseEncryptionKey(Buffer.alloc(16).toString("base64"))).toThrow(/32 bytes/);
    expect(parseEncryptionKey(key.toString("base64"))).toHaveLength(32);
  });
  it("genera tokens únicos y hashes estables", () => {
    expect(generateToken()).not.toBe(generateToken());
    expect(generateToken().length).toBeGreaterThanOrEqual(43);
    expect(sha256Hex("a")).toHaveLength(64);
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
  });
  it("hash de payload independiente del orden de claves", () => {
    expect(hashPayload({ b: 1, a: { d: 2, c: [1, 2] } })).toBe(hashPayload({ a: { c: [1, 2], d: 2 }, b: 1 }));
    expect(hashPayload({ a: 1 })).not.toBe(hashPayload({ a: 2 }));
  });
});

describe("contraseñas", () => {
  it("hash scrypt verificable y con sal", async () => {
    const h1 = await hashPassword("una-frase-larga-y-segura");
    const h2 = await hashPassword("una-frase-larga-y-segura");
    expect(h1).not.toBe(h2);
    expect(h1.startsWith("scrypt$32768$8$1$")).toBe(true);
    expect(await verifyPassword("una-frase-larga-y-segura", h1)).toBe(true);
    expect(await verifyPassword("otra-frase-distinta", h1)).toBe(false);
    expect(await verifyPassword("x", "basura")).toBe(false);
  });
  it("aplica la política", () => {
    expect(passwordPolicyError("corta")).toMatch(/12/);
    expect(passwordPolicyError("password1234")).toMatch(/común/);
    expect(passwordPolicyError("aaaaaaaaaaaaaa")).toMatch(/repetitiva/);
    expect(passwordPolicyError("ana.garcia-2026!", "ana.garcia@ejemplo.com")).toMatch(/correo/);
    expect(passwordPolicyError("Montaña-Violeta-42")).toBeNull();
  });
});

describe("permisos", () => {
  it("jerarquía de roles", () => {
    expect(hasMinRole("owner", "admin")).toBe(true);
    expect(hasMinRole("operator", "admin")).toBe(false);
    expect(can("viewer", "models.read")).toBe(true);
    expect(can("viewer", "models.update")).toBe(false);
    expect(can("operator", "models.update")).toBe(true);
    expect(can("operator", "models.change_status")).toBe(false);
    expect(can("admin", "users.manage")).toBe(false);
    expect(can("owner", "users.manage")).toBe(true);
  });
});

describe("utilidades", () => {
  it("ventana fija de límites", () => {
    expect(windowStart(new Date("2026-01-01T10:07:30Z"), 900).toISOString()).toBe("2026-01-01T10:00:00.000Z");
  });
  it("TLS de PostgreSQL", () => {
    expect(stripSslParams("postgres://u:p@h:5432/db?sslmode=require&application_name=x")).toBe(
      "postgres://u:p@h:5432/db?application_name=x",
    );
    expect(buildSslConfig({ connectionString: "postgres://u@localhost/db" })).toBe(false);
    expect(buildSslConfig({ connectionString: "postgres://u@db.supabase.co/db" })).toEqual({ rejectUnauthorized: true });
    expect(buildSslConfig({ connectionString: "postgres://u@db.supabase.co/db", sslMode: "require" })).toEqual({ rejectUnauthorized: false });
  });
});
