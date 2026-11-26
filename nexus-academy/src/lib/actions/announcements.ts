"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAdmin, getCurrentUser } from "@/lib/auth";
import { sendCourseAnnouncement } from "@/lib/email/automations";
import type { ActionState } from "./types";

const uuid = z.uuid();
const schema = z.object({
  course_id: uuid,
  id: z.union([uuid, z.literal("")]).optional(),
  title: z.string().trim().min(3, "El título necesita al menos 3 caracteres.").max(140, "El título admite hasta 140 caracteres."),
  body: z.string().trim().min(1, "Escribe el aviso.").max(10000, "El aviso admite hasta 10,000 caracteres."),
});

function refresh(courseId: string) {
  revalidatePath(`/admin/cursos/${courseId}/avisos`);
  revalidatePath("/aprender/[slug]/avisos", "page");
  revalidatePath("/aprender/[slug]/[lessonId]", "page");
  revalidatePath("/cuenta/cursos");
}

async function audit(actorId: string, action: string, entityId: string, details?: Record<string, number>) {
  await createAdminClient().from("admin_audit_log").insert({ actor_id: actorId, action, entity: "course_announcement", entity_id: entityId, details: details ?? null });
}

/** Admin: publica o edita un aviso y, si se pide y aún no se envió, lo manda por correo. */
export async function saveAnnouncementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await assertAdmin();
  const parsed = schema.safeParse({
    course_id: formData.get("course_id"),
    id: formData.get("id") ?? "",
    title: formData.get("title"),
    body: String(formData.get("body") ?? "").replace(/\r\n?/g, "\n"),
  });
  const values = { title: String(formData.get("title") ?? ""), body: String(formData.get("body") ?? "") };
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  const { course_id, id, title, body } = parsed.data;
  const sendEmail = formData.get("send_email") === "1";
  const supabase = await createClient();

  let announcementId = id || "";
  let alreadyEmailed = false;
  if (announcementId) {
    const { data, error } = await supabase.from("course_announcements").update({ title, body }).eq("id", announcementId).eq("course_id", course_id).select("id, emailed_at");
    if (error || !data?.length) return { error: "No se pudo guardar el aviso.", values };
    alreadyEmailed = Boolean(data[0].emailed_at);
    await audit(actor.id, "update", announcementId);
  } else {
    const { data, error } = await supabase.from("course_announcements").insert({ course_id, author_id: actor.id, title, body }).select("id").single();
    if (error || !data) return { error: "No se pudo publicar el aviso.", values };
    announcementId = data.id;
    await audit(actor.id, "create", announcementId);
  }

  let note = "";
  if (sendEmail && !alreadyEmailed) {
    const result = await sendCourseAnnouncement(announcementId);
    if (result) {
      await audit(actor.id, "email", announcementId, { sent: result.sent, skipped: result.skipped, failed: result.failed });
      if (result.recipients === 0) note = " No hay alumnos con avisos activados para enviarle el correo.";
      else if (result.skipped === result.recipients) note = ` El correo quedó como «omitido» para ${result.recipients} alumno(s): configura Resend para enviarlo.`;
      else note = ` Correo: ${result.sent} enviado(s), ${result.skipped} omitido(s), ${result.failed} con error.`;
    }
  } else if (sendEmail && alreadyEmailed) {
    note = " Este aviso ya se había enviado por correo; no se volvió a enviar.";
  }
  refresh(course_id);
  return { success: `${id ? "Aviso actualizado." : "Aviso publicado."}${note}`, values: id ? values : { title: "", body: "" } };
}

/** Admin: elimina un aviso. */
export async function deleteAnnouncementAction(formData: FormData) {
  const actor = await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const courseId = String(formData.get("course_id") ?? "");
  if (!uuid.safeParse(id).success || !uuid.safeParse(courseId).success) return;
  const supabase = await createClient();
  const { data } = await supabase.from("course_announcements").delete().eq("id", id).select("id");
  if (data?.length) await audit(actor.id, "delete", id);
  refresh(courseId);
}

/** Alumno: marca como vistos los avisos del curso (solo su propia inscripción). */
export async function markAnnouncementsSeenAction(courseId: string) {
  const user = await getCurrentUser();
  if (!user || !uuid.safeParse(courseId).success) return;
  const supabase = await createClient();
  await supabase.rpc("mark_announcements_seen", { p_course_id: courseId });
}
