import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/server/db/types";
import { migrate } from "@/server/db/migrate";
import { DEMO_MODELS, seedDemoData } from "@/server/modules/demo/seed";
import { insertModel } from "@/server/modules/models/repository";
import { asUser, createTestDb, insertUser } from "../support/db";

let db: Database;
let owner: string, admin: string, operator: string, viewer: string, outsider: string;
let lunaId: string, ariaId: string;

beforeAll(async () => {
  db = await createTestDb();
  owner = await insertUser(db, "owner@vmf.test", "owner");
  admin = await insertUser(db, "admin@vmf.test", "admin");
  operator = await insertUser(db, "operator@vmf.test", "operator");
  viewer = await insertUser(db, "viewer@vmf.test", "viewer");
  outsider = await insertUser(db, "outsider@vmf.test", "operator");
  await seedDemoData(db, owner);
  const rows = await db.query<{ id: string; slug: string }>("select id, slug from vmf.models");
  lunaId = rows.find((r) => r.slug === "demo-luna-vex")!.id;
  ariaId = rows.find((r) => r.slug === "demo-aria-solenne")!.id;
  await db.query("insert into vmf.user_model_access (user_id, model_id) values ($1, $2), ($3, $2)", [operator, lunaId, viewer]);
});
afterAll(async () => db?.close());

describe("migraciones", () => {
  it("crean las tablas requeridas y son idempotentes", async () => {
    const rows = await db.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'vmf'",
    );
    const names = rows.map((r) => r.table_name);
    for (const t of [
      "users", "models", "model_personalities", "model_assets", "content_library", "content_campaigns",
      "publishing_calendar", "social_accounts", "social_connections", "conversations", "customers", "products",
      "subscriptions", "transactions", "expenses", "analytics", "automation_jobs", "agent_logs", "approvals", "security_events",
    ]) expect(names).toContain(t);
    expect(await migrate(db)).toEqual([]);
  });
  it("RLS habilitado en todas las tablas", async () => {
    const rows = await db.query<{ relname: string }>(
      "select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'vmf' and c.relkind = 'r' and not c.relrowsecurity",
    );
    expect(rows).toEqual([]);
  });
});

describe("reglas de integridad", () => {
  const base = { ...DEMO_MODELS[0]!, slug: "regla-x" };
  it("rechaza edad ficticia menor de 25", async () => {
    await expect(insertModel(db, { ...base, slug: "joven", fictionalAge: 24 }, owner)).rejects.toMatchObject({ code: "23514" });
  });
  it("rechaza activar sin declaración de identidad", async () => {
    await expect(db.query("update vmf.models set status = 'active' where slug = 'demo-dante-rios'")).rejects.toMatchObject({ code: "23514" });
  });
  it("is_virtual no puede ser falso", async () => {
    await expect(db.query("update vmf.models set is_virtual = false where id = $1", [lunaId])).rejects.toMatchObject({ code: "23514" });
  });
  it("OnlyFans no puede habilitarse", async () => {
    await expect(
      db.query("insert into vmf.social_accounts (model_id, platform, handle, status, is_enabled) values ($1, 'onlyfans', 'x', 'connected', true)", [lunaId]),
    ).rejects.toMatchObject({ code: "23514" });
    await db.query("insert into vmf.social_accounts (model_id, platform, handle, status, is_enabled, disabled_reason) values ($1, 'onlyfans', 'luna', 'disabled', false, 'Política de la plataforma')", [lunaId]);
  });
  it("no se marca publicado sin confirmación de la plataforma", async () => {
    const [c] = await db.query<{ id: string }>("insert into vmf.content_library (model_id, type, title) values ($1, 'caption', 't') returning id", [lunaId]);
    await expect(
      db.query("insert into vmf.publishing_calendar (model_id, content_id, platform, scheduled_at, status, idempotency_key) values ($1, $2, 'instagram', now(), 'published', 'k1')", [lunaId, c!.id]),
    ).rejects.toMatchObject({ code: "23514" });
  });
  it("detecta contenido duplicado por hash", async () => {
    const sha = "a".repeat(64);
    await db.query("insert into vmf.content_library (model_id, type, title, sha256) values ($1, 'image', 'a', $2)", [lunaId, sha]);
    await expect(db.query("insert into vmf.content_library (model_id, type, title, sha256) values ($1, 'image', 'b', $2)", [lunaId, sha])).rejects.toMatchObject({ code: "23505" });
  });
  it("calcula el neto de transacciones y valida signos", async () => {
    const [t] = await db.query<{ net_cents: number }>(
      "insert into vmf.transactions (model_id, type, gross_cents, fee_cents, provider, external_id, occurred_at) values ($1, 'sale', 1000, 200, 'test', 't1', now()) returning net_cents",
      [lunaId],
    );
    expect(t!.net_cents).toBe(800);
    await expect(
      db.query("insert into vmf.transactions (model_id, type, gross_cents, provider, external_id, occurred_at) values ($1, 'refund', 500, 'test', 't2', now())", [lunaId]),
    ).rejects.toMatchObject({ code: "23514" });
  });
  it("siempre queda un owner activo", async () => {
    await expect(db.query("update vmf.users set role = 'admin' where id = $1", [owner])).rejects.toThrow(/propietario/);
  });
});

describe("RLS: separación por modelo y rol", () => {
  it("admin ve todos los modelos; operador y lector solo los asignados", async () => {
    const count = (uid: string) => asUser(db, uid, async (tx) => (await tx.query("select id from vmf.models")).length);
    expect(await count(admin)).toBe(3);
    expect(await count(operator)).toBe(1);
    expect(await count(viewer)).toBe(1);
    expect(await count(outsider)).toBe(0);
  });
  it("las tablas dependientes respetan el aislamiento", async () => {
    const n = await asUser(db, outsider, async (tx) => (await tx.query("select id from vmf.model_personalities")).length);
    expect(n).toBe(0);
    const m = await asUser(db, operator, async (tx) => (await tx.query("select distinct model_id from vmf.model_personalities")).length);
    expect(m).toBe(1);
  });
  it("lector no puede escribir; operador solo en su modelo", async () => {
    const upd = (uid: string, id: string) =>
      asUser(db, uid, async (tx) => (await tx.query("update vmf.models set bio = bio || ' ' where id = $1 returning id", [id])).length);
    expect(await upd(viewer, lunaId)).toBe(0);
    expect(await upd(operator, lunaId)).toBe(1);
    expect(await upd(operator, ariaId)).toBe(0);
  });
  it("solo admin+ crea modelos", async () => {
    await expect(
      asUser(db, operator, (tx) => insertModel(tx, { ...DEMO_MODELS[0]!, slug: "op-model" }, operator)),
    ).rejects.toMatchObject({ code: "42501" });
    const id = await asUser(db, admin, (tx) => insertModel(tx, { ...DEMO_MODELS[0]!, slug: "admin-model" }, admin));
    expect(id).toBeTruthy();
  });
  it("el rol de ejecución no lee secretos ni sesiones", async () => {
    await expect(asUser(db, owner, (tx) => tx.query("select password_hash from vmf.users"))).rejects.toMatchObject({ code: "42501" });
    await expect(asUser(db, owner, (tx) => tx.query("select * from vmf.sessions"))).rejects.toMatchObject({ code: "42501" });
    await expect(asUser(db, owner, (tx) => tx.query("select access_token_enc from vmf.social_connections"))).rejects.toMatchObject({ code: "42501" });
    await expect(asUser(db, owner, (tx) => tx.query("select email_enc from vmf.customers"))).rejects.toMatchObject({ code: "42501" });
    const users = await asUser(db, owner, (tx) => tx.query("select id, email, role from vmf.users"));
    expect(users.length).toBe(5);
  });
  it("operador no ve usuarios ajenos, registros de seguridad ni auditoría", async () => {
    const r = await asUser(db, operator, async (tx) => ({
      users: (await tx.query("select id from vmf.users")).length,
      audit: (await tx.query("select id from vmf.audit_log")).length,
    }));
    expect(r).toEqual({ users: 1, audit: 0 });
  });
  it("solo admin+ cambia ajustes del sistema", async () => {
    const set = (uid: string) =>
      asUser(db, uid, async (tx) => (await tx.query("update vmf.system_settings set value = value where key = 'emergency_stop' returning key")).length);
    expect(await set(operator)).toBe(0);
    expect(await set(admin)).toBe(1);
  });
  it("sin usuario en contexto no se ve nada", async () => {
    const n = await db.transaction(async (tx) => {
      await tx.query("set local role vmf_runtime");
      return (await tx.query("select id from vmf.models")).length;
    });
    expect(n).toBe(0);
  });
});

describe("auditoría", () => {
  it("registra actor, origen y cambios sin secretos", async () => {
    await asUser(db, admin, (tx) => tx.query("update vmf.models set bio = 'Biografía auditada de prueba' where id = $1", [ariaId]));
    const [row] = await db.query<{ actor_user_id: string; actor_source: string; changes: Record<string, { new: string }> }>(
      "select actor_user_id, actor_source, changes from vmf.audit_log where table_name = 'models' and record_id = $1 and action = 'UPDATE' order by id desc limit 1",
      [ariaId],
    );
    expect(row!.actor_user_id).toBe(admin);
    expect(row!.actor_source).toBe("panel");
    expect(row!.changes.bio!.new).toBe("Biografía auditada de prueba");
    const [u] = await db.query<{ changes: Record<string, unknown> }>(
      "select changes from vmf.audit_log where table_name = 'users' and action = 'INSERT' limit 1",
    );
    expect(u!.changes).not.toHaveProperty("password_hash");
  });
});

describe("datos de demostración", () => {
  it("crea tres modelos marcados como demo, idempotente", async () => {
    expect(await seedDemoData(db, owner)).toEqual([]);
    const rows = await db.query<{ is_demo: boolean; fictional_age: number }>("select is_demo, fictional_age from vmf.models where slug like 'demo-%'");
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.is_demo && r.fictional_age >= 25)).toBe(true);
  });
});
