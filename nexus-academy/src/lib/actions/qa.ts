"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAdmin, getCurrentUser } from "@/lib/auth";
import { sendQuestionAnsweredEmail } from "@/lib/email/automations";
import { ANSWER_MAX, cleanQaBody, QUESTION_MAX, QUESTION_MIN, qaErrorMessage } from "@/lib/qa";
import type { ActionState } from "./types";

const uuid = z.uuid();
const kindSchema = z.enum(["question", "answer"]);

function refresh() {
  revalidatePath("/aprender/[slug]/[lessonId]", "page");
  revalidatePath("/admin/preguntas");
}

/** Publica una pregunta en una lección (solo alumnos con acceso al curso; lo verifica la base). */
export async function askQuestionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Inicia sesión para preguntar." };
  const lessonId = String(formData.get("lesson_id") ?? "");
  const body = cleanQaBody(formData.get("body"));
  if (!uuid.safeParse(lessonId).success) return { error: "Lección inválida." };
  if (body.length < QUESTION_MIN) return { error: `Escribe tu pregunta (mínimo ${QUESTION_MIN} caracteres).`, values: { body } };
  if (body.length > QUESTION_MAX) return { error: `La pregunta supera ${QUESTION_MAX} caracteres.`, values: { body } };

  const supabase = await createClient();
  const { data: lesson } = await supabase.from("lessons").select("course_id").eq("id", lessonId).maybeSingle();
  if (!lesson) return { error: "Lección no encontrada.", values: { body } };
  const { error } = await supabase.from("lesson_questions").insert({ lesson_id: lessonId, course_id: lesson.course_id, user_id: user.id, body });
  if (error) return { error: qaErrorMessage(error, "question"), values: { body } };
  refresh();
  return { success: "Publicamos tu pregunta. Te avisaremos por correo cuando el equipo responda.", values: { body: "" } };
}

/** Responde una pregunta visible. Si responde el equipo, se avisa por correo al autor. */
export async function answerQuestionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Inicia sesión para responder." };
  const questionId = String(formData.get("question_id") ?? "");
  const body = cleanQaBody(formData.get("body"));
  if (!uuid.safeParse(questionId).success) return { error: "Pregunta inválida." };
  if (!body) return { error: "Escribe tu respuesta.", values: { body } };
  if (body.length > ANSWER_MAX) return { error: `La respuesta supera ${ANSWER_MAX} caracteres.`, values: { body } };

  const supabase = await createClient();
  const { data: question } = await supabase.from("lesson_questions").select("course_id").eq("id", questionId).maybeSingle();
  if (!question) return { error: "La pregunta ya no está disponible.", values: { body } };
  const { data: inserted, error } = await supabase
    .from("lesson_answers")
    .insert({ question_id: questionId, course_id: question.course_id, user_id: user.id, body })
    .select("id, is_staff")
    .single();
  if (error || !inserted) return { error: qaErrorMessage(error, "answer"), values: { body } };

  let note = "";
  if (inserted.is_staff) {
    const sent = await sendQuestionAnsweredEmail(inserted.id);
    if (sent?.status === "sent") note = " Avisamos al alumno por correo.";
    else if (sent?.status === "skipped") note = " El aviso por correo quedó registrado como omitido: configura Resend para enviarlo.";
    else if (sent?.status === "failed") note = " No se pudo enviar el aviso por correo (ver Correos).";
  }
  refresh();
  return { success: `Respuesta publicada.${note}`, values: { body: "" } };
}

/** Edita una pregunta o respuesta propia que no esté oculta. */
export async function editQaPostAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Inicia sesión." };
  const kind = kindSchema.safeParse(formData.get("kind"));
  const id = String(formData.get("id") ?? "");
  const body = cleanQaBody(formData.get("body"));
  if (!kind.success || !uuid.safeParse(id).success) return { error: "Solicitud inválida." };
  const min = kind.data === "question" ? QUESTION_MIN : 1;
  const max = kind.data === "question" ? QUESTION_MAX : ANSWER_MAX;
  if (body.length < min || body.length > max) return { error: `El texto debe tener entre ${min} y ${max} caracteres.`, values: { body } };

  const supabase = await createClient();
  const table = kind.data === "question" ? "lesson_questions" : "lesson_answers";
  const { data, error } = await supabase.from(table).update({ body }).eq("id", id).eq("user_id", user.id).select("id");
  if (error) return { error: qaErrorMessage(error, kind.data), values: { body } };
  if (!data?.length) return { error: "No puedes editar este mensaje (es de otra persona o fue ocultado).", values: { body } };
  refresh();
  return { success: "Cambios guardados.", values: { body } };
}

async function audit(actorId: string, action: string, entity: string, entityId: string) {
  await createAdminClient().from("admin_audit_log").insert({ actor_id: actorId, action, entity, entity_id: entityId });
}

/** Borra una pregunta o respuesta: la propia, o cualquiera si es admin (queda auditado). */
export async function deleteQaPostAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const kind = kindSchema.safeParse(formData.get("kind"));
  const id = String(formData.get("id") ?? "");
  if (!kind.success || !uuid.safeParse(id).success) return;
  const supabase = await createClient();
  const table = kind.data === "question" ? "lesson_questions" : "lesson_answers";
  const { data } = await supabase.from(table).delete().eq("id", id).select("user_id");
  const row = data?.[0];
  if (row && row.user_id !== user.id && user.role === "admin") await audit(user.id, "delete", `lesson_${kind.data}`, id);
  refresh();
}

/** Admin: oculta o vuelve a mostrar una pregunta o respuesta. */
export async function moderateQaAction(formData: FormData) {
  const actor = await assertAdmin();
  const kind = kindSchema.safeParse(formData.get("kind"));
  const id = String(formData.get("id") ?? "");
  const hidden = formData.get("hidden") === "1";
  if (!kind.success || !uuid.safeParse(id).success) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_moderate_qa", { p_kind: kind.data, p_id: id, p_hidden: hidden });
  if (!error) await audit(actor.id, hidden ? "hide" : "show", `lesson_${kind.data}`, id);
  refresh();
}
