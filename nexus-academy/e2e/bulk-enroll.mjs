// E2E de la inscripción masiva por lista de correos (con invitación real vía Mailpit).
// Ejecutar con el entorno arriba: node e2e/bulk-enroll.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { AxeBuilder } from "@axe-core/playwright";
import pw from "playwright";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let failures = 0;
const check = (c, l) => { console.log(c ? "✔" : "✘", l); if (!c) failures++; };
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const ts = Date.now();
const password = "Masiva12345!";
const mk = (n) => `${n}.bulk.${ts}@test.dev`;
const people = { admin: mk("admin"), ana: mk("ana"), beto: mk("beto"), carla: mk("carla") };
const nuevo = mk("nuevo");
const ids = {};
for (const [k, email] of Object.entries(people)) {
  const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: k } });
  ids[k] = data.user.id;
}
await admin.from("profiles").update({ role: "admin" }).eq("id", ids.admin);
const { data: course } = await admin.from("courses").select("id, slug, title").eq("slug", "javascript-moderno").single();
// Beto ya tiene acceso; Carla lo tuvo y se le revocó; Ana no tiene.
must(await admin.from("enrollments").insert([
  { user_id: ids.beto, course_id: course.id, source: "admin_grant" },
  { user_id: ids.carla, course_id: course.id, source: "admin_grant", revoked_at: new Date().toISOString() },
]).select("id"));

const browser = await pw.chromium.launch();
const errors = [];
async function newPage(viewport = { width: 1280, height: 900 }) {
  const page = await (await browser.newContext({ viewport })).newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  return page;
}
async function login(page, email, pass = password) {
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", pass);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
}

// Un alumno no puede abrir la página
const student = await newPage();
await login(student, people.ana);
await student.goto(`${BASE}/admin/cursos/${course.id}/inscribir`);
check(!new URL(student.url()).pathname.startsWith("/admin"), "un alumno no puede abrir la inscripción masiva");

// ---------------------------------------------------------------- Admin pega la lista
const adm = await newPage();
await login(adm, people.admin);
await adm.goto(`${BASE}/admin/cursos/${course.id}`);
await adm.click("text=Inscribir alumnos");
await adm.waitForURL(`**/admin/cursos/${course.id}/inscribir`, { timeout: 15000 });
const list = [
  people.ana.toUpperCase(),
  `Beto <${people.beto}>`,
  people.carla,
  nuevo,
  "esto-no-es-correo",
  people.ana,
].join("\n");
await adm.fill("#bulk-emails", list);
check(await adm.isVisible("text=5 correo(s) detectados"), "detecta 5 correos distintos en la lista pegada");
const axe = await new AxeBuilder({ page: adm }).withTags(TAGS).analyze();
check(axe.violations.length === 0, `página sin infracciones de accesibilidad${axe.violations.length ? `: ${axe.violations.map((v) => v.id).join(", ")}` : ""}`);
await adm.click('button:has-text("Dar acceso al curso")');
await adm.waitForSelector("#bulk-result", { timeout: 30000 });
const row = (email) => adm.locator("tr", { hasText: email });
check((await row(people.ana).innerText()).includes("Inscrito"), "con cuenta y sin acceso: «Inscrito»");
check((await row(people.beto).innerText()).includes("Ya tenía acceso"), "con acceso vigente: «Ya tenía acceso»");
check((await row(people.carla).innerText()).includes("Acceso devuelto"), "con acceso revocado: «Acceso devuelto»");
check((await row(nuevo).innerText()).includes("Invitado por correo"), "sin cuenta: «Invitado por correo»");
check((await row("esto-no-es-correo").innerText()).includes("Correo inválido"), "texto que no es correo: «Correo inválido»");
check(await adm.isVisible("text=3 con acceso nuevo · 1 ya tenían acceso · 1 invitados por correo · 1 correos inválidos"), "muestra el resumen correcto");
check((await adm.inputValue("#bulk-emails")) === "", "la lista se vacía tras inscribir");

const { data: enr } = await admin.from("enrollments").select("user_id, revoked_at, source").eq("course_id", course.id).in("user_id", [ids.ana, ids.beto, ids.carla]);
check(enr?.length === 3 && enr.every((e) => e.revoked_at === null), "Ana, Beto y Carla quedan con acceso vigente");
const { data: invitedProfile } = await admin.from("profiles").select("id").eq("email", nuevo).maybeSingle();
const { data: invitedEnr } = invitedProfile ? await admin.from("enrollments").select("revoked_at").eq("user_id", invitedProfile.id).eq("course_id", course.id).maybeSingle() : { data: null };
check(Boolean(invitedEnr) && invitedEnr.revoked_at === null, "la persona invitada ya queda inscrita");
const { data: audit } = await admin.from("admin_audit_log").select("action, details").eq("actor_id", ids.admin).in("action", ["bulk_enroll", "bulk_invite"]);
check(audit?.some((a) => a.action === "bulk_enroll" && a.details.enrolled === 1) && audit?.some((a) => a.action === "bulk_invite" && a.details.invited === 1), "la auditoría guarda los conteos de inscripción e invitación");
check(!JSON.stringify(audit).includes(people.ana), "la auditoría no guarda la lista de correos");

// ---------------------------------------------------------------- La invitación llega y funciona
let link = null;
let subject = "";
for (let i = 0; i < 20 && !link; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  const res = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent("to:" + nuevo)}`)).json();
  const msg = res.messages?.[0];
  if (msg) {
    subject = msg.Subject;
    const full = await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json();
    link = (full.HTML.match(/href="([^"]*auth\/confirm[^"]*)"/) || [])[1]?.replace(/&amp;/g, "&");
  }
}
check(Boolean(link) && /acceso a cursos/i.test(subject), `llega la invitación por correo («${subject}»)`);
const guest = await newPage();
await guest.goto(link);
await guest.waitForURL(/\/restablecer\?bienvenida=1/, { timeout: 20000 });
check(await guest.isVisible("text=Crea tu contraseña"), "el enlace lleva a crear su contraseña con mensaje de bienvenida");
await guest.fill("#password", "NuevaMasiva123");
await guest.fill("#confirm", "NuevaMasiva123");
await guest.click('button[type="submit"]');
await guest.waitForSelector("text=Tu contraseña se actualizó", { timeout: 15000 });
await guest.context().clearCookies();
await login(guest, nuevo, "NuevaMasiva123");
await guest.goto(`${BASE}/cuenta/cursos`);
check(await guest.isVisible(`text=${course.title}`), "la persona invitada entra con su contraseña y ve el curso en «Mis cursos»");

// Ana también lo ve
await student.goto(`${BASE}/cuenta/cursos`);
check(await student.isVisible(`text=${course.title}`), "un alumno inscrito por lista ve el curso de inmediato");

// ---------------------------------------------------------------- Límite y móvil
const big = Array.from({ length: 501 }, (_, i) => `x${i}.${ts}@test.dev`).join("\n");
await adm.fill("#bulk-emails", big);
check(await adm.locator('button:has-text("Dar acceso al curso")').isDisabled(), "con más de 500 correos no deja enviar");
const mobile = await newPage({ width: 360, height: 780 });
await login(mobile, people.admin);
await mobile.goto(`${BASE}/admin/cursos/${course.id}/inscribir`);
const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check(overflow <= 0, `sin desbordamiento horizontal en 360 px (${overflow}px)`);
check(errors.length === 0, `sin errores de JavaScript en las páginas${errors.length ? `: ${errors.join(" | ")}` : ""}`);

await browser.close();
const cleanup = [...Object.values(ids), invitedProfile?.id].filter(Boolean);
for (const id of cleanup) await admin.auth.admin.deleteUser(id);
console.log(failures ? `\n${failures} verificaciones fallaron` : "\nTodo OK");
process.exit(failures ? 1 : 0);
