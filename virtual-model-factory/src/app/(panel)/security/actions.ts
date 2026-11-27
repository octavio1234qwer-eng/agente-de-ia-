"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/dal";
import { revokeSessionById } from "@/server/auth/service";
import { withServiceContext } from "@/server/db/context";

export async function revokeSessionAction(form: FormData): Promise<void> {
  const user = await requireUser();
  const id = z.uuid().safeParse(form.get("sessionId"));
  if (!id.success) return;
  await withServiceContext("panel", (db) => revokeSessionById(db, id.data, user), user.id);
  revalidatePath("/security");
}
