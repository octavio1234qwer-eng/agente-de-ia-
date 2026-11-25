// E2E: aviso por correo cuando la racha está por perderse (/api/cron/streak-reminders).
// Sin Resend configurado el correo se registra como «skipped» (nunca se finge el envío).
// Ejecutar con el entorno arriba: node e2e/streak-reminder.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import pw from "playwright";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let failures = 0;
const check = (c, l) => { console.log(c ? "✔" : "✘", l); if (!c) failures++; };

// Zona con desfase fijo en la que ahora son las 19 h (dentro del horario de aviso 16-22 h).
const utcHour = new Date().getUTCHours();
let offset = 19 - utcHour;
if (offset > 14) offset -= 24;
if (offset < -12) offset += 24;
const tz = offset === 0 ? "Etc/GMT" : `Etc/GMT${offset > 0 ? "-" : "+"}${Math.abs(offset)}`; // Etc invierte el signo
const localDate = new Date(Date.now() + offset * 3600_000).toISOString().slice(0, 10);

const ts = Date.now();
const password = "Aviso12345";
const mk = async (tag, name, optIn) => {
  const { data } = await admin.auth.admin.createUser({ email: `aviso.${tag}.${ts}@test.dev`, password, email_confirm: true, user_metadata: { full_name: name } });
  await admin.from("profiles").update({ time_zone: tz, reminder_opt_in: optIn }).eq("id", data.user.id);
  return data.user;
};
const ana = await mk("ana", "Ana Constante", true);
const beto = await mk("beto", "Beto Hoy", true);
const caro = await mk("caro", "Caro Sinavisos", false);
const { data: git } = await admin.from("courses").select("id, title").eq("slug", "git-github-esencial").single();
await admin.from("enrollments").insert([ana, beto, caro].map((u) => ({ user_id: u.id, course_id: git.id, source: "free" })));
const hour = Math.floor(Date.now() / 3600_000) * 3600_000;
const at = (h) => new Date(hour - h * 3600_000).toISOString();
const activity = [
  ...[ana, beto, caro].flatMap((u) => [{ user_id: u.id, at_hour: at(24) }, { user_id: u.id, at_hour: at(48) }]),
  { user_id: beto.id, at_hour: at(0) }, // Beto ya estudió hoy
];
const { error: actErr } = await admin.from("learning_activity").insert(activity);
if (actErr) throw actErr;

const cron = (auth) => fetch(`${BASE}/api/cron/streak-reminders`, { headers: auth ? { authorization: auth } : {} });
check((await cron()).status === 401, "sin el secreto de cron responde 401");
check((await cron("Bearer otro-secreto")).status === 401, "con un secreto equivocado responde 401");
const res = await cron(`Bearer ${env.CRON_SECRET}`);
const body = await res.json();
check(res.status === 200 && body.job === "streak_reminders" && body.candidates >= 1, `la tarea corre (${JSON.stringify(body)})`);

const logs = async (u) => (await admin.from("email_log").select("template, status, subject, dedupe_key, error").eq("user_id", u.id).eq("template", "streak_reminder")).data ?? [];
const anaLogs = await logs(ana);
check(anaLogs.length === 1 && anaLogs[0].subject === "Tu racha de 2 días sigue viva hoy", "Ana (2 días hasta ayer, hoy sin actividad) recibe el aviso con su racha real");
check(anaLogs[0]?.dedupe_key === `streak:${ana.id}:${localDate}`, "un aviso por alumno y día de SU zona horaria");
check(anaLogs[0]?.status === "skipped" && /no configurado/.test(anaLogs[0]?.error ?? ""), "sin Resend se registra como omitido, sin fingir el envío");
check((await logs(beto)).length === 0, "Beto ya estudió hoy: sin aviso");
check((await logs(caro)).length === 0, "Caro desactivó los recordatorios: sin aviso");
await cron(`Bearer ${env.CRON_SECRET}`);
check((await logs(ana)).length === 1, "correr la tarea otra vez no duplica el registro");

// Lo que dice el correo coincide con la tarjeta del alumno
const browser = await pw.chromium.launch();
const page = await (await browser.newContext()).newPage();
await page.goto(`${BASE}/login`);
await page.fill("#email", `aviso.ana.${ts}@test.dev`);
await page.fill("#password", password);
await page.click('button[type="submit"]');
await page.waitForURL((u) => u.pathname !== "/login", { timeout: 20000 });
await page.goto(`${BASE}/cuenta/cursos`);
const card = (await page.locator('[data-testid="learning-stats"]').innerText()).replace(/\s+/g, " ");
check(card.includes("Racha actual 2 días") && card.includes("Estudia hoy para mantener tu racha de 2 días"), "«Mis cursos» muestra la misma racha que el aviso");
await browser.close();

console.log(failures ? `\n${failures} fallo(s)` : "\nTodo OK");
process.exit(failures ? 1 : 0);
