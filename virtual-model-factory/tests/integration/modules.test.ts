import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/server/db/types";
import { DEMO_MODELS, seedDemoData } from "@/server/modules/demo/seed";
import { activationBlockers, changeModelStatus, createModel, editModel } from "@/server/modules/models/service";
import { getModel, listModels } from "@/server/modules/models/repository";
import { getDashboardData } from "@/server/modules/dashboard/queries";
import { automationAllowed, getSystemState, recordSwitchEvent, setSwitch } from "@/server/modules/system/settings";
import { asUser, createTestDb, insertUser } from "../support/db";

let db: Database;
let admin: string, operator: string;
const adminActor = () => ({ id: admin, role: "admin" as const });

beforeAll(async () => {
  db = await createTestDb();
  await insertUser(db, "owner@vmf.test", "owner");
  admin = await insertUser(db, "admin@vmf.test", "admin");
  operator = await insertUser(db, "op@vmf.test", "operator");
  await seedDemoData(db, admin);
});
afterAll(async () => db?.close());

const input = (slug: string) => {
  const rest: Record<string, unknown> = { ...DEMO_MODELS[0]! };
  delete rest.status;
  return { ...(rest as Omit<(typeof DEMO_MODELS)[number], "status">), slug };
};

describe("gestor de modelos", () => {
  it("crea, lista y obtiene con personalidad", async () => {
    const r = await asUser(db, admin, (tx) => createModel(tx, adminActor(), input("nova-prueba")));
    expect(r.ok).toBe(true);
    const id = (r as { value: string }).value;
    const model = await asUser(db, admin, (tx) => getModel(tx, id));
    expect(model?.personality?.version).toBe(1);
    expect(model?.isDemo).toBe(false);
    const list = await asUser(db, admin, (tx) => listModels(tx));
    expect(list.map((m) => m.slug)).toContain("nova-prueba");
  });
  it("devuelve errores de validación y de permisos", async () => {
    const bad = await asUser(db, admin, (tx) => createModel(tx, adminActor(), { ...input("x-joven"), fictionalAge: 20 }));
    expect(bad).toMatchObject({ ok: false, fieldErrors: { fictionalAge: expect.stringMatching(/25/) } });
    const denied = await asUser(db, operator, (tx) => createModel(tx, { id: operator, role: "operator" }, input("op-x")));
    expect(denied.ok).toBe(false);
    const dup = await asUser(db, admin, (tx) => createModel(tx, adminActor(), input("nova-prueba")));
    expect(dup).toMatchObject({ ok: false, error: expect.stringMatching(/slug/) });
  });
  it("versiona la personalidad solo si cambia", async () => {
    const [{ id }] = (await db.query<{ id: string }>("select id from vmf.models where slug = 'nova-prueba'")) as [{ id: string }];
    const same = input("nova-prueba");
    await asUser(db, admin, (tx) => editModel(tx, adminActor(), id, { ...same, bio: same.bio + " Editada." }));
    expect((await asUser(db, admin, (tx) => getModel(tx, id)))?.personality?.version).toBe(1);
    await asUser(db, admin, (tx) => editModel(tx, adminActor(), id, { ...same, personality: { ...same.personality, tone: "Nuevo tono" } }));
    const m = await asUser(db, admin, (tx) => getModel(tx, id));
    expect(m?.personality).toMatchObject({ version: 2, tone: "Nuevo tono" });
    const versions = await db.query("select 1 from vmf.model_personalities where model_id = $1", [id]);
    expect(versions).toHaveLength(2);
  });
  it("retirar la declaración de identidad pausa un modelo activo", async () => {
    const [{ id }] = (await db.query<{ id: string }>("select id from vmf.models where slug = 'nova-prueba'")) as [{ id: string }];
    expect((await asUser(db, admin, (tx) => changeModelStatus(tx, adminActor(), id, "active"))).ok).toBe(true);
    await asUser(db, admin, (tx) => editModel(tx, adminActor(), id, { ...input("nova-prueba"), likenessAttestation: false }));
    expect((await asUser(db, admin, (tx) => getModel(tx, id)))?.status).toBe("paused");
  });
  it("controla las transiciones y requisitos de activación", async () => {
    const [{ id }] = (await db.query<{ id: string }>("select id from vmf.models where slug = 'demo-dante-rios'")) as [{ id: string }];
    const model = await asUser(db, admin, (tx) => getModel(tx, id));
    expect(activationBlockers(model!)).toEqual(expect.arrayContaining([expect.stringMatching(/persona real/)]));
    const r = await asUser(db, admin, (tx) => changeModelStatus(tx, adminActor(), id, "active"));
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/persona real/) });
    const bad = await asUser(db, admin, (tx) => changeModelStatus(tx, adminActor(), id, "paused"));
    expect(bad.ok).toBe(false);
    const op = await asUser(db, operator, (tx) => changeModelStatus(tx, { id: operator, role: "operator" }, id, "archived"));
    expect(op.ok).toBe(false);
  });
});

describe("tablero y sistema", () => {
  it("muestra métricas reales y ceros sin datos", async () => {
    const d = await asUser(db, admin, (tx) => getDashboardData(tx));
    expect(d.models.demo).toBe(3);
    expect(d.finance).toMatchObject({ grossCents: 0, netCents: 0, transactions: 0 });
    expect(d.pendingApprovals).toBe(0);
    const forOperator = await asUser(db, operator, (tx) => getDashboardData(tx));
    expect(forOperator.models.total).toBe(0);
  });
  it("interruptor de emergencia bloquea automatizaciones y queda registrado", async () => {
    expect(automationAllowed(await getSystemState(db)).allowed).toBe(true);
    const ok = await asUser(db, admin, (tx) => setSwitch(tx, "emergency_stop", true, "Prueba", admin));
    expect(ok).toBe(true);
    await recordSwitchEvent(db, "emergency_stop", true, "Prueba", admin);
    const state = await getSystemState(db);
    expect(automationAllowed(state)).toMatchObject({ allowed: false, reason: expect.stringMatching(/Prueba/) });
    const denied = await asUser(db, operator, (tx) => setSwitch(tx, "emergency_stop", false, null, operator));
    expect(denied).toBe(false);
    const [ev] = await db.query<{ n: number }>("select count(*)::int as n from vmf.security_events where type = 'emergency_stop_on'");
    expect(ev!.n).toBe(1);
  });
});
