// E2E del aviso por correo cuando se libera un módulo programado.
// Ejecutar con el entorno arriba: node e2e/module-unlock.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let failures = 0;
const check = (c, l) => { console.log(c ? "✔" : "✘", l); if (!c) failures++; };
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const cron = (auth) => fetch(`${BASE}/api/cron/module-unlocks`, { headers: auth ? { Authorization: auth } : {} });

const ts = Date.now();
const day = 86400000;
// Curso de prueba: módulo 1 abierto, módulo 2 a los 7 días.
const course = must(await admin.from("courses").insert({ slug: `unlock-${ts}`, title: `Unlock E2E ${ts}`, status: "published", price_cents: 0 }).select("id, slug").single());
const [m1, m2] = must(await admin.from("modules").insert([
  { course_id: course.id, title: "Semana 1", position: 0, release_after_days: null },
  { course_id: course.id, title: `Semana 2 ${ts}`, position: 1, release_after_days: 7 },
]).select("id, position").order("position"));
const insertedLessons = must(await admin.from("lessons").insert([
  { module_id: m1.id, course_id: course.id, title: "Inicio", type: "article", position: 0, is_preview: false },
  { module_id: m2.id, course_id: course.id, title: "Flexbox", type: "article", position: 0, is_preview: false },
]).select("id, module_id"));
const l2 = insertedLessons.find((l) => l.module_id === m2.id);

const people = {
  hoy: { enrolledAgo: 7 * day + 2 * 3600000 },
  pronto: { enrolledAgo: 3 * day },
  viejo: { enrolledAgo: 20 * day },
  sinAvisos: { enrolledAgo: 7 * day + 2 * 3600000, optOut: true },
  revocado: { enrolledAgo: 7 * day + 2 * 3600000, revoked: true },
};
for (const [k, p] of Object.entries(people)) {
  p.email = `${k.toLowerCase()}.unlock.${ts}@test.dev`;
  const { data } = await admin.auth.admin.createUser({ email: p.email, password: "Unlock12345!", email_confirm: true, user_metadata: { full_name: `Alumno ${k}` } });
  p.id = data.user.id;
  if (p.optOut) await admin.from("profiles").update({ reminder_opt_in: false }).eq("id", p.id);
  must(await admin.from("enrollments").insert({
    user_id: p.id, course_id: course.id, source: "free",
    created_at: new Date(Date.now() - p.enrolledAgo).toISOString(),
    revoked_at: p.revoked ? new Date().toISOString() : null,
  }).select("id"));
}
const logsFor = async (p) => must(await admin.from("email_log").select("status, subject, dedupe_key").eq("user_id", p.id).eq("template", "module_unlocked"));

// Sin la clave de la tarea programada: 401
check((await cron()).status === 401, "sin CRON_SECRET responde 401");
check((await cron("Bearer otra-cosa")).status === 401, "con una clave equivocada responde 401");

const res = await cron(`Bearer ${env.CRON_SECRET}`);
const body = await res.json();
check(res.status === 200 && body.job === "module_unlocks", "con la clave correcta corre la tarea");
const hoy = await logsFor(people.hoy);
check(hoy.length === 1 && hoy[0].dedupe_key === `unlock:${m2.id}:${people.hoy.id}`, "avisa a quien se le liberó el módulo hoy (un registro por alumno y módulo)");
check(hoy[0]?.subject === `Ya puedes ver «Semana 2 ${ts}» en Unlock E2E ${ts}`, "el asunto nombra el módulo y el curso");
check(hoy[0]?.status === "skipped", "sin Resend queda como «omitido» (no se finge el envío)");
check((await logsFor(people.pronto)).length === 0, "no avisa a quien todavía no llega a los 7 días");
check((await logsFor(people.viejo)).length === 0, "no avisa por módulos liberados hace semanas");
check((await logsFor(people.sinAvisos)).length === 0, "respeta a quien desactivó recordatorios y avisos");
check((await logsFor(people.revocado)).length === 0, "no avisa a quien perdió el acceso");

// Correr de nuevo no duplica
await cron(`Bearer ${env.CRON_SECRET}`);
check((await logsFor(people.hoy)).length === 1, "correr la tarea otra vez no duplica el aviso");

// El enlace del correo apunta a la primera lección del módulo (que ya puede abrir)
const { data: cand } = await admin.rpc("module_unlock_candidates");
const mine = cand?.find((c) => c.user_id === people.hoy.id);
check(mine?.first_lesson_id === l2.id && mine?.course_slug === course.slug, "el enlace lleva a la primera lección del módulo liberado");

for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
await admin.from("courses").update({ status: "archived" }).eq("id", course.id);
console.log(failures ? `\n${failures} verificaciones fallaron` : "\nTodo OK");
process.exit(failures ? 1 : 0);
