"use server";
import { timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { createUser } from "@empire/core/auth";
import { db, assertSameOrigin } from "@/lib/server";

/** Alta del primer propietario. Solo funciona si no existe ningún usuario y con SETUP_TOKEN correcto. */
export async function setupOwner(_: { error?: string } | undefined, f: FormData) {
  await assertSameOrigin();
  const token = String(f.get("token") ?? ""), expected = process.env.SETUP_TOKEN ?? "";
  if (expected.length < 16 || token.length !== expected.length || !timingSafeEqual(Buffer.from(token), Buffer.from(expected)))
    return { error: "Código de configuración inválido" };
  const pw = String(f.get("password") ?? ""), pw2 = String(f.get("password2") ?? "");
  if (pw !== pw2) return { error: "Las contraseñas no coinciden" };
  const d = await db();
  try {
    await d.transaction(async (tx) => {
      await tx.query("lock table users in exclusive mode");
      const n = await tx.query<{ n: string }>("select count(*) n from users");
      if (Number(n.rows[0]?.n) > 0) throw new Error("Ya existe un propietario");
      await createUser(tx, { email: String(f.get("email") ?? "").slice(0, 200), name: String(f.get("name") ?? "").slice(0, 120), role: "owner", password: pw }, "setup");
    });
  } catch (e) { return { error: e instanceof Error ? e.message : "Error" }; }
  redirect("/login");
}
