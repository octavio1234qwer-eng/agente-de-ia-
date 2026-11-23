import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminHeader, Panel, Table, Td } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { grantCourseAction, revokeCourseAction, setRoleAction } from "@/lib/actions/admin";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatMoney, orderStatusLabel } from "@/lib/utils";

export const metadata: Metadata = { title: "Alumno" };

export default async function AdminStudent({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: user }, { data: enrollments }, { data: orders }, { data: courses }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("enrollments").select("id, course_id, source, progress_percent, completed_at, revoked_at, created_at, courses(title)").eq("user_id", id).order("created_at", { ascending: false }),
    supabase.from("orders").select("id, order_number, status, total_cents, currency, created_at").eq("user_id", id).order("created_at", { ascending: false }),
    supabase.from("courses").select("id, title").order("title"),
  ]);
  if (!user) notFound();
  const active = new Set((enrollments ?? []).filter((e) => !e.revoked_at).map((e) => e.course_id));

  return (
    <>
      <Link href="/admin/alumnos" className="mb-3 inline-flex items-center gap-1 text-sm text-mist-400 hover:text-white"><ArrowLeft className="size-4" /> Alumnos</Link>
      <AdminHeader title={user.full_name || user.email} description={`${user.email} · registrado el ${formatDate(user.created_at)}`} actions={<Avatar name={user.full_name || user.email} url={user.avatar_url} size={44} />} />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Panel title="Cursos">
            <Table head={["Curso", "Origen", "Progreso", "Estado", ""]} empty={enrollments?.length ? undefined : "Sin cursos."}>
              {(enrollments ?? []).map((e) => (
                <tr key={e.id}>
                  <Td>{e.courses?.title}</Td>
                  <Td>{e.source === "purchase" ? "Compra" : e.source === "free" ? "Gratis" : "Otorgado"}</Td>
                  <Td>{e.progress_percent}%</Td>
                  <Td>{e.revoked_at ? <Badge tone="red">Revocado</Badge> : e.completed_at ? <Badge tone="green">Completado</Badge> : <Badge tone="blue">Activo</Badge>}</Td>
                  <Td className="text-right">
                    {!e.revoked_at && (
                      <form action={revokeCourseAction}><input type="hidden" name="user_id" value={id} /><input type="hidden" name="course_id" value={e.course_id} /><ConfirmButton message="¿Retirar el acceso a este curso?">Revocar</ConfirmButton></form>
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
          </Panel>
          <Panel title="Pedidos">
            <Table head={["Pedido", "Estado", "Total", "Fecha"]} empty={orders?.length ? undefined : "Sin pedidos."}>
              {(orders ?? []).map((o) => (
                <tr key={o.id}><Td><Link href={`/admin/pedidos/${o.id}`} className="font-mono text-electric-300">{o.order_number}</Link></Td><Td>{orderStatusLabel[o.status]}</Td><Td>{formatMoney(o.total_cents, o.currency)}</Td><Td>{formatDate(o.created_at, { dateStyle: "medium" })}</Td></tr>
              ))}
            </Table>
          </Panel>
        </div>
        <div className="space-y-4">
          <Panel title="Otorgar acceso" subtitle="Inscribe al alumno sin cobro (becas, soporte, regalos).">
            <form action={grantCourseAction} className="space-y-3">
              <input type="hidden" name="user_id" value={id} />
              <select name="course_id" aria-label="Curso" className="h-11 w-full rounded-xl border border-white/10 bg-ink-850 px-3 text-sm text-white">
                {(courses ?? []).filter((c) => !active.has(c.id)).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <button type="submit" className="h-10 w-full rounded-xl bg-white/[0.06] text-sm text-white hover:bg-white/[0.1]">Otorgar acceso</button>
            </form>
          </Panel>
          <Panel title="Rol">
            {user.id === me.id ? (
              <p className="text-sm text-mist-400">No puedes cambiar tu propio rol.</p>
            ) : (
              <form action={setRoleAction} className="space-y-3">
                <input type="hidden" name="id" value={id} />
                <select name="role" defaultValue={user.role} aria-label="Rol" className="h-11 w-full rounded-xl border border-white/10 bg-ink-850 px-3 text-sm text-white">
                  <option value="student">Alumno</option><option value="instructor">Instructor</option><option value="admin">Administrador</option>
                </select>
                <ConfirmButton danger={false} message="¿Cambiar el rol de este usuario?" className="h-10 w-full justify-center bg-white/[0.06] text-sm">Guardar rol</ConfirmButton>
              </form>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
