import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Datos del alumno actual (RLS garantiza que solo ve lo suyo). */
export async function getMyEnrollmentMap(userId: string | null) {
  if (!userId) return new Map<string, { progress: number; completed: boolean }>();
  const supabase = await createClient();
  const { data } = await supabase
    .from("enrollments")
    .select("course_id, progress_percent, completed_at")
    .eq("user_id", userId)
    .is("revoked_at", null);
  return new Map((data ?? []).map((e) => [e.course_id, { progress: e.progress_percent, completed: Boolean(e.completed_at) }]));
}

export async function getMyFavoriteIds(userId: string | null) {
  if (!userId) return new Set<string>();
  const supabase = await createClient();
  const { data } = await supabase.from("favorites").select("course_id").eq("user_id", userId);
  return new Set((data ?? []).map((f) => f.course_id));
}

export async function getMyCart(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cart_items")
    .select("id, item_type, added_at, course:courses(id, slug, title, price_cents, compare_at_price_cents, currency, cover_url, level, duration_minutes, category:categories(color, icon, name)), bundle:bundles(id, slug, title, price_cents, compare_at_price_cents, currency, cover_url)")
    .eq("user_id", userId)
    .order("added_at");
  return data ?? [];
}

export async function getCartCount(userId: string | null) {
  if (!userId) return 0;
  const supabase = await createClient();
  const { count } = await supabase.from("cart_items").select("id", { count: "exact", head: true }).eq("user_id", userId);
  return count ?? 0;
}
