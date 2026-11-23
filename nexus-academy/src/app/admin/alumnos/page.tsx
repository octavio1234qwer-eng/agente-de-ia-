import type { Metadata } from "next";
import { ExportForm } from "@/components/admin/export-form";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminHeader, Table, Td } from "@/components/admin/ui";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Alumnos" };

export default async function AdminStudents({ searchParams }: { searchParams: Promise<{ q?: string; pagina?: string }> }) {
  await requireAdmin();
  const { q, pagina } = await searchParams;
  const page = Math.max(1, Number(pagina) || 1);
  const supabase = await createClient();
  let query = supabase.from("profiles").select("id, email, full_name, avatar_url, role, created_at, enrollments(id)", { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * 25, page * 25 - 1);
  const term = (q ?? "").trim().replace(/[%,()]/g, "").slice(0, 80);
  if (term) query = query.or(`email.ilike.%${term}%,full_name.ilike.%${term}%`);
  const { data, count } = await query;
  const pages = Math.max(1, Math.ceil((count ?? 0) / 25));
  return (
    <>
      <AdminHeader title="Alumnos" description={`${count ?? 0} usuarios registrados`} />
      <ExportForm kind="alumnos" />
      <form className="mb-4 flex gap-2" role="search">
        <input name="q" defaultValue={term} placeholder="Buscar por nombre o correo" aria-label="Buscar alumnos" className="h-10 w-full max-w-sm rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white placeholder:text-mist-500 focus:outline-none" />
        <button className="h-10 rounded-xl bg-white/[0.06] px-4 text-sm text-white hover:bg-white/[0.1]">Buscar</button>
      </form>
      <Table head={["Usuario", "Rol", "Cursos", "Registro", ""]} empty={data?.length ? undefined : "Sin resultados."}>
        {(data ?? []).map((u) => (
          <tr key={u.id} className="hover:bg-white/[0.02]">
            <Td><div className="flex items-center gap-3"><Avatar name={u.full_name || u.email} url={u.avatar_url} size={32} /><div><p className="text-white">{u.full_name || "—"}</p><p className="text-xs text-mist-400">{u.email}</p></div></div></Td>
            <Td><Badge tone={u.role === "admin" ? "violet" : u.role === "instructor" ? "blue" : "neutral"}>{u.role}</Badge></Td>
            <Td>{u.enrollments?.length ?? 0}</Td>
            <Td>{formatDate(u.created_at, { dateStyle: "medium" })}</Td>
            <Td className="text-right"><Link href={`/admin/alumnos/${u.id}`} className="text-electric-300 hover:text-white">Ver</Link></Td>
          </tr>
        ))}
      </Table>
      {pages > 1 && (
        <nav className="mt-4 flex gap-2" aria-label="Paginación">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <Link key={p} href={`/admin/alumnos?pagina=${p}${term ? `&q=${encodeURIComponent(term)}` : ""}`} className={`grid size-9 place-items-center rounded-lg text-sm ${p === page ? "bg-white/[0.08] text-white" : "text-mist-400"}`}>{p}</Link>
          ))}
        </nav>
      )}
    </>
  );
}
