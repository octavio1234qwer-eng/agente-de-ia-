import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminHeader, Table, Td } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { deleteReviewAction, moderateReviewAction } from "@/lib/actions/admin";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Reseñas" };

export default async function AdminReviews() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("reviews").select("id, rating, comment, status, created_at, courses(title), profiles(full_name, email)").order("created_at", { ascending: false }).limit(200);
  return (
    <>
      <AdminHeader title="Reseñas" description="Solo alumnos inscritos pueden publicar. Oculta las que incumplan las normas." />
      <Table head={["Curso", "Alumno", "Calificación", "Comentario", "Estado", ""]} empty={data?.length ? undefined : "Aún no hay reseñas."}>
        {(data ?? []).map((r) => (
          <tr key={r.id}>
            <Td className="text-xs">{r.courses?.title}</Td>
            <Td className="text-xs">{r.profiles?.full_name || r.profiles?.email}<span className="block text-mist-500">{formatDate(r.created_at, { dateStyle: "medium" })}</span></Td>
            <Td>{"★".repeat(r.rating)}<span className="text-white/20">{"★".repeat(5 - r.rating)}</span></Td>
            <Td className="max-w-sm text-xs text-mist-300">{r.comment ?? "—"}</Td>
            <Td><Badge tone={r.status === "published" ? "green" : "neutral"}>{r.status === "published" ? "Publicada" : "Oculta"}</Badge></Td>
            <Td className="whitespace-nowrap">
              <form action={moderateReviewAction} className="inline"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value={r.status === "published" ? "hidden" : "published"} /><button className="rounded-lg px-2 py-1 text-xs text-mist-200 hover:bg-white/[0.06]">{r.status === "published" ? "Ocultar" : "Publicar"}</button></form>
              <form action={deleteReviewAction} className="inline"><input type="hidden" name="id" value={r.id} /><ConfirmButton message="¿Eliminar esta reseña definitivamente?">Eliminar</ConfirmButton></form>
            </Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
