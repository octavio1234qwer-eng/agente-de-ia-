import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

// Se regenera cada hora: nuevos cursos y paquetes publicados aparecen solos.
export const revalidate = 3600;

const STATIC_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/cursos", priority: 0.9, changeFrequency: "daily" },
  { path: "/paquetes", priority: 0.8, changeFrequency: "weekly" },
  { path: "/instructores", priority: 0.6, changeFrequency: "weekly" },
  { path: "/verificar", priority: 0.4, changeFrequency: "yearly" },
  { path: "/terminos", priority: 0.2, changeFrequency: "yearly" },
  { path: "/privacidad", priority: 0.2, changeFrequency: "yearly" },
  { path: "/reembolsos", priority: 0.2, changeFrequency: "yearly" },
];

/**
 * Mapa del sitio con las páginas públicas y los cursos y paquetes publicados.
 * Usa la clave pública (anon): solo ve lo que RLS deja ver a un visitante, así
 * que borradores y archivados nunca aparecen. Si la base de datos no responde,
 * entrega al menos las páginas fijas.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({ url: `${siteUrl}${r.path}`, lastModified: now, changeFrequency: r.changeFrequency, priority: r.priority }));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return entries;
  try {
    const supabase = createClient<Database>(url, key, { auth: { persistSession: false } });
    const [courses, bundles] = await Promise.all([
      supabase.from("courses").select("slug, updated_at").eq("status", "published").order("published_at", { ascending: false }),
      supabase.from("bundles").select("slug, updated_at").eq("status", "published"),
    ]);
    for (const c of courses.data ?? []) entries.push({ url: `${siteUrl}/cursos/${c.slug}`, lastModified: new Date(c.updated_at), changeFrequency: "weekly", priority: 0.8 });
    for (const b of bundles.data ?? []) entries.push({ url: `${siteUrl}/paquetes/${b.slug}`, lastModified: new Date(b.updated_at), changeFrequency: "weekly", priority: 0.7 });
  } catch (err) {
    console.error("[sitemap] no se pudieron leer cursos/paquetes", err);
  }
  return entries;
}
