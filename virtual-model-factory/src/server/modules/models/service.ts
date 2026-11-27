import { modelInputSchema, type ModelInput } from "@/lib/model-schema";
import { can, type Role } from "../../auth/permissions";
import { withSavepoint } from "../../db/savepoint";
import type { Queryable } from "../../db/types";
import { getModel, insertModel, setModelStatus, updateModel, type ModelDetail, type ModelStatus } from "./repository";

export type ServiceResult<T> = { ok: true; value: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export type Actor = { id: string; role: Role };

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = i.path.map(String).join(".") || "form";
    out[key] ??= i.message;
  }
  return out;
}

function dbError(error: unknown): string | null {
  const e = error as { code?: string; constraint?: string; message?: string };
  if (e.code === "23505") return "Ya existe un modelo con ese identificador (slug).";
  if (e.code === "23514") return "Los datos no cumplen las reglas de seguridad del sistema (edad, divulgación o declaración de identidad).";
  if (e.code === "42501") return "No tienes permiso para realizar esta acción.";
  return null;
}

export async function createModel(db: Queryable, actor: Actor, raw: unknown): Promise<ServiceResult<string>> {
  if (!can(actor.role, "models.create")) return { ok: false, error: "No tienes permiso para crear modelos." };
  const parsed = modelInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Revisa los campos marcados.", fieldErrors: fieldErrors(parsed.error.issues) };
  try {
    return { ok: true, value: await withSavepoint(db, () => insertModel(db, parsed.data, actor.id)) };
  } catch (error) {
    const msg = dbError(error);
    if (msg) return { ok: false, error: msg };
    throw error;
  }
}

export async function editModel(db: Queryable, actor: Actor, id: string, raw: unknown): Promise<ServiceResult<string>> {
  if (!can(actor.role, "models.update")) return { ok: false, error: "No tienes permiso para editar modelos." };
  const parsed = modelInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Revisa los campos marcados.", fieldErrors: fieldErrors(parsed.error.issues) };
  try {
    const ok = await withSavepoint(db, () => updateModel(db, id, parsed.data as ModelInput, actor.id));
    return ok ? { ok: true, value: id } : { ok: false, error: "Modelo no encontrado o sin permiso de escritura." };
  } catch (error) {
    const msg = dbError(error);
    if (msg) return { ok: false, error: msg };
    throw error;
  }
}

/** Requisitos para activar un modelo. Se muestran en el panel y se aplican aquí. */
export function activationBlockers(m: ModelDetail): string[] {
  const blockers: string[] = [];
  if (!m.likenessAttestation) blockers.push("Falta la declaración de que el personaje no reproduce a una persona real.");
  if (m.fictionalAge < 25) blockers.push("La edad ficticia debe ser de 25 años o más.");
  if (m.aiDisclosure.trim().length < 10) blockers.push("Falta la divulgación de uso de IA.");
  if (!m.personality) blockers.push("Falta definir la personalidad.");
  else if (m.personality.boundaries.length === 0) blockers.push("La personalidad debe incluir límites de conversación.");
  if (m.bio.trim().length < 20) blockers.push("La biografía debe tener al menos 20 caracteres.");
  return blockers;
}

const TRANSITIONS: Record<ModelStatus, ModelStatus[]> = {
  draft: ["active", "archived"],
  active: ["paused", "archived"],
  paused: ["active", "archived"],
  archived: ["draft"],
};

export async function changeModelStatus(db: Queryable, actor: Actor, id: string, next: ModelStatus): Promise<ServiceResult<ModelStatus>> {
  if (!can(actor.role, "models.change_status")) return { ok: false, error: "No tienes permiso para cambiar el estado." };
  const model = await getModel(db, id);
  if (!model) return { ok: false, error: "Modelo no encontrado." };
  if (!TRANSITIONS[model.status].includes(next)) {
    return { ok: false, error: `No se puede pasar de "${model.status}" a "${next}".` };
  }
  if (next === "active") {
    const blockers = activationBlockers(model);
    if (blockers.length) return { ok: false, error: blockers.join(" ") };
  }
  await setModelStatus(db, id, next);
  return { ok: true, value: next };
}
