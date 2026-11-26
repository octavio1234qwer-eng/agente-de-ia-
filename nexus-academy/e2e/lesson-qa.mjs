// E2E de preguntas y respuestas por lección.
// Ejecutar con el entorno arriba: node e2e/lesson-qa.mjs
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
const password = "Preguntas123";
const people = {
  ana: { email: `ana.qa.${ts}@test.dev`, name: "Ana Gómez Pérez" },
  beto: { email: `beto.qa.${ts}@test.dev`, name: "Beto Ruiz" },
  carla: { email: `carla.qa.${ts}@test.dev`, name: "Carla Curiosa" },
  admin: { email: `admin.qa.${ts}@test.dev`, name: "Diana Docente" },
};
for (const p of Object.values(people)) {
  const { data } = await admin.auth.admin.createUser({ email: p.email, password, email_confirm: true, user_metadata: { full_name: p.name } });
  p.id = data.user.id;
}
await admin.from("profiles").update({ role: "admin" }).eq("id", people.admin.id);

const browser = await pw.chromium.launch();
const errors = [];
async function login(who, viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${who}: ${e}`));
  page.on("dialog", (d) => d.accept());
  await page.goto(`${BASE}/login`);
  await page.fill("#email", people[who].email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
  return page;
}
async function enrollAndOpen(page) {
  await page.goto(`${BASE}/cursos/git-github-esencial`);
  await page.click("text=Inscribirme gratis");
  await page.waitForURL(/\/aprender\/git-github-esencial\/[0-9a-f-]{36}/, { timeout: 20000 });
  return page.url().split(/[?#]/)[0];
}
const article = (page, text) => page.locator("article", { hasText: text });

// Restos de corridas anteriores interrumpidas (mismo texto de prueba).
await admin.from("lesson_questions").delete().like("body", "%git add va antes de commit%");

// ---------------------------------------------------------------- Ana pregunta
const ana = await login("ana");
let alerted = false;
ana.on("dialog", (d) => { if (d.type() === "alert") alerted = true; });
const lessonUrl = await enrollAndOpen(ana);
const lessonId = lessonUrl.split("/").pop();
check(await ana.isVisible("#preguntas"), "la lección muestra «Preguntas de la lección»");
check(await ana.isVisible("text=Aún no hay preguntas en esta lección"), "estado vacío que invita a preguntar");
const publish = ana.locator('button:has-text("Publicar pregunta")');
await ana.fill("#qa-ask", "abc");
check(await publish.isDisabled(), "no deja publicar preguntas de menos de 5 caracteres");
const question = `¿Por qué git add va antes de commit? ${ts}\n<script>alert('x')</script>`;
await ana.fill("#qa-ask", question);
await publish.click();
await ana.waitForSelector("#qa-ask-status:has-text('Publicamos tu pregunta')", { timeout: 15000 });
check((await ana.inputValue("#qa-ask")) === "", "el campo se vacía al publicar");
const anaQ = article(ana, String(ts));
await anaQ.waitFor({ timeout: 15000 });
check((await anaQ.innerText()).includes("Ana G. (tú)"), "la autora se ve a sí misma como «Ana G. (tú)»");
check((await anaQ.innerText()).includes("<script>alert('x')</script>") && !alerted, "el HTML de la pregunta se muestra como texto y no se ejecuta");
const { data: dbQ } = await admin.from("lesson_questions").select("id, course_id, lesson_id").like("body", `%${ts}%`).single();
const { data: git } = await admin.from("courses").select("id").eq("slug", "git-github-esencial").single();
check(dbQ?.course_id === git.id && dbQ?.lesson_id === lessonId, "la pregunta queda ligada a la lección y al curso correctos");

// ---------------------------------------------------------------- Beto la ve y responde
const beto = await login("beto");
await enrollAndOpen(beto);
await beto.goto(lessonUrl);
const betoQ = article(beto, String(ts));
await betoQ.waitFor({ timeout: 15000 });
const betoView = await betoQ.innerText();
check(betoView.includes("Ana G.") && !betoView.includes("Gómez") && !(await beto.content()).includes(people.ana.email), "otro alumno ve «Ana G.», sin apellido completo ni correo");
check((await betoQ.locator('button:has-text("Editar")').count()) === 0, "otro alumno no puede editar la pregunta ajena");
await betoQ.locator('button:has-text("Responder")').click();
await betoQ.locator("textarea").fill("Porque add prepara los cambios y commit los guarda.");
await betoQ.locator('button:has-text("Publicar respuesta")').click();
await betoQ.locator("text=Respuesta publicada.").waitFor({ timeout: 15000 });
await betoQ.locator("li", { hasText: "Beto R. (tú)" }).waitFor({ timeout: 15000 });
check(!(await betoQ.innerText()).includes("Respondida por el equipo"), "la respuesta de un alumno no cuenta como del equipo");

// ---------------------------------------------------------------- Admin responde desde la bandeja
const adm = await login("admin");
await adm.goto(`${BASE}/admin`);
check(await adm.isVisible("text=/esperan? respuesta/"), "el dashboard avisa de preguntas sin responder");
await adm.goto(`${BASE}/admin/preguntas`);
const row = adm.locator("tr", { hasText: String(ts) });
check(await row.isVisible() && (await row.innerText()).includes(people.ana.email) && (await row.innerText()).includes("Sin responder"), "la bandeja muestra la pregunta pendiente con el correo del alumno");
const axeInbox = await new AxeBuilder({ page: adm }).withTags(TAGS).analyze();
check(axeInbox.violations.length === 0, `bandeja de preguntas sin infracciones de accesibilidad${axeInbox.violations.length ? `: ${axeInbox.violations.map((v) => v.id).join(", ")}` : ""}`);
await row.locator("text=Responder en el aula").click();
await adm.waitForURL((u) => u.pathname === new URL(lessonUrl).pathname && u.hash === `#pregunta-${dbQ.id}`, { timeout: 20000 });
const admQ = adm.locator(`#pregunta-${dbQ.id}`);
await admQ.locator('button:has-text("Responder")').click();
await admQ.locator("textarea").fill("Exacto. Con git add eliges qué entra al siguiente commit.");
await admQ.locator('button:has-text("Publicar respuesta")').click();
await admQ.locator("text=Respuesta publicada.").waitFor({ timeout: 15000 });
check(await admQ.locator("text=omitido").isVisible(), "sin Resend, el aviso por correo se reporta como omitido (no se finge)");
await admQ.locator("text=Respondida por el equipo").waitFor({ timeout: 15000 });
check(await admQ.locator("li", { hasText: "Con git add eliges" }).getByText("Equipo", { exact: true }).isVisible(), "la respuesta del admin lleva la insignia «Equipo»");
const { data: mail } = await admin.from("email_log").select("status, template, to_email").eq("user_id", people.ana.id).eq("template", "question_answered").maybeSingle();
check(mail?.status === "skipped" && mail?.to_email === people.ana.email, "el aviso a la autora queda registrado en el log de correos");
await adm.goto(`${BASE}/admin/preguntas`);
check(!(await adm.locator("tr", { hasText: String(ts) }).isVisible()), "respondida, sale de «Sin responder»");
await adm.goto(`${BASE}/admin/preguntas?filtro=all`);
check((await adm.locator("tr", { hasText: String(ts) }).innerText()).includes("Respondida"), "en «Todas» aparece como respondida");

// ---------------------------------------------------------------- Ana ve la respuesta y edita su pregunta
await ana.goto(lessonUrl);
await anaQ.waitFor();
check((await anaQ.innerText()).includes("Respondida por el equipo") && (await anaQ.innerText()).includes("Con git add eliges"), "la autora ve la respuesta del equipo");
const axeLesson = await new AxeBuilder({ page: ana }).include("#preguntas").withTags(TAGS).analyze();
check(axeLesson.violations.length === 0, `sección de preguntas sin infracciones de accesibilidad${axeLesson.violations.length ? `: ${axeLesson.violations.map((v) => v.id).join(", ")}` : ""}`);
await anaQ.locator('button:has-text("Editar")').first().click();
await anaQ.locator("textarea").fill(`¿Por qué git add va antes de commit? (editada) ${ts}`);
await anaQ.locator('button:has-text("Guardar cambios")').click();
const editedOk = await ana.waitForSelector(`article:has-text("(editada) ${ts}"):has-text("· editado")`, { timeout: 15000 }).then(() => true, () => false);
check(editedOk, "la edición se guarda y se marca como editada");

// ---------------------------------------------------------------- Carla sin inscripción
const carla = await login("carla");
await carla.goto(lessonUrl);
check(!(await carla.isVisible("#preguntas")) && !(await carla.content()).includes(String(ts)), "quien no está inscrito no ve las preguntas");

// ---------------------------------------------------------------- Moderación
await adm.goto(`${BASE}/admin/preguntas?filtro=all`);
await adm.locator("tr", { hasText: String(ts) }).locator('button:has-text("Ocultar")').click();
await adm.waitForSelector(`tr:has-text("${ts}") >> text=Oculta`, { timeout: 15000 });
await beto.goto(lessonUrl);
check(!(await beto.content()).includes(String(ts)), "una pregunta oculta desaparece para los demás alumnos");
await ana.goto(lessonUrl);
const hiddenQ = article(ana, String(ts));
check(await hiddenQ.locator("text=Oculta por moderación").isVisible() && (await hiddenQ.locator('button:has-text("Editar")').count()) === 0, "la autora la ve como oculta y ya no puede editarla");
check((await hiddenQ.locator('button:has-text("Responder")').count()) === 0, "una pregunta oculta no acepta respuestas");

// ---------------------------------------------------------------- Datos personales y móvil
const exported = await ana.request.get(`${BASE}/api/account/export`);
const json = await exported.json();
check(json.preguntas_en_lecciones?.some((q) => q.body.includes(String(ts))), "«Descargar mis datos» incluye sus preguntas");
const mobile = await login("ana", { width: 360, height: 780 });
await mobile.goto(lessonUrl);
const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check(overflow <= 0, `sin desbordamiento horizontal en 360 px (${overflow}px)`);

// ---------------------------------------------------------------- Borrado
await adm.goto(`${BASE}/admin/preguntas?filtro=hidden`);
await adm.locator("tr", { hasText: String(ts) }).locator('button:has-text("Eliminar")').click();
await adm.waitForFunction((t) => !document.body.innerText.includes(t), String(ts), { timeout: 15000 });
const { count: left } = await admin.from("lesson_answers").select("id", { count: "exact", head: true }).eq("question_id", dbQ.id);
const { data: gone } = await admin.from("lesson_questions").select("id").eq("id", dbQ.id).maybeSingle();
check(!gone && left === 0, "al eliminar la pregunta se eliminan sus respuestas");
const { data: auditRows } = await admin.from("admin_audit_log").select("action").eq("entity_id", dbQ.id);
check(["hide", "delete"].every((a) => auditRows?.some((r) => r.action === a)), "ocultar y eliminar quedan en la auditoría");

check(errors.length === 0, `sin errores de JavaScript en las páginas${errors.length ? `: ${errors.join(" | ")}` : ""}`);
await browser.close();
for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
console.log(failures ? `\n${failures} verificaciones fallaron` : "\nTodo OK");
process.exit(failures ? 1 : 0);
