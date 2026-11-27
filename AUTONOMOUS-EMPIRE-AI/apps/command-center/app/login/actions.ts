"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { login, logout, SESSION_TTL_HOURS } from "@empire/core/auth";
import { db, visitorHash, SESSION_COOKIE, assertSameOrigin } from "@/lib/server";

export async function loginAction(_: { error?: string; email?: string } | undefined, form: FormData) {
  await assertSameOrigin();
  const email = String(form.get("email") ?? "").slice(0, 200);
  const password = String(form.get("password") ?? "").slice(0, 200);
  const r = await login(await db(), email, password, await visitorHash());
  if (!r.ok) return { error: r.error, email };
  (await cookies()).set(SESSION_COOKIE, r.token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_TTL_HOURS * 3600,
  });
  redirect("/dashboard");
}

export async function logoutAction() {
  const jar = await cookies();
  const t = jar.get(SESSION_COOKIE)?.value;
  if (t) await logout(await db(), t);
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
