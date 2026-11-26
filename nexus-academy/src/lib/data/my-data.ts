import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { integrations } from "@/lib/env";
import { BRAND } from "@/lib/brand";

/**
 * Todos los datos personales del alumno (derecho de acceso, LFPDPPP/ARCO).
 * Se leen con SU sesión y siempre filtrados por su propio id: aunque sea
 * administrador, aquí solo obtiene lo suyo. El registro de correos y el
 * boletín solo los lee el servidor, también filtrados por su id / correo.
 * Sus preguntas y respuestas en lecciones también: así las recibe aunque ya
 * no tenga acceso al curso (la RLS solo las muestra con acceso vigente).
 */
export async function collectMyData(userId: string) {
  const db = await createClient();
  const own = <T extends string>(table: T, cols = "*") => db.from(table as never).select(cols).eq("user_id", userId);
  const [profile, enrollments, progress, quizzes, notes, certificates, orders, favorites, reviews, cart, conversations, activity, redemptions] = await Promise.all([
    db.from("profiles").select("id, email, full_name, headline, bio, avatar_url, role, marketing_opt_in, reminder_opt_in, time_zone, weekly_lesson_goal, created_at, last_seen_at").eq("id", userId).maybeSingle(),
    own("enrollments", "source, progress_percent, completed_at, revoked_at, last_activity_at, created_at, course:courses(slug, title)"),
    own("lesson_progress", "completed_at, last_position_seconds, updated_at, lesson:lessons(title), course:courses(slug, title)"),
    own("quiz_attempts", "score, total, passed, answers, created_at, lesson:lessons(title)"),
    own("lesson_notes", "body, created_at, updated_at, lesson:lessons(title), course:courses(slug, title)"),
    own("certificates", "code, course_title, student_name, instructor_name, completed_at, issued_at, revoked_at"),
    own("orders", "order_number, status, provider, currency, subtotal_cents, discount_cents, total_cents, refunded_cents, coupon_code, customer_email, customer_name, billing_details, paid_at, refunded_at, created_at, items:order_items(title, item_type, unit_price_cents, discount_cents, total_cents)"),
    own("favorites", "created_at, course:courses(slug, title)"),
    own("reviews", "rating, comment, status, created_at, updated_at, course:courses(slug, title)"),
    own("cart_items", "item_type, added_at, course:courses(slug, title), bundle:bundles(slug, title)"),
    own("ai_conversations", "title, created_at, updated_at, messages:ai_messages(role, content, created_at)"),
    own("learning_activity", "at_hour"),
    own("coupon_redemptions", "created_at, coupon:coupons(code)"),
  ]);
  const failed = [profile, enrollments, progress, quizzes, notes, certificates, orders, favorites, reviews, cart, conversations, activity, redemptions].find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
  const email = (profile.data as { email?: string } | null)?.email ?? null;

  let emails: unknown[] = [];
  let newsletter: unknown = null;
  const qaDb = integrations.serviceRole() ? createAdminClient() : db;
  const qaCols = "body, hidden_at, created_at, updated_at, course:courses(slug, title)";
  const [questions, answers] = await Promise.all([
    qaDb.from("lesson_questions").select(`${qaCols}, lesson:lessons(title)`).eq("user_id", userId).order("created_at"),
    qaDb.from("lesson_answers").select(`${qaCols}, is_staff, question:lesson_questions(body)`).eq("user_id", userId).order("created_at"),
  ]);
  if (questions.error || answers.error) throw new Error((questions.error ?? answers.error)!.message);
  if (integrations.serviceRole()) {
    const admin = createAdminClient();
    const [log, subs] = await Promise.all([
      admin.from("email_log").select("template, subject, status, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
      email ? admin.from("newsletter_subscribers").select("email, source, unsubscribed_at, created_at").eq("email", email).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    emails = log.data ?? [];
    newsletter = subs.data ?? null;
  }

  return {
    exportado_el: new Date().toISOString(),
    plataforma: BRAND.name,
    perfil: profile.data,
    inscripciones: enrollments.data,
    progreso_por_leccion: progress.data,
    evaluaciones: quizzes.data,
    notas: notes.data,
    preguntas_en_lecciones: questions.data,
    respuestas_en_lecciones: answers.data,
    certificados: certificates.data,
    compras: orders.data,
    cupones_usados: redemptions.data,
    favoritos: favorites.data,
    resenas: reviews.data,
    carrito: cart.data,
    conversaciones_ia: conversations.data,
    actividad_de_estudio_por_hora: (activity.data as { at_hour: string }[] | null)?.map((a) => a.at_hour) ?? [],
    correos_enviados: emails,
    boletin: newsletter,
  };
}
