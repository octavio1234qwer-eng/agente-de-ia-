// E2E de avisos del curso.
// Ejecutar con el entorno arriba: node e2e/course-announcements.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { AxeBuilder } from "@axe-core/playwright";
import pw from "playwright";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let failures = 0;
const check = (c, l) => { console.log(c ? "✔" : "✘", l); if (!c) failures++; };
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const ts = Date.now();
const password = "Avisos12345";
const people = {
  ana: { email: `ana.av.${ts}@test.dev`, name: "Ana Avisos" },
  beto: { email: `beto.av.${ts}@test.dev`, name: "Beto Sinavisos" },
  carla: { email: `carla.av.${ts}@test.dev`, name: "Carla Curiosa" },
  admin: { email: `admin.av.${ts}@test.dev`, name: "Diana Docente" },
};
for (const p of Object.values(people)) {
  const { data } = await admin.auth.admin.createUser({ email: p.email, password, email_confirm: true, user_metadata: { full_name: p.name } });
  p.id = data.user.id;
}
await admin.from("profiles").update({ role: "admin" }).eq("id", people.admin.id);
await admin.from("profiles").update({ reminder_opt_in: false }).eq("id", people.beto.id);
const { data: git } = await admin.from("courses").select("id").eq("slug", "git-github-esencial").single();

const browser = await pw.chromium.launch();
const errors = [];
let alerts = 0;
async function login(who, viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${who}: ${e}`));
  page.on("dialog", (d) => { if (d.type() === "alert") alerts++; d.accept(); });
  await page.goto(`${BASE}/login`);
  await page.fill("#email", people[who].email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
  return page;
}
async function waitSeen(userId, after) {
  for (let i = 0; i < 40; i++) {
    const { data } = await admin.from("enrollments").select("announcements_seen_at").eq("user_id", userId).eq("course_id", git.id).maybeSingle();
    if (data?.announcements_seen_at && new Date(data.announcements_seen_at).getTime() >= after) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}
async function enroll(page) {
  await page.goto(`${BASE}/cursos/git-github-esencial`);
  await page.click("text=Inscribirme gratis");
  await page.waitForURL(/\/aprender\/git-github-esencial\/[0-9a-f-]{36}/, { timeout: 20000 });
  return page.url().split(/[?#]/)[0];
}

// Ana y Beto inscritos (Beto con recordatorios y avisos desactivados); Carla no.
const ana = await login("ana");
const lessonUrl = await enroll(ana);
const beto = await login("beto");
await enroll(beto);
// Avisos de corridas anteriores: Ana los marca como vistos para empezar en cero.
const before = Date.now() - 5000;
await ana.goto(`${BASE}/aprender/git-github-esencial/avisos`);
check(await waitSeen(people.ana.id, before), "abrir los avisos los marca como vistos");

// ---------------------------------------------------------------- Admin publica
const adm = await login("admin");
await adm.goto(`${BASE}/admin/cursos/${git.id}`);
await adm.click("text=Avisos");
await adm.waitForURL(`**/admin/cursos/${git.id}/avisos`, { timeout: 15000 });
const recipientsText = await adm.locator("label", { hasText: "Enviar también por correo" }).innerText();
const { count: expected } = await admin.from("enrollments").select("user_id, profiles!inner(reminder_opt_in)", { count: "exact", head: true }).eq("course_id", git.id).is("revoked_at", null).eq("profiles.reminder_opt_in", true);
check(recipientsText.includes(`${expected} alumno`), `muestra a cuántos alumnos llegaría el correo (${expected}, sin quien desactivó avisos)`);
const axeAdmin = await new AxeBuilder({ page: adm }).withTags(TAGS).analyze();
check(axeAdmin.violations.length === 0, `página de avisos del admin sin infracciones de accesibilidad${axeAdmin.violations.length ? `: ${axeAdmin.violations.map((v) => v.id).join(", ")}` : ""}`);
const title = `Sesión en vivo el jueves ${ts}`;
await adm.fill("#announcement-title", title);
await adm.fill("#announcement-body", "Nos vemos a las **7 pm**.\n\n- Trae tus dudas\n- <script>alert('x')</script>");
await adm.check('input[name="send_email"]');
await adm.click('button:has-text("Publicar aviso")');
await adm.waitForSelector("text=Aviso publicado.", { timeout: 30000 });
check(await adm.isVisible("text=/omitido/"), "sin Resend, el correo se reporta como omitido (no se finge)");
check((await adm.inputValue("#announcement-title")) === "", "el formulario se vacía al publicar");
const { data: row } = await admin.from("course_announcements").select("id, emailed_at, email_sent, email_skipped, email_failed").ilike("title", `%${ts}%`).single();
check(Boolean(row?.emailed_at) && row.email_sent === 0 && row.email_skipped === expected && row.email_failed === 0, "el aviso guarda solo los conteos del envío");
const { data: logs } = await admin.from("email_log").select("user_id, status").eq("template", "course_announcement").like("dedupe_key", `announcement:${row.id}:%`);
check(logs?.some((l) => l.user_id === people.ana.id) && !logs?.some((l) => l.user_id === people.beto.id), "llega a quien tiene avisos activados y no a quien los desactivó");
check(!logs?.some((l) => l.user_id === people.carla.id), "no llega a quien no está inscrito");
const card = adm.locator("article", { hasText: title });
check((await card.innerText()).includes(`${expected} omitido(s)`), "la lista del admin muestra el resultado del correo");

// ---------------------------------------------------------------- Ana lo ve
await ana.goto(lessonUrl);
const banner = ana.locator("a", { hasText: "Nuevo aviso del curso" });
check(await banner.isVisible() && (await banner.innerText()).includes(title), "la lección muestra el aviso nuevo con su título");
check(await ana.locator('nav[aria-label="Contenido del curso"] a', { hasText: "Avisos del curso" }).first().innerText().then((t) => t.includes("1")), "el temario indica 1 aviso nuevo");
await ana.goto(`${BASE}/cuenta/cursos`);
check(await ana.isVisible(`text=Nuevo aviso: ${title}`), "«Mis cursos» muestra el aviso nuevo");
await ana.click(`text=Nuevo aviso: ${title}`);
await ana.waitForURL("**/aprender/git-github-esencial/avisos", { timeout: 15000 });
const annArticle = ana.locator("article", { hasText: title });
check(await annArticle.locator("text=Nuevo").isVisible(), "el aviso aparece marcado como nuevo");
check(await annArticle.locator("strong", { hasText: "7 pm" }).isVisible(), "el Markdown del aviso se muestra con formato");
check((await ana.locator("article script").count()) === 0 && alerts === 0, "el HTML crudo del aviso se descarta y nunca se ejecuta");
const axeStudent = await new AxeBuilder({ page: ana }).withTags(TAGS).analyze();
check(axeStudent.violations.length === 0, `avisos del alumno sin infracciones de accesibilidad${axeStudent.violations.length ? `: ${axeStudent.violations.map((v) => v.id).join(", ")}` : ""}`);
check(await waitSeen(people.ana.id, Date.now() - 5000), "leerlos actualiza su «visto»");
await ana.goto(lessonUrl);
check(!(await ana.isVisible("text=Nuevo aviso del curso")), "después de leerlo ya no aparece como nuevo en la lección");
await ana.goto(`${BASE}/cuenta/cursos`);
check(!(await ana.isVisible(`text=Nuevo aviso: ${title}`)), "ni en «Mis cursos»");

// Beto lleva su propio conteo
await beto.goto(lessonUrl);
check(await beto.locator("a", { hasText: title }).isVisible(), "otro alumno conserva su aviso sin leer");

// ---------------------------------------------------------------- Carla sin inscripción
const carla = await login("carla");
await carla.goto(`${BASE}/aprender/git-github-esencial/avisos`);
check(new URL(carla.url()).pathname === "/cursos/git-github-esencial" && !(await carla.content()).includes(title), "sin inscripción no puede leer los avisos");

// ---------------------------------------------------------------- Editar no reenvía; un alumno no puede publicar
await adm.goto(`${BASE}/admin/cursos/${git.id}/avisos`);
await adm.locator("article", { hasText: title }).locator("text=Editar").click();
await adm.waitForURL(/editar=/, { timeout: 15000 });
check(await adm.isVisible("text=Este aviso ya se envió por correo"), "un aviso ya enviado no ofrece reenviarlo");
await adm.fill("#announcement-title", `${title} (cambio de sala)`);
await adm.click('button:has-text("Guardar cambios")');
await adm.waitForSelector("text=Aviso actualizado.", { timeout: 15000 });
const { count: logCount } = await admin.from("email_log").select("id", { count: "exact", head: true }).like("dedupe_key", `announcement:${row.id}:%`);
check(logCount === logs.length, "editar no vuelve a enviar el correo");
const { error: studentInsert } = await createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  .from("course_announcements").insert({ course_id: git.id, title: "falso", body: "x" });
check(Boolean(studentInsert), "sin sesión de admin no se pueden publicar avisos");

// ---------------------------------------------------------------- Móvil y borrado
const mobile = await login("beto", { width: 360, height: 780 });
await mobile.goto(`${BASE}/aprender/git-github-esencial/avisos`);
const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check(overflow <= 0, `sin desbordamiento horizontal en 360 px (${overflow}px)`);
await adm.goto(`${BASE}/admin/cursos/${git.id}/avisos`);
await adm.locator("article", { hasText: title }).locator('button:has-text("Eliminar")').click();
await adm.waitForFunction((t) => !document.body.innerText.includes(t), title, { timeout: 15000 });
await beto.goto(`${BASE}/aprender/git-github-esencial/avisos`);
check(!(await beto.content()).includes(title), "un aviso eliminado desaparece para los alumnos");
const { data: auditRows } = await admin.from("admin_audit_log").select("action").eq("entity_id", row.id);
check(["create", "email", "update", "delete"].every((a) => auditRows?.some((r) => r.action === a)), "publicar, enviar, editar y eliminar quedan en la auditoría");

check(errors.length === 0, `sin errores de JavaScript en las páginas${errors.length ? `: ${errors.join(" | ")}` : ""}`);
await browser.close();
for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
console.log(failures ? `\n${failures} verificaciones fallaron` : "\nTodo OK");
process.exit(failures ? 1 : 0);
