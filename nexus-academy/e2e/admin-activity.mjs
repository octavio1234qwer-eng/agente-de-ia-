// E2E: actividad de estudio agregada en el dashboard del admin.
// Ejecutar con el entorno arriba: node e2e/admin-activity.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import pw from "playwright";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let failures = 0;
const check = (c, l) => { console.log(c ? "✔" : "✘", l); if (!c) failures++; };

const ts = Date.now();
const password = "Activo12345";
const mk = async (tag, role) => {
  const { data } = await service.auth.admin.createUser({ email: `act.${tag}.${ts}@test.dev`, password, email_confirm: true, user_metadata: { full_name: `Act ${tag}` } });
  if (role) await service.from("profiles").update({ role }).eq("id", data.user.id);
  return data.user;
};
const adm = await mk("admin", "admin");
const s1 = await mk("uno");
const s2 = await mk("dos");
const asUser = async (email) => {
  const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password });
  return c;
};
const adminApi = await asUser(adm.email);
const stats = async (days = 30) => (await adminApi.rpc("admin_learning_activity", { p_days: days })).data;

const before = await stats();
const hour = Math.floor(Date.now() / 3600_000) * 3600_000;
await service.from("learning_activity").insert([
  { user_id: s1.id, at_hour: new Date(hour).toISOString() },
  { user_id: s2.id, at_hour: new Date(hour).toISOString() },
  { user_id: s2.id, at_hour: new Date(hour - 86400_000).toISOString() },
  { user_id: adm.id, at_hour: new Date(hour).toISOString() }, // el admin no cuenta como alumno
]);
const { data: git } = await service.from("courses").select("id").eq("slug", "git-github-esencial").single();
const { data: lesson } = await service.from("lessons").select("id").eq("course_id", git.id).order("position").limit(1).single();
await service.from("lesson_progress").insert({ user_id: s1.id, lesson_id: lesson.id, course_id: git.id, completed_at: new Date().toISOString() });
const after = await stats();
check(after.active_today === before.active_today + 2, `hoy suman los 2 alumnos nuevos, no el admin (${before.active_today} → ${after.active_today})`);
check(after.lessons_period === before.lessons_period + 1, "la lección completada suma al periodo");
check(after.daily.at(-1).lessons === before.daily.at(-1).lessons + 1, "y al día de hoy");

const student = await asUser(s1.email);
const { error: denied } = await student.rpc("admin_learning_activity", { p_days: 30 });
check(Boolean(denied), "un alumno no puede consultar la actividad agregada");

const browser = await pw.chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`${BASE}/login`);
await page.fill("#email", adm.email);
await page.fill("#password", password);
await page.click('button[type="submit"]');
await page.waitForURL((u) => u.pathname !== "/login", { timeout: 20000 });
await page.goto(`${BASE}/admin`);
const panel = page.locator("section", { has: page.locator("h2", { hasText: "Actividad de estudio" }) });
check(await panel.isVisible(), "el dashboard muestra «Actividad de estudio»");
const summary = (await page.locator('[data-testid="activity-summary"]').innerText()).replace(/\s+/g, " ");
const n = (v) => Number(v).toLocaleString("es-MX", { maximumFractionDigits: 1 });
check(summary.includes(`Hoy ${n(after.active_today)}`) && summary.includes(`Últimos 7 días ${n(after.active_7d)}`) && summary.includes(`Últimos 30 días ${n(after.active_period)}`), `resumen igual a la base (${summary})`);
check(summary.includes(`Lecciones completadas ${n(after.lessons_period)}`) && summary.includes(`Días de estudio por alumno ${n(after.avg_days)}`), "lecciones y días promedio iguales a la base");
const kpi = (await page.locator(".glass", { hasText: "Aprendiendo activamente" }).first().innerText()).replace(/\s+/g, " ");
check(kpi.includes(n(after.active_period)) && kpi.includes("Estudiaron en los últimos 30 días"), "el KPI «Aprendiendo activamente» usa la misma actividad real");
check((await panel.locator('[role="img"][aria-label="Alumnos que estudiaron por día"]').count()) === 1 && (await panel.locator('[role="img"][aria-label="Alumnos activos por semana"]').count()) === 1, "gráficas por día y por semana");
await panel.locator("summary", { hasText: "Ver datos en tabla" }).first().click();
const rows = panel.locator("details").first().locator("tbody tr");
check((await rows.count()) === 30, "tabla accesible con un renglón por día (30)");
check((await rows.last().innerText()).replace(/\s+/g, " ").endsWith(`${after.daily.at(-1).students} ${after.daily.at(-1).lessons}`), "el último renglón (hoy) coincide con la base");
await page.goto(`${BASE}/admin?dias=7`);
await page.locator("section", { has: page.locator("h2", { hasText: "Actividad de estudio" }) }).locator("summary").first().click();
check((await page.locator("section", { has: page.locator("h2", { hasText: "Actividad de estudio" }) }).locator("details").first().locator("tbody tr").count()) === 7, "con «7 días» la serie diaria tiene 7 días");
const html = await page.content();
check(!html.includes(s1.email) && !html.includes(s2.email), "el dashboard no expone qué alumno estudió");
check(errors.length === 0, `sin errores de JavaScript${errors.length ? `: ${errors.join(" | ")}` : ""}`);
await browser.close();
console.log(failures ? `\n${failures} fallo(s)` : "\nTodo OK");
process.exit(failures ? 1 : 0);
