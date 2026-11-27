"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MODEL_STATUSES, modelInputFromForm } from "@/lib/model-schema";
import { asCurrentUser } from "@/server/auth/dal";
import { changeModelStatus, createModel, editModel } from "@/server/modules/models/service";

export type ModelFormState = { error?: string; fieldErrors?: Record<string, string> };

const uuid = z.uuid();

export async function createModelAction(_prev: ModelFormState, form: FormData): Promise<ModelFormState> {
  const result = await asCurrentUser((db, user) => createModel(db, user, modelInputFromForm(form)));
  if (!result.ok) return { error: result.error, fieldErrors: result.fieldErrors };
  revalidatePath("/models");
  redirect(`/models/${result.value}?created=1`);
}

export async function updateModelAction(id: string, _prev: ModelFormState, form: FormData): Promise<ModelFormState> {
  if (!uuid.safeParse(id).success) return { error: "Identificador no válido." };
  const result = await asCurrentUser((db, user) => editModel(db, user, id, modelInputFromForm(form)));
  if (!result.ok) return { error: result.error, fieldErrors: result.fieldErrors };
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
