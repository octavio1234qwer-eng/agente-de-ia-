"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MODEL_STATUSES, modelInputFromForm } from "@/lib/model-schema";
import { asCurrentUser } from "@/server/auth/dal";
import { changeModelStatus, createModel, editModel } from "@/server/modules/models/service";

import type { ModelInput } from "@/lib/model-schema";

/** `values` devuelve lo enviado para no perder lo escrito si hay errores. */
export type ModelFormState = { error?: string; fieldErrors?: Record<string, string>; values?: ModelInput };

const uuid = z.uuid();

export async function createModelAction(_prev: ModelFormState, form: FormData): Promise<ModelFormState> {
  const raw = modelInputFromForm(form);
  const result = await asCurrentUser((db, user) => createModel(db, user, raw));
  if (!result.ok) return { error: result.error, fieldErrors: result.fieldErrors, values: raw as ModelInput };
  revalidatePath("/models");
  redirect(`/models/${result.value}?created=1`);
}

export async function updateModelAction(id: string, _prev: ModelFormState, form: FormData): Promise<ModelFormState> {
  if (!uuid.safeParse(id).success) return { error: "Identificador no válido." };
  const raw = modelInputFromForm(form);
  const result = await asCurrentUser((db, user) => editModel(db, user, id, raw));
  if (!result.ok) return { error: result.error, fieldErrors: result.fieldErrors, values: raw as ModelInput };
  revalidatePath(`/models/${id}`);
  redirect(`/models/${id}?saved=1`);
}

export type StatusState = { error?: string; ok?: string };

export async function changeStatusAction(id: string, _prev: StatusState, form: FormData): Promise<StatusState> {
  const status = z.enum(MODEL_STATUSES).safeParse(form.get("status"));
  if (!uuid.safeParse(id).success || !status.success) return { error: "Solicitud no válida." };
  const result = await asCurrentUser((db, user) => changeModelStatus(db, user, id, status.data));
  if (!result.ok) return { error: result.error };
  revalidatePath(`/models/${id}`);
  return { ok: "Estado actualizado." };
}
