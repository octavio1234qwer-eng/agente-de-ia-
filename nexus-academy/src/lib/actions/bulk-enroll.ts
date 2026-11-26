"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAdmin } from "@/lib/auth";
import { integrations, siteUrl } from "@/lib/env";
import { BULK_MAX, parseEmailList, summarize, type BulkRow, type BulkStatus } from "@/lib/bulk-enroll";

export type BulkEnrollState = { error?: string; summary?: string; rows?: BulkRow[]; values?: { emails: string } } | null;

const uuid = z.uuid();

/**
 * Admin: da acceso a un curso a una lista de correos. Quien ya tiene cuenta
 * queda inscrito al instante; a quien no, opcionalmente se le envía una
 * invitación para crear su contraseña (y queda inscrito desde ya).
 */
export async function bulkEnrollAction(_prev: BulkEnrollState, formData: FormData): Promise<BulkEnrollState> {
  const actor = await assertAdmin();
  const courseId = String(formData.get("course_id") ?? "");
  const raw = String(formData.get("emails") ?? "");
  const invite = formData.get("invite") === "1";
  if (!uuid.safeParse(courseId).success) return { error: "Curso inválido.", values: { emails: raw } };
  const emails = parseEmailList(raw);
  if (emails.length === 0) return { error: "Pega al menos un correo.", values: { emails: raw } };
  if (emails.length > BULK_MAX) return { error: `Máximo ${BULK_MAX} correos por envío (pegaste ${emails.length}).`, values: { emails: raw } };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_bulk_enroll", { p_course_id: courseId, p_emails: emails });
  if (error || !data) return { error: "No se pudo inscribir a la lista.", values: { emails: raw } };

  const rows: BulkRow[] = data.map((r) => ({ email: r.email, status: r.status as BulkStatus }));
  const pending = rows.filter((r) => r.status === "not_found");
  if (invite && pending.length > 0) {
    if (!integrations.serviceRole()) {
      for (const r of pending) r.detail = "Falta SUPABASE_SERVICE_ROLE_KEY para invitar.";
    } else {
      const admin = createAdminClient();
      for (const r of pending) {
        const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(r.email, { redirectTo: `${siteUrl}/restablecer?bienvenida=1` });
        if (inviteError || !invited?.user) {
          r.status = "invite_failed";
          r.detail = inviteError?.message ?? "Sin respuesta del servidor de autenticación.";
          continue;
        }
        const { error: enrollError } = await admin
          .from("enrollments")
          .upsert({ user_id: invited.user.id, course_id: courseId, source: "admin_grant", revoked_at: null }, { onConflict: "user_id,course_id" });
        if (enrollError) {
          r.status = "invite_failed";
          r.detail = "Se invitó, pero no se pudo dar el acceso al curso.";
          continue;
        }
        r.status = "invited";
      }
      const invitedCount = rows.filter((r) => r.status === "invited").length;
      const failedCount = rows.filter((r) => r.status === "invite_failed").length;
      await admin.from("admin_audit_log").insert({ actor_id: actor.id, action: "bulk_invite", entity: "course", entity_id: courseId, details: { invited: invitedCount, failed: failedCount } });
    }
  }

  revalidatePath(`/admin/cursos/${courseId}`);
  revalidatePath("/admin/alumnos");
  return { summary: summarize(rows), rows, values: { emails: "" } };
}
