"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAdmin } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { integrations } from "@/lib/env";
import { announceNewCourse, sendPromotion } from "@/lib/email/automations";
import { refundStripePayment } from "@/lib/payments/stripe";
import { refundMercadoPagoPayment } from "@/lib/payments/mercadopago";
import { refundPayPalCapture } from "@/lib/payments/paypal";
import { recordRefund } from "@/lib/commerce/fulfillment";
import type { ActionState } from "./types";
import { CAPTION_LANGS, CAPTIONS_MAX_CHARS, normalizeCaptions, type CaptionLang } from "@/lib/captions";
import type { Json } from "@/lib/database.types";

const uuid = z.uuid();
const lines = (v: FormDataEntryValue | null) => String(v ?? "").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 20);
const money = z.coerce.number().min(0, "El precio no puede ser negativo.").max(1_000_000);
const optionalMoney = z.union([z.literal(""), z.coerce.number().min(0).max(1_000_000)]).optional();
const toCents = (n: number) => Math.round(n * 100);

async function audit(actorId: string, action: string, entity: string, entityId: string | null, details?: Record<string, unknown>) {
  await createAdminClient().from("admin_audit_log").insert({ actor_id: actorId, action, entity, entity_id: entityId, details: (details ?? null) as Json });
}

function friendly(error: { code?: string; message: string } | null, fallback: string) {
  if (!error) return null;
  if (error.code === "23505") return "Ya existe un registro con ese identificador (slug o código).";
  if (error.code === "23514") return "Algún valor no cumple las reglas (por ejemplo, el precio de referencia debe ser mayor que el precio).";
  return `${fallback} (${error.message})`;
}

/* ------------------------------- Cursos -------------------------------- */

const courseSchema = z.object({
  title: z.string().trim().min(3, "El título es obligatorio.").max(140),
  slug: z.string().trim().max(80).optional(),
  subtitle: z.string().trim().max(240).optional(),
  description: z.string().trim().max(20000).optional(),
  category_id: z.union([uuid, z.literal("")]).optional(),
  instructor_id: z.union([uuid, z.literal("")]).optional(),
  level: z.enum(["beginner", "intermediate", "advanced", "all"]),
  price: money,
  compare_at: optionalMoney,
  status: z.enum(["draft", "published", "archived"]),
  cover_url: z.string().trim().max(500).optional(),
});

export async function saveCourseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const parsed = courseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const compareAt = d.compare_at === "" || d.compare_at === undefined ? null : toCents(d.compare_at);
  const row = {
    title: d.title,
    slug: slugify(d.slug || d.title),
    subtitle: d.subtitle || null,
    description: d.description ?? "",
    category_id: d.category_id || null,
    instructor_id: d.instructor_id || null,
    level: d.level,
    price_cents: toCents(d.price),
    compare_at_price_cents: compareAt && compareAt > toCents(d.price) ? compareAt : null,
    status: d.status,
    is_featured: formData.get("is_featured") === "on",
    what_you_will_learn: lines(formData.get("learn")),
    requirements: lines(formData.get("requirements")),
    target_audience: lines(formData.get("audience")),
    cover_url: d.cover_url || null,
  };
  if (!row.slug) return { error: "El slug no es válido." };
  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("courses").update(row).eq("id", id);
    if (error) return { error: friendly(error, "No se pudo guardar el curso") };
    await audit(actor.id, "update", "course", id, { title: row.title, status: row.status });
    revalidatePath("/", "layout");
    return { success: "Curso guardado." };
  }
  const { data, error } = await supabase.from("courses").insert(row).select("id").single();
  if (error || !data) return { error: friendly(error, "No se pudo crear el curso") };
  await audit(actor.id, "create", "course", data.id, { title: row.title });
  revalidatePath("/", "layout");
  redirect(`/admin/cursos/${data.id}?creado=1`);
}

export async function deleteCourseAction(formData: FormData) {
  const actor = await assertAdmin();
  const id = String(formData.get("id") ?? "");
  if (!uuid.safeParse(id).success) return;
  const supabase = await createClient();
  const { count } = await supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("course_id", id);
  if ((count ?? 0) > 0) {
    // Nunca borramos el acceso de alumnos: archivamos.
    await supabase.from("courses").update({ status: "archived" }).eq("id", id);
    await audit(actor.id, "archive", "course", id, { reason: "tiene alumnos" });
    revalidatePath("/admin/cursos");
    redirect(`/admin/cursos/${id}?archivado=1`);
  }
  await supabase.from("courses").delete().eq("id", id);
  await audit(actor.id, "delete", "course", id);
  revalidatePath("/", "layout");
  redirect("/admin/cursos?eliminado=1");
}

export async function announceCourseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await assertAdmin();
  const id = String(formData.get("id") ?? "");
  if (!integrations.email()) return { error: "Configura Resend (RESEND_API_KEY y EMAIL_FROM) para enviar anuncios reales." };
  try {
    const r = await announceNewCourse(id);
    await audit(actor.id, "announce", "course", id, r);
    return { success: `Anuncio enviado: ${r.sent} enviados, ${r.duplicate} ya lo tenían, ${r.failed} fallidos.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo enviar el anuncio." };
  }
}

/* ----------------------------- Temario --------------------------------- */

export async function addModuleAction(formData: FormData) {
  const actor = await assertAdmin();
  const courseId = String(formData.get("course_id"));
  const title = String(formData.get("title") ?? "").trim().slice(0, 160);
  if (!uuid.safeParse(courseId).success || !title) return;
  const supabase = await createClient();
  const { count } = await supabase.from("modules").select("id", { count: "exact", head: true }).eq("course_id", courseId);
  await supabase.from("modules").insert({ course_id: courseId, title, position: count ?? 0 });
  await audit(actor.id, "create", "module", courseId, { title });
  revalidatePath(`/admin/cursos/${courseId}`);
}

export async function renameModuleAction(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id"));
  const title = String(formData.get("title") ?? "").trim().slice(0, 160);
  if (!uuid.safeParse(id).success || !title) return;
  const supabase = await createClient();
  const { data } = await supabase.from("modules").update({ title }).eq("id", id).select("course_id").single();
  if (data) revalidatePath(`/admin/cursos/${data.course_id}`);
}

export async function deleteModuleAction(formData: FormData) {
  const actor = await assertAdmin();
  const id = String(formData.get("id"));
  if (!uuid.safeParse(id).success) return;
  const supabase = await createClient();
  const { data } = await supabase.from("modules").delete().eq("id", id).select("course_id").single();
  await audit(actor.id, "delete", "module", id);
  if (data) revalidatePath(`/admin/cursos/${data.course_id}`);
}

async function swapPositions(table: "modules" | "lessons", id: string, dir: "up" | "down", scope: { column: "course_id" | "module_id"; value: string }) {
  const supabase = await createClient();
  const { data: items } =
    table === "modules"
      ? await supabase.from("modules").select("id, position").eq("course_id", scope.value).order("position").order("created_at")
      : await supabase.from("lessons").select("id, position").eq("module_id", scope.value).order("position").order("created_at");
  if (!items) return;
  const idx = items.findIndex((i) => i.id === id);
  const other = dir === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || other < 0 || other >= items.length) return;
  const reordered = [...items];
  [reordered[idx], reordered[other]] = [reordered[other], reordered[idx]];
  await Promise.all(reordered.map((it, i) => supabase.from(table).update({ position: i }).eq("id", it.id)));
}

export async function moveModuleAction(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id"));
  const courseId = String(formData.get("course_id"));
  const dir = formData.get("dir") === "up" ? "up" : "down";
  if (!uuid.safeParse(id).success || !uuid.safeParse(courseId).success) return;
  await swapPositions("modules", id, dir, { column: "course_id", value: courseId });
  revalidatePath(`/admin/cursos/${courseId}`);
}

export async function moveLessonAction(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id"));
  const moduleId = String(formData.get("module_id"));
  const courseId = String(formData.get("course_id"));
  const dir = formData.get("dir") === "up" ? "up" : "down";
  if (![id, moduleId, courseId].every((v) => uuid.safeParse(v).success)) return;
  await swapPositions("lessons", id, dir, { column: "module_id", value: moduleId });
  revalidatePath(`/admin/cursos/${courseId}`);
}

export async function addLessonAction(formData: FormData) {
  const actor = await assertAdmin();
  const moduleId = String(formData.get("module_id"));
  const courseId = String(formData.get("course_id"));
  const title = String(formData.get("title") ?? "").trim().slice(0, 160);
  const type = z.enum(["video", "article", "quiz", "exercise"]).catch("video").parse(formData.get("type"));
  if (!uuid.safeParse(moduleId).success || !title) return;
  const supabase = await createClient();
  const { count } = await supabase.from("lessons").select("id", { count: "exact", head: true }).eq("module_id", moduleId);
  const { data } = await supabase.from("lessons").insert({ module_id: moduleId, course_id: courseId, title, type, position: count ?? 0 }).select("id").single();
  if (data) {
    // La fila de contenido (indexable para la búsqueda) la crea el trigger lessons_ensure_content.
    await audit(actor.id, "create", "lesson", data.id, { title, type });
    redirect(`/admin/cursos/${courseId}/lecciones/${data.id}`);
  }
  revalidatePath(`/admin/cursos/${courseId}`);
}

const lessonSchema = z.object({
  id: uuid,
  title: z.string().trim().min(1, "El título es obligatorio.").max(160),
  summary: z.string().trim().max(500).optional(),
  type: z.enum(["video", "article", "quiz", "exercise"]),
  minutes: z.coerce.number().min(0).max(600),
  pass_percent: z.coerce.number().int().min(0).max(100).optional(),
  body: z.string().max(100_000).optional(),
  video_provider: z.enum(["", "storage", "youtube", "vimeo", "url"]).optional(),
  video_ref: z.string().trim().max(500).optional(),
});

export async function saveLessonAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await assertAdmin();
  const parsed = lessonSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.video_provider === "url" && d.video_ref && !/^https:\/\//.test(d.video_ref)) return { error: "La URL del video debe empezar con https://" };
  const supabase = await createClient();
  const { data: lesson, error } = await supabase
    .from("lessons")
    .update({ title: d.title, summary: d.summary || null, type: d.type, duration_seconds: Math.round(d.minutes * 60), is_preview: formData.get("is_preview") === "on", pass_percent: d.pass_percent ?? 70 })
    .eq("id", d.id)
    .select("course_id")
    .single();
  if (error || !lesson) return { error: friendly(error, "No se pudo guardar la lección") };
  const { error: cErr } = await supabase.from("lesson_contents").upsert(
    { lesson_id: d.id, course_id: lesson.course_id, body: d.body ?? "", video_provider: d.video_provider ? d.video_provider : null, video_ref: d.video_ref || null },
    { onConflict: "lesson_id" },
  );
  if (cErr) return { error: friendly(cErr, "No se pudo guardar el contenido") };
  await audit(actor.id, "update", "lesson", d.id, { title: d.title });
  revalidatePath(`/admin/cursos/${lesson.course_id}`);
  return { success: "Lección guardada." };
}

export async function deleteLessonAction(formData: FormData) {
  const actor = await assertAdmin();
  const id = String(formData.get("id"));
  const courseId = String(formData.get("course_id"));
  if (!uuid.safeParse(id).success) return;
  const supabase = await createClient();
  const { data: resources } = await supabase.from("lesson_resources").select("storage_path").eq("lesson_id", id);
  const { data: content } = await supabase.from("lesson_contents").select("video_provider, video_ref").eq("lesson_id", id).maybeSingle();
  await supabase.from("lessons").delete().eq("id", id);
  const storage = createAdminClient().storage;
  if (resources?.length) await storage.from("course-materials").remove(resources.map((r) => r.storage_path));
  if (content?.video_provider === "storage" && content.video_ref) await storage.from("course-videos").remove([content.video_ref]);
  await audit(actor.id, "delete", "lesson", id);
  revalidatePath(`/admin/cursos/${courseId}`);
  redirect(`/admin/cursos/${courseId}`);
}

export async function addResourceAction(input: { lessonId: string; title: string; path: string; mime: string; size: number }): Promise<ActionState> {
  const actor = await assertAdmin();
  if (!uuid.safeParse(input.lessonId).success || !input.path.startsWith(`${input.lessonId}/`) && !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\//.test(input.path)) {
    return { error: "Ruta de archivo inválida." };
  }
  const supabase = await createClient();
  const { data: lesson } = await supabase.from("lessons").select("course_id").eq("id", input.lessonId).single();
  if (!lesson) return { error: "Lección no encontrada." };
  const { error } = await supabase.from("lesson_resources").insert({
    lesson_id: input.lessonId,
    course_id: lesson.course_id,
    title: input.title.slice(0, 160) || "Recurso",
    storage_path: input.path,
    mime_type: input.mime,
    size_bytes: input.size,
    is_downloadable: true,
  });
  if (error) return { error: friendly(error, "No se pudo registrar el recurso") };
  await audit(actor.id, "create", "resource", input.lessonId, { title: input.title });
  revalidatePath(`/admin/cursos/${lesson.course_id}/lecciones/${input.lessonId}`);
  return { success: "Recurso agregado." };
}

export async function deleteResourceAction(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id"));
  if (!uuid.safeParse(id).success) return;
  const supabase = await createClient();
  const { data } = await supabase.from("lesson_resources").delete().eq("id", id).select("storage_path, lesson_id, course_id").single();
  if (data) {
    await createAdminClient().storage.from("course-materials").remove([data.storage_path]);
    revalidatePath(`/admin/cursos/${data.course_id}/lecciones/${data.lesson_id}`);
  }
}

export async function toggleResourceDownloadAction(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id"));
  const value = formData.get("value") === "true";
  const supabase = await createClient();
  const { data } = await supabase.from("lesson_resources").update({ is_downloadable: value }).eq("id", id).select("lesson_id, course_id").single();
  if (data) revalidatePath(`/admin/cursos/${data.course_id}/lecciones/${data.lesson_id}`);
}

const questionSchema = z.object({
  lesson_id: uuid,
  prompt: z.string().trim().min(3, "Escribe la pregunta.").max(1000),
  correct: z.coerce.number().int().min(1, "Indica cuál es la opción correcta."),
  explanation: z.string().trim().max(1000).optional(),
});

export async function saveQuestionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await assertAdmin();
  const parsed = questionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const options = lines(formData.get("options")).slice(0, 8);
  if (options.length < 2) return { error: "Escribe al menos 2 opciones (una por línea)." };
  if (parsed.data.correct > options.length) return { error: "La opción correcta no existe." };
  const supabase = await createClient();
  const { data: lesson } = await supabase.from("lessons").select("course_id").eq("id", parsed.data.lesson_id).single();
  if (!lesson) return { error: "Lección no encontrada." };
  const id = String(formData.get("id") ?? "");
  const row = { lesson_id: parsed.data.lesson_id, course_id: lesson.course_id, prompt: parsed.data.prompt, options, correct_index: parsed.data.correct - 1, explanation: parsed.data.explanation || null };
  const { error } = id
    ? await supabase.from("quiz_questions").update(row).eq("id", id)
    : await supabase.from("quiz_questions").insert({ ...row, position: Number(formData.get("position") ?? 0) });
  if (error) return { error: friendly(error, "No se pudo guardar la pregunta") };
  revalidatePath(`/admin/cursos/${lesson.course_id}/lecciones/${parsed.data.lesson_id}`);
  return { success: id ? "Pregunta actualizada." : "Pregunta agregada." };
}

export async function deleteQuestionAction(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id"));
  const supabase = await createClient();
  const { data } = await supabase.from("quiz_questions").delete().eq("id", id).select("lesson_id, course_id").single();
  if (data) revalidatePath(`/admin/cursos/${data.course_id}/lecciones/${data.lesson_id}`);
}

/* ---------------------- Categorías e instructores ----------------------- */

export async function saveCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await assertAdmin();
  const parsed = z.object({
    name: z.string().trim().min(2, "Escribe el nombre.").max(80),
    description: z.string().trim().max(500).optional(),
    icon: z.string().trim().max(40),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido."),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const row = { ...parsed.data, description: parsed.data.description || null, slug: slugify(String(formData.get("slug") || parsed.data.name)) };
  const { error } = id ? await supabase.from("categories").update(row).eq("id", id) : await supabase.from("categories").insert(row);
  if (error) return { error: friendly(error, "No se pudo guardar la categoría") };
  await audit(actor.id, id ? "update" : "create", "category", id || null, { name: row.name });
  revalidatePath("/", "layout");
  return { success: "Categoría guardada." };
}

export async function deleteCategoryAction(formData: FormData) {
  const actor = await assertAdmin();
  const id = String(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("categories").delete().eq("id", id);
  await audit(actor.id, "delete", "category", id);
  revalidatePath("/", "layout");
}

export async function saveInstructorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await assertAdmin();
  const parsed = z.object({
    name: z.string().trim().min(2, "Escribe el nombre.").max(120),
    headline: z.string().trim().max(160).optional(),
    bio: z.string().trim().max(3000).optional(),
    avatar_url: z.union([z.literal(""), z.url()]).optional(),
    website_url: z.union([z.literal(""), z.url()]).optional(),
    linkedin_url: z.union([z.literal(""), z.url()]).optional(),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const id = String(formData.get("id") ?? "");
  const d = parsed.data;
  const row = {
    name: d.name,
    headline: d.headline || null,
    bio: d.bio || null,
    avatar_url: d.avatar_url || null,
    website_url: d.website_url || null,
    linkedin_url: d.linkedin_url || null,
    is_active: formData.get("is_active") === "on",
    slug: slugify(String(formData.get("slug") || d.name)),
  };
  const supabase = await createClient();
  const { error } = id ? await supabase.from("instructors").update(row).eq("id", id) : await supabase.from("instructors").insert(row);
  if (error) return { error: friendly(error, "No se pudo guardar el instructor") };
  await audit(actor.id, id ? "update" : "create", "instructor", id || null, { name: row.name });
  revalidatePath("/", "layout");
  return { success: "Instructor guardado." };
}

/* ----------------------------- Paquetes --------------------------------- */

export async function saveBundleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await assertAdmin();
  const parsed = z.object({
    title: z.string().trim().min(3, "Escribe el título.").max(140),
    description: z.string().trim().max(3000).optional(),
    price: z.coerce.number().positive("El precio debe ser mayor a 0."),
    compare_at: optionalMoney,
    status: z.enum(["draft", "published", "archived"]),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const courseIds = formData.getAll("course_ids").map(String).filter((v) => uuid.safeParse(v).success);
  if (courseIds.length < 2) return { error: "Un paquete necesita al menos 2 cursos." };
  const id = String(formData.get("id") ?? "");
  const d = parsed.data;
  const compareAt = d.compare_at === "" || d.compare_at === undefined ? null : toCents(d.compare_at);
  const row = {
    title: d.title,
    slug: slugify(String(formData.get("slug") || d.title)),
    description: d.description ?? "",
    price_cents: toCents(d.price),
    compare_at_price_cents: compareAt && compareAt > toCents(d.price) ? compareAt : null,
    status: d.status,
  };
  const supabase = await createClient();
  const res = id ? await supabase.from("bundles").update(row).eq("id", id).select("id").single() : await supabase.from("bundles").insert(row).select("id").single();
  if (res.error || !res.data) return { error: friendly(res.error, "No se pudo guardar el paquete") };
  const bundleId = res.data.id;
  await supabase.from("bundle_courses").delete().eq("bundle_id", bundleId);
  await supabase.from("bundle_courses").insert(courseIds.map((c, i) => ({ bundle_id: bundleId, course_id: c, position: i })));
  await audit(actor.id, id ? "update" : "create", "bundle", bundleId, { title: row.title, courses: courseIds.length });
  revalidatePath("/", "layout");
  return { success: "Paquete guardado." };
}

/* ------------------------------ Cupones --------------------------------- */

export async function saveCouponAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await assertAdmin();
  const parsed = z.object({
    code: z.string().trim().regex(/^[A-Za-z0-9_-]{3,40}$/, "Código: 3 a 40 letras, números, guion o guion bajo."),
    description: z.string().trim().max(200).optional(),
    discount_type: z.enum(["percent", "fixed"]),
    discount_value: z.coerce.number().positive("El descuento debe ser mayor a 0."),
    max_redemptions: z.union([z.literal(""), z.coerce.number().int().positive()]).optional(),
    per_user_limit: z.coerce.number().int().min(1).max(100),
    min_subtotal: z.union([z.literal(""), z.coerce.number().min(0)]).optional(),
    starts_at: z.string().optional(),
    expires_at: z.string().optional(),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.discount_type === "percent" && d.discount_value > 100) return { error: "Un porcentaje no puede superar 100." };
  const courseIds = formData.getAll("course_ids").map(String).filter((v) => uuid.safeParse(v).success);
  const row = {
    code: d.code.toUpperCase(),
    description: d.description || null,
    discount_type: d.discount_type,
    discount_value: d.discount_type === "percent" ? Math.round(d.discount_value) : toCents(d.discount_value),
    max_redemptions: d.max_redemptions === "" || d.max_redemptions === undefined ? null : d.max_redemptions,
    per_user_limit: d.per_user_limit,
    min_subtotal_cents: d.min_subtotal === "" || d.min_subtotal === undefined ? 0 : toCents(d.min_subtotal),
    course_ids: courseIds.length ? courseIds : null,
    starts_at: d.starts_at ? new Date(d.starts_at).toISOString() : null,
    expires_at: d.expires_at ? new Date(d.expires_at).toISOString() : null,
    is_active: formData.get("is_active") === "on",
  };
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = id ? await supabase.from("coupons").update(row).eq("id", id) : await supabase.from("coupons").insert(row);
  if (error) return { error: friendly(error, "No se pudo guardar el cupón") };
  await audit(actor.id, id ? "update" : "create", "coupon", id || null, { code: row.code });
  revalidatePath("/admin/cupones");
  return { success: `Cupón ${row.code} guardado.` };
}

export async function toggleCouponAction(formData: FormData) {
  const actor = await assertAdmin();
  const id = String(formData.get("id"));
  const active = formData.get("active") === "true";
  const supabase = await createClient();
  await supabase.from("coupons").update({ is_active: active }).eq("id", id);
  await audit(actor.id, active ? "activate" : "deactivate", "coupon", id);
  revalidatePath("/admin/cupones");
}

/* ----------------------------- Reseñas ---------------------------------- */

export async function moderateReviewAction(formData: FormData) {
  const actor = await assertAdmin();
  const id = String(formData.get("id"));
  const status = formData.get("status") === "hidden" ? "hidden" : "published";
  const supabase = await createClient();
  await supabase.from("reviews").update({ status }).eq("id", id);
  await audit(actor.id, status === "hidden" ? "hide" : "publish", "review", id);
  revalidatePath("/admin/resenas");
}

export async function deleteReviewAction(formData: FormData) {
  const actor = await assertAdmin();
  const id = String(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("reviews").delete().eq("id", id);
  await audit(actor.id, "delete", "review", id);
  revalidatePath("/admin/resenas");
}

/* ----------------------------- Alumnos ---------------------------------- */

export async function setRoleAction(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id"));
  const role = z.enum(["student", "instructor", "admin"]).catch("student").parse(formData.get("role"));
  const supabase = await createClient();
  await supabase.rpc("admin_set_role", { p_user_id: id, p_role: role });
  revalidatePath(`/admin/alumnos/${id}`);
}

export async function grantCourseAction(formData: FormData) {
  await assertAdmin();
  const userId = String(formData.get("user_id"));
  const courseId = String(formData.get("course_id"));
  if (!uuid.safeParse(userId).success || !uuid.safeParse(courseId).success) return;
  const supabase = await createClient();
  await supabase.rpc("admin_grant_course", { p_user_id: userId, p_course_id: courseId });
  revalidatePath(`/admin/alumnos/${userId}`);
}

export async function revokeCourseAction(formData: FormData) {
  await assertAdmin();
  const userId = String(formData.get("user_id"));
  const courseId = String(formData.get("course_id"));
  const supabase = await createClient();
  await supabase.rpc("admin_revoke_course", { p_user_id: userId, p_course_id: courseId });
  revalidatePath(`/admin/alumnos/${userId}`);
}

/* ------------------------- Pedidos y reembolsos ------------------------- */

export async function refundOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await assertAdmin();
  const orderId = String(formData.get("order_id"));
  const amount = z.coerce.number().positive("Indica el monto a reembolsar.").safeParse(formData.get("amount"));
  if (!amount.success) return { error: amount.error.issues[0].message };
  const reason = String(formData.get("reason") ?? "").slice(0, 300);
  const manual = formData.get("manual") === "on";
  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("*").eq("id", orderId).single();
  if (!order) return { error: "Pedido no encontrado." };
  const cents = Math.round(amount.data * 100);
  if (!["paid", "partially_refunded"].includes(order.status)) return { error: "Solo se pueden reembolsar pedidos pagados." };
  if (cents > order.total_cents - order.refunded_cents) return { error: "El monto supera lo que queda por reembolsar." };

  let providerRefundId: string | null = null;
  let status: string | null = null;
  try {
    if (!manual && order.provider !== "free") {
      if (!order.provider_payment_id) return { error: "El pedido no tiene identificador de pago del proveedor." };
      if (order.provider === "stripe") {
        if (!integrations.stripe()) return { error: "Stripe no está configurado. Marca «reembolso manual» si ya lo hiciste en el panel del proveedor." };
        providerRefundId = (await refundStripePayment(order.provider_payment_id, cents, order.id)).id;
      } else if (order.provider === "mercadopago") {
        if (!integrations.mercadopago()) return { error: "Mercado Pago no está configurado. Usa «reembolso manual»." };
        providerRefundId = (await refundMercadoPagoPayment(order.provider_payment_id, cents, order.id)).id;
      } else if (order.provider === "paypal") {
        if (!integrations.paypal()) return { error: "PayPal no está configurado. Usa «reembolso manual»." };
        providerRefundId = (await refundPayPalCapture(order.provider_payment_id, cents, order.currency, order.id)).id;
      }
    }
    status = await recordRefund({ orderId, amountCents: cents, providerRefundId, reason: reason || (manual ? "Reembolso manual" : "Reembolso desde el panel"), actorId: actor.id });
    await audit(actor.id, "refund", "order", orderId, { cents, manual, providerRefundId });
  } catch (e) {
    return { error: `El proveedor rechazó el reembolso: ${e instanceof Error ? e.message : String(e)}` };
  }
  revalidatePath(`/admin/pedidos/${orderId}`);
  redirect(`/admin/pedidos/${orderId}?reembolso=${status === "refunded" ? "total" : "parcial"}`);
}

/* ------------------------------ Correos --------------------------------- */

export async function sendCampaignAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await assertAdmin();
  const parsed = z.object({
    subject: z.string().trim().min(5, "Escribe un asunto.").max(140),
    message: z.string().trim().min(20, "El mensaje es muy corto.").max(5000),
    ctaLabel: z.string().trim().min(2).max(40),
    ctaUrl: z.url("La URL del botón no es válida."),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (formData.get("confirm") !== "on") return { error: "Confirma que el envío respeta a quienes aceptaron recibir promociones." };
  if (!integrations.email()) return { error: "Configura Resend (RESEND_API_KEY y EMAIL_FROM) para enviar campañas reales." };
  const id = crypto.randomUUID();
  const r = await sendPromotion({ id, ...parsed.data });
  await audit(actor.id, "send_campaign", "email", id, { subject: parsed.data.subject, ...r });
  revalidatePath("/admin/correos");
  return { success: `Campaña enviada: ${r.sent} enviados, ${r.failed} fallidos, ${r.duplicate} duplicados omitidos.` };
}


/* ------------------------------ Subtítulos ------------------------------ */

/** Carga (convierte .srt → WebVTT) o quita los subtítulos de una lección de video. */
export async function saveLessonCaptionsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await assertAdmin();
  const lessonId = String(formData.get("lesson_id") ?? "");
  if (!uuid.safeParse(lessonId).success) return { error: "Lección inválida." };
  const supabase = await createClient();
  const { data: lesson } = await supabase.from("lessons").select("course_id, type").eq("id", lessonId).maybeSingle();
  if (!lesson) return { error: "Lección no encontrada." };
  if (lesson.type !== "video") return { error: "Los subtítulos solo aplican a lecciones de video." };

  if (formData.get("intent") === "delete") {
    const { error } = await supabase.from("lesson_contents").update({ captions_vtt: null }).eq("lesson_id", lessonId);
    if (error) return { error: friendly(error, "No se pudieron quitar los subtítulos") };
    await audit(actor.id, "delete", "lesson_captions", lessonId);
    revalidatePath(`/admin/cursos/${lesson.course_id}/lecciones/${lessonId}`);
    return { success: "Subtítulos quitados." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Elige un archivo .vtt o .srt." };
  if (file.size > CAPTIONS_MAX_CHARS * 2) return { error: "El archivo de subtítulos es demasiado grande (máximo 500 KB)." };
  const lang = String(formData.get("lang") ?? "es");
  if (!(lang in CAPTION_LANGS)) return { error: "Idioma no válido." };
  const result = normalizeCaptions(await file.text());
  if ("error" in result) return { error: result.error };
  const { error } = await supabase
    .from("lesson_contents")
    .update({ captions_vtt: result.vtt, captions_lang: lang as CaptionLang })
    .eq("lesson_id", lessonId);
  if (error) return { error: friendly(error, "No se pudieron guardar los subtítulos") };
  await audit(actor.id, "update", "lesson_captions", lessonId, { cues: result.cues, lang });
  revalidatePath(`/admin/cursos/${lesson.course_id}/lecciones/${lessonId}`);
  return { success: `Subtítulos guardados (${result.cues} ${result.cues === 1 ? "fragmento" : "fragmentos"}).` };
}
