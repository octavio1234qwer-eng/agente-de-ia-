import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type CourseRow = Database["public"]["Tables"]["courses"]["Row"];
export type CourseCard = CourseRow & {
  category: { name: string; slug: string; color: string; icon: string } | null;
  instructor: { name: string; slug: string; avatar_url: string | null } | null;
};

export const COURSE_CARD_SELECT =
  "*, category:categories(name, slug, color, icon), instructor:instructors(name, slug, avatar_url)";

export type CatalogFilters = {
  q?: string;
  category?: string;
  price?: "free" | "paid";
  level?: Database["public"]["Enums"]["course_level"];
  maxPrice?: number;
  sort?: "popular" | "newest" | "rating" | "price_asc" | "price_desc";
  page?: number;
};

export const PAGE_SIZE = 12;

export async function searchCatalog(filters: CatalogFilters) {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await supabase
    .rpc(
      "search_courses",
      {
        p_query: filters.q?.slice(0, 100) || undefined,
        p_category: filters.category || undefined,
        p_price: filters.price || undefined,
        p_level: filters.level || undefined,
        p_max_price_cents: filters.maxPrice ?? undefined,
        p_sort: filters.sort ?? "popular",
      },
      { count: "exact" },
    )
    .select(COURSE_CARD_SELECT)
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw error;
  return { courses: (data ?? []) as unknown as CourseCard[], total: count ?? 0, page, pageSize: PAGE_SIZE };
}

export async function getCategories() {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").order("sort_order");
  return data ?? [];
}

export async function getCoursesBy(opts: { featured?: boolean; order: "students_count" | "published_at" | "rating_avg"; limit: number }) {
  const supabase = await createClient();
  let query = supabase.from("courses").select(COURSE_CARD_SELECT).eq("status", "published");
  if (opts.featured) query = query.eq("is_featured", true);
  const { data } = await query.order(opts.order, { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(opts.limit);
  return (data ?? []) as unknown as CourseCard[];
}

export async function getCourseBySlug(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select(
      `${COURSE_CARD_SELECT}, instructor_full:instructors(*), modules(id, title, description, position, lessons(id, title, type, duration_seconds, position, is_preview))`,
    )
    .eq("slug", slug)
    .order("position", { referencedTable: "modules" })
    .maybeSingle();
  if (!data) return null;
  const course = data as unknown as CourseCard & {
    instructor_full: Database["public"]["Tables"]["instructors"]["Row"] | null;
    modules: {
      id: string;
      title: string;
      description: string | null;
      position: number;
      lessons: { id: string; title: string; type: Database["public"]["Enums"]["lesson_type"]; duration_seconds: number; position: number; is_preview: boolean }[];
    }[];
  };
  course.modules.forEach((m) => m.lessons.sort((a, b) => a.position - b.position));
  return course;
}

export async function getInstructors(limit = 8) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("instructors")
    .select("*, courses(id, status)")
    .eq("is_active", true)
    .limit(limit);
  return (data ?? []).map((i) => ({ ...i, courseCount: (i.courses ?? []).filter((c) => c.status === "published").length }));
}

export async function getPublicStats() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("academy_public_stats");
  return (data ?? {}) as { courses?: number; students?: number; lessons?: number; hours?: number; certificates?: number; instructors?: number };
}

export async function getFeaturedReviews(limit = 6) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("featured_reviews", { p_limit: limit });
  return data ?? [];
}

export async function getBundles() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bundles")
    .select("*, bundle_courses(position, courses(id, title, slug, price_cents, currency, cover_url, category:categories(color)))")
    .eq("status", "published")
    .order("created_at");
  return data ?? [];
}
