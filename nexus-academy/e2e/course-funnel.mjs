// E2E: embudo por curso en el admin (/admin/cursos/[id]/embudo) con progreso real.
// Ejecutar con el entorno arriba: node e2e/course-funnel.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import pw from "playwright";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let failures = 0;
const check = (c, l) => { console.log(c ? "✔" : "✘", l); if (!c) failures++; };
const must = ({ data, error }) => { if (error) throw error; return data; };

const ts = Date.now();
const password = "Embudo12345";
const mk = async (tag) => (await admin.auth.admin.createUser({ email: `embudo.${tag}.${ts}@test.dev`, password, email_confirm: true, user_metadata: { full_name: `Embudo ${tag}` } })).data.user;
const adm = await mk("admin");
await admin.from("profiles").update({ role: "admin" }).eq("id", adm.id);
const s = [];
for (let i = 1; i <= 6; i++) s.push(await mk(`a${i}`));

// Curso aislado y publicado: Módulo 1 = A, B · Módulo 2 = C
const course = must(await admin.from("courses").insert({ slug: `embudo-${ts}`, title: `Embudo E2E ${ts}`, status: "published" }).select("id, slug").single());
const [m1, m2] = must(await admin.from("modules").insert([{ course_id: course.id, title: "Módulo 1", position: 0 }, { course_id: course.id, title: "Módulo 2", position: 1 }]).select("id, position").order("position"));
const lessons = must(await admin.from("lessons").insert([
  { module_id: m1.id, course_id: course.id, title: "Lección A", type: "article", position: 0 },
  { module_id: m1.id, course_id: course.id, title: "Lección B", type: "article", position: 1 },
  { module_id: m2.id, course_id: course.id, title: "Lección C", type: "article", position: 0 },
]).select("id, title"));
const L = Object.fromEntries(lessons.map((l) => [l.title.slice(-1), l.id]));
const done = (u, k) => ({ user_id: u.id, lesson_id: L[k], course_id: course.id, completed_at: new Date().toISOString(), last_position_seconds: 0 });
must(await admin.from("lesson_progress").insert([
  done(s[0], "A"), done(s[0], "B"), done(s[0], "C"),           // 1: terminó
  done(s[1], "A"),                                              // 2: detenido en B
  done(s[2], "A"), done(s[2], "B"), { ...done(s[2], "C"), completed_at: null, last_position_seconds: 30 }, // 3: detenido en C
  done(s[4], "A"), done(s[4], "C"),                             // 5: saltó B
  done(s[5], "A"),                                              // 6: acceso revocado
]));
must(await admin.from("enrollments").insert(s.map((u, i) => ({ user_id: u.id, course_id: course.id, source: "admin_grant", completed_at: i === 0 ? new Date().toISOString() : null, revoked_at: i === 5 ? new Date().toISOString() : null }))));
// 4 (s[3]) inscrito sin empezar

const browser = await pw.chromium.launch();
const errors = [];
async function login(email) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => u.pathname !== "/login", { timeout: 20000 });
  return page;
}
const clean = (t) => t.replace(/\s+/g, " ").trim();
const rowsText = async (page) => Promise.all((await page.locator('[data-testid="funnel-row"]').all()).map(async (r) => clean(await r.innerText())));

const page = await login(adm.email);
await page.goto(`${BASE}/admin/cursos/${course.id}`);
await page.click("a:has-text('Embudo de alumnos')");
await page.waitForURL(`**/admin/cursos/${course.id}/embudo`);
const summary = clean(await page.locator('[data-testid="funnel-summary"]').innerText());
check(summary.includes("Inscritos 5") && summary.includes("Empezaron 4 (80 %)") && summary.includes("Sin empezar 1") && summary.includes("Terminaron 1") && summary.includes("Tasa de finalización 20 %"),
  `resumen: sin revocados (${summary})`);
let rows = await rowsText(page);
check(rows.length === 3 && rows[0].startsWith("1 Lección A Módulo 1") && rows[2].startsWith("3 Lección C Módulo 2"), "lecciones en el orden del temario");
check(rows[0].endsWith("4 · 100 % 0") && rows[1].endsWith("2 · 50 % 2") && rows[2].endsWith("2 · 50 % 1"), `completaron y detenidos por lección (${rows.join(" | ")})`);
check(clean(await page.locator('[data-testid="top-dropoffs"] li').first().innerText()).startsWith("Lección 2: Lección B (Módulo 1) — 2 alumnos detenidos"), "señala la lección donde más se detienen");

// Progreso real: el alumno 2 completa la lección B en el aula
const student = await login(s[1].email);
await student.goto(`${BASE}/aprender/${course.slug}/${L.B}`);
await student.click("button:has-text('Marcar como completada')");
await student.waitForSelector("button:has-text('Completada')");
await page.reload();
rows = await rowsText(page);
check(rows[1].endsWith("3 · 75 % 1") && rows[2].endsWith("2 · 50 % 2"), `al completar B en el aula, el alumno pasa a estar detenido en C (${rows.join(" | ")})`);

// Permisos y casos borde
await student.goto(`${BASE}/admin/cursos/${course.id}/embudo`);
check(!new URL(student.url()).pathname.startsWith("/admin"), "un alumno no entra al embudo");
const r404 = await page.goto(`${BASE}/admin/cursos/00000000-0000-4000-8000-000000000000/embudo`);
check(r404.status() === 404, "un curso inexistente responde 404");
const empty = must(await admin.from("courses").insert({ slug: `embudo-vacio-${ts}`, title: `Embudo vacío ${ts}` }).select("id").single());
await page.goto(`${BASE}/admin/cursos/${empty.id}/embudo`);
check(await page.isVisible("text=Aún no hay alumnos inscritos en este curso."), "un curso sin alumnos lo dice");
check(!(await page.content()).includes(s[1].email), "el embudo no muestra datos personales");
check(errors.length === 0, `sin errores de JavaScript${errors.length ? `: ${errors.join(" | ")}` : ""}`);
await browser.close();
console.log(failures ? `\n${failures} fallo(s)` : "\nTodo OK");
process.exit(failures ? 1 : 0);
