"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/server/auth/dal";
import { withServiceContext, withUserContext } from "@/server/db/context";
import { seedDemoData } from "@/server/modules/demo/seed";
import { recordSwitchEvent, setSwitch } from "@/server/modules/system/settings";

export type SettingsState = { error?: string; ok?: string };

const switchSchema = z.object({
  key: z.enum(["emergency_stop", "operations_paused"]),
  active: z.enum(["true", "false"]).transform((v) => v === "true"),
  reason: z.string().trim().max(300).optional(),
});

export async function toggleSwitchAction(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  const parsed = switchSchema.safeParse({ key: form.get("key"), active: form.get("active"), reason: form.get("reason") ?? undefined });
  if (!parsed.success) return { error: "Solicitud no válida." };
  const { key, active, reason } = parsed.data;
  const user = await requirePermission(key === "emergency_stop" ? "system.emergency_stop" : "system.pause");
  if (active && !reason) return { error: "Indica el motivo." };
  const ok = await withUserContext(user.id, "panel", (db) => setSwitch(db, key, active, reason ?? null, user.id));
  if (!ok) return { error: "No se pudo actualizar (permiso denegado)." };
  await withServiceContext("panel", (db) => recordSwitchEvent(db, key, active, reason ?? null, user.id), user.id);
  revalidatePath("/", "layout");
  return { ok: active ? "Activado." : "Desactivado." };
}

export async function loadDemoAction(_prev: SettingsState): Promise<SettingsState> {
  const user = await requirePermission("demo.load");
  const created = await withServiceContext("panel", (db) => seedDemoData(db, user.id), user.id);
  revalidatePath("/", "layout");
  return { ok: created.length ? `Creados: ${created.join(", ")}.` : "Los modelos de demostración ya existían." };
}
