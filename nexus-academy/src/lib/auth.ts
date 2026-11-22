import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Capa de acceso a datos (DAL) de autenticación. Toda comprobación de
 * identidad pasa por aquí y se valida en el servidor en cada petición.
 */
export const getCurrentUser = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  return profile ?? null;
});

export async function requireUser(next?: string): Promise<Profile> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }
  return user;
}

export async function requireAdmin(): Promise<Profile> {
  const user = await requireUser("/admin");
  if (user.role !== "admin") {
    redirect("/?error=forbidden");
  }
  return user;
}

/** Para Server Actions: devuelve error en lugar de redirigir. */
export async function assertAdmin(): Promise<Profile> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new Error("No autorizado");
  }
  return user;
}

/** Evita redirecciones abiertas: solo rutas internas. */
export function safeNextPath(next: string | null | undefined, fallback = "/cuenta"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
