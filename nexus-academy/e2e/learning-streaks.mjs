// E2E: racha de estudio y meta semanal en «Mis cursos», con progreso real.
// Ejecutar con el entorno arriba: node e2e/learning-streaks.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import pw from "playwright";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let failures = 0;
const check = (c, l) => { console.log(c ? "✔" : "✘", l); if (!c) failures++; };

const ts = Date.now();
const password = "Racha12345";
const email = `racha.${ts}@test.dev`;
const otherEmail = `racha.otro.${ts}@test.dev`;
const { data: u } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Rita Racha" } });
const { data: o } = await admin.auth.admin.createUser({ email: otherEmail, password, email_confirm: true, user_metadata: { full_name: "Otto Otro" } });
const { data: git } = await admin.from("courses").select("id").eq("slug", "git-github-esencial").single();
await admin.from("enrollments").insert([{ user_id: u.user.id, course_id: git.id, source: "free" }, { user_id: o.user.id, course_id: git.id, source: "free" }]);
const { data: lesson } = await admin.from("lessons").select("id").eq("course_id", git.id).eq("type", "article").order("position").limit(1).single();

const browser = await pw.chromium.launch();
const errors = [];
async function login(mail, opts = {}) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, ...opts })).newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}/login`);
  await page.fill("#email", mail);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => url.pathname !== "/login", { timeout: 20000 });
  return page;
}
const text = async (page, id) => (await page.locator(`[data-testid="${id}"]`).innerText()).replace(/\s+/g, " ").trim();

const page = await login(email);
await page.goto(`${BASE}/cuenta/cursos`);
const card = page.locator('[data-testid="learning-stats"]');
check(await card.isVisible(), "«Mis cursos» muestra «Tu ritmo de estudio»");
check((await text(page, "current-streak")) === "0 días" && (await text(page, "longest-streak")) === "Mejor racha: 0 días", "recién inscrita: racha 0 (inscribirse no cuenta como estudiar)");
check((await text(page, "week-progress")) === "0 de 3 lecciones", "meta por omisión: 0 de 3 lecciones");
check((await text(page, "streak-message")).includes("empezar tu racha"), "invita a empezar la racha");
const days = card.locator('ol[aria-label="Actividad de esta semana"] > li');
check((await days.count()) === 7 && (await card.locator('li[data-status="today"]').count()) === 1, "semana de 7 días con «hoy» marcado");
check((await card.locator("li .sr-only").first().innerText()).startsWith("lunes"), "la semana empieza en lunes y cada día tiene texto para lectores de pantalla");

// Progreso real: completar una lección en el aula
await page.goto(`${BASE}/aprender/git-github-esencial/${lesson.id}`);
await page.click("button:has-text('Marcar como completada')");
await page.waitForSelector("button:has-text('Completada')");
await page.goto(`${BASE}/cuenta/cursos`);
check((await text(page, "current-streak")) === "1 día", "completar una lección inicia la racha (1 día)");
check((await text(page, "week-progress")) === "1 de 3 lecciones", "y suma a la meta semanal (1 de 3)");
check((await text(page, "streak-message")).includes("llegar a 2 días"), "anima a volver mañana");
const today = card.locator('li[data-status="active"]').last();
check((await today.locator("span").first().innerText()) === "1" && (await today.locator(".sr-only").innerText()).includes("(hoy): estudiaste, 1 lección completada"), "el día de hoy muestra la lección completada");
const { data: logged } = await admin.from("learning_activity").select("at_hour").eq("user_id", u.user.id);
check(logged?.length === 1, "la actividad quedó registrada por la base, una vez por hora");

// Historial: ayer, anteayer y una racha de 5 días hace 20-24 días
const hour = new Date(logged[0].at_hour).getTime();
const past = [1, 2, 20, 21, 22, 23, 24].map((d) => ({ user_id: u.user.id, at_hour: new Date(hour - d * 86400000).toISOString() }));
const { error: insErr } = await admin.from("learning_activity").insert(past);
if (insErr) throw insErr;
await page.reload();
check((await text(page, "current-streak")) === "3 días" && (await text(page, "longest-streak")) === "Mejor racha: 5 días", "racha actual 3 días y mejor racha 5 días");

// Meta semanal
await page.fill("#weekly-goal", "1");
await page.click("button:has-text('Guardar meta')");
await page.waitForSelector("text=Meta guardada.");
await page.waitForFunction(() => document.querySelector('[data-testid="goal-message"]')?.textContent?.includes("Meta cumplida"));
check((await text(page, "week-progress")) === "1 de 1 lección", "al bajar la meta a 1, queda cumplida");
await page.evaluate(() => document.querySelector("#weekly-goal")?.removeAttribute("min"));
await page.fill("#weekly-goal", "0");
await page.click("button:has-text('Guardar meta')");
await page.waitForSelector("text=Elige una meta entre 1 y 50");
check(true, "el servidor rechaza una meta fuera de rango aunque se salte la validación del navegador");

// Zona horaria (dispositivo en Tokio)
const tokyo = await login(email, { timezoneId: "Asia/Tokyo" });
await tokyo.goto(`${BASE}/cuenta/ajustes#zona-horaria`);
check((await tokyo.inputValue("#time-zone")) === "America/Mexico_City", "ajustes muestra la zona guardada (centro de México)");
check((await text(tokyo, "detected-time-zone")).includes("Asia/Tokyo"), "detecta la zona del dispositivo y la ofrece");
await tokyo.click("button:has-text('Usar esta')");
await tokyo.click("button:has-text('Guardar zona horaria')");
await tokyo.waitForSelector("text=Zona horaria guardada.");
const { data: prof } = await admin.from("profiles").select("time_zone").eq("id", u.user.id).single();
check(prof.time_zone === "Asia/Tokyo", "la zona se guarda en el perfil");
await tokyo.evaluate(() => { const s = document.querySelector("#time-zone"); const op = new Option("Marte", "Marte/Olympus"); s.add(op); s.value = "Marte/Olympus"; s.dispatchEvent(new Event("change", { bubbles: true })); });
await tokyo.click("button:has-text('Guardar zona horaria')");
await tokyo.waitForSelector("text=Esa zona horaria no existe.");
check(true, "una zona inventada se rechaza en la base de datos");
await tokyo.goto(`${BASE}/cuenta/cursos`);
check((await tokyo.locator('[data-testid="learning-stats"]').innerText()).includes("Asia/Tokyo") && (await text(tokyo, "current-streak")) === "3 días", "la tarjeta usa la nueva zona y la racha se conserva");

// Móvil: sin desbordes horizontales
await page.setViewportSize({ width: 360, height: 800 });
await page.reload();
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check(overflow <= 0, "en móvil (360 px) la tarjeta no desborda la pantalla");

// Privacidad
const other = await login(otherEmail);
await other.goto(`${BASE}/cuenta/cursos`);
check((await text(other, "current-streak")) === "0 días" && (await text(other, "week-progress")) === "0 de 3 lecciones", "otro alumno no ve la actividad de Rita");

check(errors.length === 0, `sin errores de JavaScript${errors.length ? `: ${errors.join(" | ")}` : ""}`);
await browser.close();
console.log(failures ? `\n${failures} fallo(s)` : "\nTodo OK");
process.exit(failures ? 1 : 0);
