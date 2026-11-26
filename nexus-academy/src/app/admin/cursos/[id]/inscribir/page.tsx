import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { integrations } from "@/lib/env";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { BulkEnrollForm } from "@/components/admin/bulk-enroll-form";

export const metadata: Metadata = { title: "Inscribir alumnos" };

export default async function BulkEnrollPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("id, title").eq("id", id).maybeSingle();
  if (!course) notFound();
  return (
    <>
      <AdminHeader
        title={`Inscribir alumnos · ${course.title}`}
        description="Para empresas, escuelas o grupos: pega la lista de correos y dales acceso al curso sin que tengan que comprarlo. Queda registrado en la auditoría."
        actions={<Link href={`/admin/cursos/${id}`} className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm text-mist-200 hover:bg-white/[0.06]"><ArrowLeft className="size-4" aria-hidden /> Volver al curso</Link>}
      />
      <Panel className="max-w-3xl">
        <BulkEnrollForm courseId={id} canInvite={integrations.serviceRole()} />
      </Panel>
    </>
  );
}
