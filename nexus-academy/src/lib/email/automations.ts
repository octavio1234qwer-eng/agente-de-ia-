import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/env";
import { providerLabel } from "@/lib/utils";
import { sendEmail } from "./send";
import { unsubscribeUrl } from "./tokens";
import {
  abandonedCartEmail,
  certificateEmail,
  courseAnnouncementEmail,
  moduleUnlockedEmail,
  newCourseEmail,
  promotionEmail,
  purchaseEmail,
  questionAnsweredEmail,
  reminderEmail,
  streakReminderEmail,
  welcomeEmail,
} from "./templates";

export async function sendWelcomeEmail(userId: string) {
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id, email, full_name").eq("id", userId).single();
  if (!profile) return;
  return sendEmail({
    to: profile.email,
    userId: profile.id,
    template: "welcome",
    dedupeKey: `welcome:${profile.id}`,
    content: welcomeEmail({ name: profile.full_name, siteUrl }),
  });
}

/** Confirmación de compra + acceso a los cursos (una sola vez por orden). */
export async function sendPurchaseEmail(orderId: string) {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("*, order_items(*), profiles(full_name)")
    .eq("id", orderId)
    .single();
  if (!order || !order.paid_at) return;

  const { data: enrollments } = await admin
    .from("enrollments")
    .select("courses(title, slug)")
    .eq("order_id", orderId);
  const courses = (enrollments ?? [])
    .map((e) => e.courses)
    .filter((c): c is { title: string; slug: string } => Boolean(c));

  return sendEmail({
    to: order.customer_email,
    userId: order.user_id,
    template: "purchase_confirmation",
    dedupeKey: `purchase:${order.id}`,
    content: purchaseEmail({
      name: order.profiles?.full_name ?? order.customer_name ?? "",
      orderNumber: order.order_number,
      currency: order.currency,
      lines: order.order_items.map((i) => ({ title: i.title, totalCents: i.total_cents })),
      subtotalCents: order.subtotal_cents,
      discountCents: order.discount_cents,
      totalCents: order.total_cents,
      paidAt: order.paid_at,
      providerLabel: providerLabel[order.provider] ?? order.provider,
      courses,
      siteUrl,
    }),
  });
}

export async function sendCertificateEmail(userId: string, courseId: string) {
  const admin = createAdminClient();
  const { data: cert } = await admin
    .from("certificates")
    .select("id, code, course_title, student_name, profiles(email)")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (!cert?.profiles?.email) return;
  return sendEmail({
    to: cert.profiles.email,
    userId,
    template: "certificate_issued",
    dedupeKey: `certificate:${cert.id}`,
    content: certificateEmail({ name: cert.student_name, courseTitle: cert.course_title, code: cert.code, siteUrl }),
  });
}

/**
 * Avisa al autor de una pregunta que el equipo la respondió. Solo para
 * respuestas del equipo (is_staff), visibles, y nunca al propio autor de la
 * respuesta. Un correo por respuesta (dedupe).
 */
export async function sendQuestionAnsweredEmail(answerId: string) {
  const admin = createAdminClient();
  const { data: a } = await admin
    .from("lesson_answers")
    .select("id, body, is_staff, hidden_at, user_id, lesson_questions!inner(id, body, user_id, hidden_at, lesson_id, lessons!inner(title), courses!inner(title, slug), profiles!inner(email, full_name))")
    .eq("id", answerId)
    .maybeSingle();
  const q = a?.lesson_questions;
  if (!a || !q || !a.is_staff || a.hidden_at || q.hidden_at || q.user_id === a.user_id || !q.profiles?.email) return null;
  return sendEmail({
    to: q.profiles.email,
    userId: q.user_id,
    template: "question_answered",
    dedupeKey: `answer:${a.id}`,
    content: questionAnsweredEmail({
      name: q.profiles.full_name,
      courseTitle: q.courses.title,
      lessonTitle: q.lessons.title,
      question: q.body,
      answer: a.body,
      href: `${siteUrl}/aprender/${q.courses.slug}/${q.lesson_id}#pregunta-${q.id}`,
      siteUrl,
    }),
  });
}

/**
 * Envía un aviso del curso por correo a los alumnos con acceso vigente que
 * tienen activados los recordatorios y avisos. Un correo por alumno y aviso
 * (dedupe), en lotes pequeños. Guarda en el aviso solo los conteos.
 */
export async function sendCourseAnnouncement(announcementId: string, maxRecipients = 2000) {
  const admin = createAdminClient();
  const { data: a } = await admin
    .from("course_announcements")
    .select("id, title, body, course_id, courses!inner(title, slug)")
    .eq("id", announcementId)
    .maybeSingle();
  if (!a) return null;
  const { data: rows } = await admin
    .from("enrollments")
    .select("user_id, profiles!inner(email, full_name, reminder_opt_in)")
    .eq("course_id", a.course_id)
    .is("revoked_at", null)
    .eq("profiles.reminder_opt_in", true)
    .limit(maxRecipients);
  const tally = { sent: 0, skipped: 0, failed: 0 };
  const list = rows ?? [];
  for (let i = 0; i < list.length; i += 5) {
    const batch = list.slice(i, i + 5);
    const results = await Promise.all(
      batch.map(async (r) => {
        const email = r.profiles.email;
        let unsubscribe = `${siteUrl}/cuenta/ajustes`;
        try {
          unsubscribe = unsubscribeUrl(email);
        } catch {
          /* sin UNSUBSCRIBE_SECRET: se enlaza a Configuración */
        }
        return sendEmail({
          to: email,
          userId: r.user_id,
          template: "course_announcement",
          dedupeKey: `announcement:${a.id}:${r.user_id}`,
          unsubscribeUrl: unsubscribe,
          content: courseAnnouncementEmail({
            name: r.profiles.full_name,
            courseTitle: a.courses.title,
            courseSlug: a.courses.slug,
            title: a.title,
            body: a.body,
            siteUrl,
            unsubscribe,
          }),
        });
      }),
    );
    for (const res of results) {
      if (res.status === "sent" || res.status === "duplicate") tally.sent++;
      else if (res.status === "skipped") tally.skipped++;
      else tally.failed++;
    }
  }
  await admin
    .from("course_announcements")
    .update({ emailed_at: new Date().toISOString(), email_sent: tally.sent, email_skipped: tally.skipped, email_failed: tally.failed })
    .eq("id", a.id);
  return { ...tally, recipients: list.length };
}

/**
 * Recordatorios de aprendizaje: alumnos con un curso sin terminar y sin
 * actividad en 7 días. Como máximo un recordatorio cada 14 días por curso.
 */
export async function runLearningReminders(limit = 200) {
  const admin = createAdminClient();
  const inactiveSince = new Date(Date.now() - 7 * 86400_000).toISOString();
  const remindedBefore = new Date(Date.now() - 14 * 86400_000).toISOString();

  const { data: rows, error } = await admin
    .from("enrollments")
    .select("id, user_id, progress_percent, last_activity_at, created_at, reminder_sent_at, courses(title, slug), profiles!inner(email, full_name, reminder_opt_in)")
    .is("completed_at", null)
    .is("revoked_at", null)
    .eq("profiles.reminder_opt_in", true)
    .or(`last_activity_at.lt.${inactiveSince},and(last_activity_at.is.null,created_at.lt.${inactiveSince})`)
    .or(`reminder_sent_at.is.null,reminder_sent_at.lt.${remindedBefore}`)
    .limit(limit);
  if (error) throw error;

  const results = { sent: 0, skipped: 0, failed: 0 };
  for (const row of rows ?? []) {
    if (!row.courses || !row.profiles) continue;
    const day = new Date().toISOString().slice(0, 10);
    const res = await sendEmail({
      to: row.profiles.email,
      userId: row.user_id,
      template: "learning_reminder",
      dedupeKey: `reminder:${row.id}:${day}`,
      unsubscribeUrl: unsubscribeUrl(row.profiles.email),
      content: reminderEmail({
        name: row.profiles.full_name,
        courseTitle: row.courses.title,
        courseSlug: row.courses.slug,
        progress: row.progress_percent,
        siteUrl,
        unsubscribe: unsubscribeUrl(row.profiles.email),
      }),
    });
    if (res.status === "sent") {
      results.sent++;
      await admin.from("enrollments").update({ reminder_sent_at: new Date().toISOString() }).eq("id", row.id);
    } else if (res.status === "failed") results.failed++;
    else results.skipped++;
  }
  return results;
}

/**
 * Aviso de racha por perderse: la base elige a los alumnos (recordatorios
 * activados, racha de 2+ días hasta ayer, sin actividad hoy, tarde-noche en su
 * zona horaria, máximo uno cada 3 días). Un solo intento por alumno y día local.
 */
export async function runStreakReminders(limit = 500) {
  const admin = createAdminClient();
  const { data: rows, error } = await admin.rpc("streak_reminder_candidates", { p_limit: limit });
  if (error) throw error;

  const results = { candidates: rows?.length ?? 0, sent: 0, skipped: 0, failed: 0, duplicate: 0 };
  for (const row of rows ?? []) {
    const unsubscribe = unsubscribeUrl(row.email);
    const res = await sendEmail({
      to: row.email,
      userId: row.user_id,
      template: "streak_reminder",
      dedupeKey: `streak:${row.user_id}:${row.local_date}`,
      unsubscribeUrl: unsubscribe,
      content: streakReminderEmail({
        name: row.full_name,
        streak: row.streak,
        courseTitle: row.course_title,
        courseSlug: row.course_slug,
        siteUrl,
        unsubscribe,
      }),
    });
    results[res.status]++;
  }
  return results;
}

/**
 * Avisa que se liberó un módulo programado. Seguro de llamar varias veces al
 * día: la base elige los módulos liberados en las últimas 48 h y el envío se
 * deduplica por alumno y módulo.
 */
export async function runModuleUnlockEmails(limit = 500) {
  const admin = createAdminClient();
  const { data: rows, error } = await admin.rpc("module_unlock_candidates", { p_limit: limit });
  if (error) throw error;
  const results = { candidates: rows?.length ?? 0, sent: 0, skipped: 0, failed: 0, duplicate: 0 };
  for (const row of rows ?? []) {
    const unsubscribe = unsubscribeUrl(row.email);
    const href = `${siteUrl}/aprender/${row.course_slug}/${row.first_lesson_id}`;
    const res = await sendEmail({
      to: row.email,
      userId: row.user_id,
      template: "module_unlocked",
      dedupeKey: `unlock:${row.module_id}:${row.user_id}`,
      unsubscribeUrl: unsubscribe,
      content: moduleUnlockedEmail({ name: row.full_name, courseTitle: row.course_title, moduleTitle: row.module_title, href, siteUrl, unsubscribe }),
    });
    results[res.status]++;
  }
  return results;
}

/**
 * Recuperación de carritos abandonados: carritos sin cambios desde hace 3 h
 * (y menos de 7 días), con productos y sin recordatorio previo.
 */
export async function runAbandonedCartRecovery(limit = 200) {
  const admin = createAdminClient();
  const olderThan = new Date(Date.now() - 3 * 3600_000).toISOString();
  const newerThan = new Date(Date.now() - 7 * 86400_000).toISOString();

  const { data: carts, error } = await admin
    .from("carts")
    .select("user_id, updated_at, profiles!inner(email, full_name, marketing_opt_in), cart_items(id, courses(title), bundles(title))")
    .is("reminder_sent_at", null)
    .lt("updated_at", olderThan)
    .gt("updated_at", newerThan)
    .eq("profiles.marketing_opt_in", true)
    .limit(limit);
  if (error) throw error;

  const results = { sent: 0, skipped: 0, failed: 0 };
  for (const cart of carts ?? []) {
    const items = (cart.cart_items ?? [])
      .map((i) => ({ title: i.courses?.title ?? i.bundles?.title ?? "" }))
      .filter((i) => i.title);
    if (items.length === 0 || !cart.profiles) continue;
    const res = await sendEmail({
      to: cart.profiles.email,
      userId: cart.user_id,
      template: "abandoned_cart",
      dedupeKey: `cart:${cart.user_id}:${cart.updated_at}`,
      unsubscribeUrl: unsubscribeUrl(cart.profiles.email),
      content: abandonedCartEmail({
        name: cart.profiles.full_name,
        items,
        siteUrl,
        unsubscribe: unsubscribeUrl(cart.profiles.email),
      }),
    });
    if (res.status === "sent") {
      results.sent++;
      await admin.from("carts").update({ reminder_sent_at: new Date().toISOString() }).eq("user_id", cart.user_id);
    } else if (res.status === "failed") results.failed++;
    else results.skipped++;
  }
  return results;
}

/** Destinatarios de marketing: alumnos con opt-in + suscriptores del boletín. */
async function marketingAudience() {
  const admin = createAdminClient();
  const [{ data: profiles }, { data: subs }] = await Promise.all([
    admin.from("profiles").select("id, email").eq("marketing_opt_in", true),
    admin.from("newsletter_subscribers").select("email").is("unsubscribed_at", null),
  ]);
  const map = new Map<string, string | null>();
  for (const s of subs ?? []) map.set(String(s.email).toLowerCase(), null);
  for (const p of profiles ?? []) map.set(String(p.email).toLowerCase(), p.id);
  return [...map.entries()].map(([email, userId]) => ({ email, userId }));
}

export async function announceNewCourse(courseId: string) {
  const admin = createAdminClient();
  const { data: course } = await admin.from("courses").select("id, title, subtitle, slug, status").eq("id", courseId).single();
  if (!course || course.status !== "published") throw new Error("Solo se pueden anunciar cursos publicados.");
  const audience = await marketingAudience();
  const results = { sent: 0, skipped: 0, failed: 0, duplicate: 0 };
  for (const r of audience) {
    const res = await sendEmail({
      to: r.email,
      userId: r.userId,
      template: "new_course",
      dedupeKey: `new_course:${course.id}:${r.email}`,
      unsubscribeUrl: unsubscribeUrl(r.email),
      content: newCourseEmail({
        courseTitle: course.title,
        subtitle: course.subtitle,
        courseSlug: course.slug,
        siteUrl,
        unsubscribe: unsubscribeUrl(r.email),
      }),
    });
    results[res.status]++;
  }
  return results;
}

export async function sendPromotion(campaign: { id: string; subject: string; message: string; ctaLabel: string; ctaUrl: string }) {
  const audience = await marketingAudience();
  const results = { sent: 0, skipped: 0, failed: 0, duplicate: 0 };
  for (const r of audience) {
    const res = await sendEmail({
      to: r.email,
      userId: r.userId,
      template: "promotion",
      dedupeKey: `promo:${campaign.id}:${r.email}`,
      unsubscribeUrl: unsubscribeUrl(r.email),
      content: promotionEmail({ ...campaign, siteUrl, unsubscribe: unsubscribeUrl(r.email) }),
    });
    results[res.status]++;
  }
  return results;
}
