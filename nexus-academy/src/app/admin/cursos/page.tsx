import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminHeader, Table, Td } from "@/components/admin/ui";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "Cursos" };
const statusTone = { published: "green", draft: "amber", archived: "neutral" } as const;
const statusLabel = { published: "Publicado", draft: "Borrador", archived: "Archivado" } as const;

export default async function AdminCourses({ searchParams }: { searchParams: Promise<{ estado?: string; eliminado?: string }> }) {
  await requireAdmin();
  const { estado, eliminado } = await searchParams;
  const supabase = await createClient();
  let q = supabase.from("courses").select("id, title, slug, status, price_cents, currency, students_count, rating_avg, rating_count, lessons_count, is_featured, categories(name)").order("created_at", { ascending: false });
  if (estado === "published" || estado === "draft" || estado === "archived") q = q.eq("status", estado);
  const { data } = await q;
  return (
    <>
      <AdminHeader title="Cursos" description="Crea, edita y publica cursos. Los cursos con alumnos se archivan en lugar de eliminarse." actions={<LinkButton href="/admin/cursos/nuevo" size="sm"><Plus className="size-4" /> Nuevo curso</LinkButton>} />
      {eliminado && <p role="status" className="mb-4 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">Curso eliminado.</p>}
      <div className="mb-4 flex gap-2 text-sm">
        {[["", "Todos"], ["published", "Publicados"], ["draft", "Borradores"], ["archived", "Archivados"]].map(([v, l]) => (
          <Link key={v} href={v ? `/admin/cursos?estado=${v}` : "/admin/cursos"} className={`rounded-lg px-3 py-1.5 ${(estado ?? "") === v ? "bg-white/[0.08] text-white" : "text-mist-400 hover:text-white"}`}>{l}</Link>
        ))}
      </div>
      <Table head={["Curso", "Estado", "Precio", "Lecciones", "Alumnos", "Valoración", ""]} empty={data?.length ? undefined : "No hay cursos con este filtro."}>
        {(data ?? []).map((c) => (
          <tr key={c.id} className="hover:bg-white/[0.02]">
            <Td><p className="font-medium text-white">{c.title}</p><p className="text-xs text-mist-400">{c.categories?.name ?? "Sin categoría"}{c.is_featured ? " · Destacado" : ""}</p></Td>
            <Td><Badge tone={statusTone[c.status]}>{statusLabel[c.status]}</Badge></Td>
            <Td>{formatPrice(c.price_cents, c.currency)}</Td>
            <Td>{c.lessons_count}</Td>
            <Td>{c.students_count}</Td>
            <Td>{c.rating_count ? `${Number(c.rating_avg).toFixed(1)} (${c.rating_count})` : "—"}</Td>
            <Td className="text-right"><Link href={`/admin/cursos/${c.id}`} className="text-electric-300 hover:text-white">Editar</Link></Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
