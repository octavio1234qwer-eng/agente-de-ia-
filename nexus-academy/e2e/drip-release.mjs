// E2E de la liberación programada de módulos («drip»).
// Ejecutar con el entorno arriba: node e2e/drip-release.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { AxeBuilder } from "@axe-core/playwright";
import pw from "playwright";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let failures = 0;
const check = (c, l) => { console.log(c ? "✔" : "✘", l); if (!c) failures++; };
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const ts = Date.now();
const password = "Drip12345!";
const people = { ana: `ana.drip.${ts}@test.dev`, admin: `admin.drip.${ts}@test.dev` };
const ids = {};
for (const [k, email] of Object.entries(people)) {
  const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: k === "ana" ? "Ana Drip" : "Diana Docente" } });
  ids[k] = data.user.id;
}
await admin.from("profiles").update({ role: "admin" }).eq("id", ids.admin);

// Curso gratuito de prueba: módulo 1 abierto, módulo 2 con una lección normal y una vista previa.
const course = must(await admin.from("courses").insert({ slug: `drip-${ts}`, title: `Drip E2E ${ts}`, status: "published", price_cents: 0 }).select("id, slug").single());
const [m1, m2] = must(await admin.from("modules").insert([{ course_id: course.id, title: "Semana 1", position: 0 }, { course_id: course.id, title: "Semana 2", position: 1 }]).select("id, position").order("position"));
const lessons = must(await admin.from("lessons").insert([
  { module_id: m1.id, course_id: course.id, title: "Bienvenida", type: "article", position: 0, is_preview: false },
  { module_id: m2.id, course_id: course.id, title: "Contenido de la semana 2", type: "article", position: 0, is_preview: false },
  { module_id: m2.id, course_id: course.id, title: "Adelanto gratis", type: "article", position: 1, is_preview: true },
]).select("id, title"));
const L = Object.fromEntries(lessons.map((l) => [l.title, l.id]));
const secret = `secreto-semana-2-${ts}`;
const word = `zafiro${ts.toString(36).replace(/[0-9]/g, (d) => "abcdefghij"[d])}`;
must(await admin.from("lesson_contents").upsert([
  { lesson_id: L["Bienvenida"], body: "Hola, empieza aquí." },
  { lesson_id: L["Contenido de la semana 2"], body: `Este texto solo se ve en la semana 2: ${secret}. Palabra clave: ${word}.` },
  { lesson_id: L["Adelanto gratis"], body: "Adelanto disponible para todos." },
], { onConflict: "lesson_id" }).select("lesson_id"));

const browser = await pw.chromium.launch();
const errors = [];
async function login(who, viewport = { width: 1280, height: 900 }) {
  const page = await (await browser.newContext({ viewport })).newPage();
  page.on("pageerror", (e) => errors.push(`${who}: ${e}`));
  page.on("dialog", (d) => d.accept());
  await page.goto(`${BASE}/login`);
  await page.fill("#email", people[who]);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
  return page;
}

// ---------------------------------------------------------------- Admin programa el módulo 2
const adm = await login("admin");
await adm.goto(`${BASE}/admin/cursos/${course.id}`);
await adm.fill(`#release-${m2.id}`, "7");
await adm.locator("form", { has: adm.locator(`#release-${m2.id}`) }).locator('button:has-text("Guardar")').click();
await adm.waitForSelector("text=Programado: se abre a los 7 días.", { timeout: 15000 });
const { data: mod } = await admin.from("modules").select("release_after_days").eq("id", m2.id).single();
check(mod.release_after_days === 7, "el admin programa el módulo 2 a 7 días de la inscripción");
const axeAdmin = await new AxeBuilder({ page: adm }).withTags(TAGS).analyze();
check(axeAdmin.violations.length === 0, `editor del curso sin infracciones de accesibilidad${axeAdmin.violations.length ? `: ${axeAdmin.violations.map((v) => v.id).join(", ")}` : ""}`);

// ---------------------------------------------------------------- Página pública
const ana = await login("ana");
await ana.goto(`${BASE}/cursos/${course.slug}`);
check(await ana.isVisible("text=Se libera 1 semana después de inscribirte"), "el temario público avisa cuándo se libera el módulo 2");
await ana.click("text=Inscribirme gratis");
await ana.waitForURL(new RegExp(`/aprender/${course.slug}/${L["Bienvenida"]}`), { timeout: 20000 });
check(true, "al inscribirse entra a la primera lección disponible");

// ---------------------------------------------------------------- Aula: módulo 2 cerrado
const nav = ana.locator('nav[aria-label="Contenido del curso"]').first();
const expectedDate = new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", dateStyle: "medium" }).format(new Date(Date.now() + 7 * 86400000));
check((await nav.innerText()).includes(`Se libera el ${expectedDate}`), `el temario muestra la fecha de liberación (${expectedDate})`);
check((await nav.locator("a", { hasText: "Contenido de la semana 2" }).count()) === 0, "la lección programada no es un enlace en el temario");
check((await nav.locator("a", { hasText: "Adelanto gratis" }).count()) === 1, "la vista previa gratuita del módulo sigue abierta");
await ana.goto(`${BASE}/aprender/${course.slug}/${L["Contenido de la semana 2"]}`);
check(await ana.isVisible("text=/Esta lección se libera el/") && !(await ana.content()).includes(secret), "abrir la lección por URL muestra la fecha y no su contenido");
check(await ana.isVisible("text=Continuar con lo disponible"), "ofrece seguir con lo disponible (sin pedir que compre)");
const axeLocked = await new AxeBuilder({ page: ana }).withTags(TAGS).analyze();
check(axeLocked.violations.length === 0, `vista de lección programada sin infracciones${axeLocked.violations.length ? `: ${axeLocked.violations.map((v) => v.id).join(", ")}` : ""}`);
await ana.goto(`${BASE}/cuenta/buscar?q=${word}`);
check(!(await ana.content()).includes("Contenido de la semana 2"), "la búsqueda no encuentra contenido aún no liberado");

// La base lo impide aunque se llame directo con su sesión
const anaClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
await anaClient.auth.signInWithPassword({ email: people.ana, password });
const { data: direct } = await anaClient.from("lesson_contents").select("body").eq("lesson_id", L["Contenido de la semana 2"]);
check((direct ?? []).length === 0, "leer el contenido directo de la base devuelve vacío");
const { error: progressErr } = await anaClient.from("lesson_progress").insert({ user_id: ids.ana, lesson_id: L["Contenido de la semana 2"], course_id: course.id, completed_at: new Date().toISOString(), last_position_seconds: 0 });
check(Boolean(progressErr), "no puede marcarla como completada llamando a la base");

// ---------------------------------------------------------------- El admin la ve
await adm.goto(`${BASE}/aprender/${course.slug}/${L["Contenido de la semana 2"]}`);
check((await adm.content()).includes(secret), "el administrador ve el módulo programado");

// ---------------------------------------------------------------- Pasan 8 días
must(await admin.from("enrollments").update({ created_at: new Date(Date.now() - 8 * 86400000).toISOString() }).eq("user_id", ids.ana).eq("course_id", course.id).select("id"));
await ana.goto(`${BASE}/aprender/${course.slug}/${L["Contenido de la semana 2"]}`);
check((await ana.content()).includes(secret), "a los 8 días la lección ya se puede leer");
check(!(await ana.locator('nav[aria-label="Contenido del curso"]').first().innerText()).includes("Se libera el"), "el temario ya no muestra fecha de liberación");
await ana.goto(`${BASE}/cuenta/buscar?q=${word}`);
check((await ana.content()).includes("Contenido de la semana 2"), "ya liberada, la búsqueda sí la encuentra");
await ana.goto(`${BASE}/aprender/${course.slug}/${L["Contenido de la semana 2"]}`);
await ana.click('button:has-text("Marcar como completada")');
let prog = null;
for (let i = 0; i < 40 && !prog?.completed_at; i++) {
  await new Promise((r) => setTimeout(r, 250));
  ({ data: prog } = await admin.from("lesson_progress").select("completed_at").eq("user_id", ids.ana).eq("lesson_id", L["Contenido de la semana 2"]).maybeSingle());
}
check(Boolean(prog?.completed_at), "y la puede completar");

// ---------------------------------------------------------------- Móvil
const mobile = await login("ana", { width: 360, height: 780 });
must(await admin.from("modules").update({ release_after_days: 30 }).eq("id", m2.id).select("id"));
await mobile.goto(`${BASE}/aprender/${course.slug}/${L["Contenido de la semana 2"]}`);
const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check(await mobile.isVisible("text=/Esta lección se libera el/") && overflow <= 0, `al alargar a 30 días se vuelve a cerrar; sin desbordamiento en 360 px (${overflow}px)`);

const { data: auditRows } = await admin.from("admin_audit_log").select("action").eq("entity_id", m2.id);
check(auditRows?.some((r) => r.action === "set_release"), "el cambio de programación queda en la auditoría");
check(errors.length === 0, `sin errores de JavaScript en las páginas${errors.length ? `: ${errors.join(" | ")}` : ""}`);

await browser.close();
await admin.from("courses").update({ status: "archived" }).eq("id", course.id);
console.log(failures ? `\n${failures} verificaciones fallaron` : "\nTodo OK");
process.exit(failures ? 1 : 0);
