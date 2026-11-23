// E2E de subtítulos: el admin sube un .srt (se convierte a WebVTT), el alumno
// los ve en el reproductor y puede buscar lo que se dice en el video.
// Usa una lección temporal con un video WebM real que se elimina al terminar.
// Ejecutar con el entorno arriba: node e2e/video-captions.mjs
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import pw from "playwright";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let failures = 0;
const check = (c, l) => { console.log(c ? "✔" : "✘", l); if (!c) failures++; };
const TITLE = "E2E video con subtítulos";

// Archivos de prueba
const dir = mkdtempSync(join(tmpdir(), "nexus-subs-"));
const srtPath = join(dir, "clase.srt");
writeFileSync(srtPath, "1\r\n00:00:01,000 --> 00:00:04,000\r\nHoy conocemos al ornitorrinco digital\r\n\r\n2\r\n00:00:05,000 --> 00:00:08,000\r\nY a la mantarraya de las ramas\r\n");
const badPath = join(dir, "notas.txt");
writeFileSync(badPath, "esto no son subtítulos");

// Lección de video temporal
const { data: git } = await admin.from("courses").select("id").eq("slug", "git-github-esencial").single();
await admin.from("lessons").delete().eq("course_id", git.id).eq("title", TITLE);
const { data: mod } = await admin.from("modules").select("id").eq("course_id", git.id).order("position").limit(1).single();
const path = `e2e/subs-${Date.now()}.webm`;
const { error: upErr } = await admin.storage.from("course-videos").upload(path, readFileSync(new URL("./fixtures/test-20s.webm", import.meta.url)), { contentType: "video/webm" });
if (upErr) throw upErr;
const { data: lesson } = await admin.from("lessons").insert({ module_id: mod.id, course_id: git.id, title: TITLE, type: "video", duration_seconds: 20, position: 98 }).select("id").single();
await admin.from("lesson_contents").update({ video_provider: "storage", video_ref: path }).eq("lesson_id", lesson.id);

const ts = Date.now();
const password = "Subs123456";
const accounts = { admin: `subs.admin.${ts}@test.dev`, student: `subs.alumna.${ts}@test.dev`, other: `subs.otro.${ts}@test.dev` };
for (const email of Object.values(accounts)) await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Prueba Subtítulos" } });
const { data: adminProfile } = await admin.from("profiles").select("id").eq("email", accounts.admin).single();
await admin.from("profiles").update({ role: "admin" }).eq("id", adminProfile.id);

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
const captionsUrl = `${BASE}/api/captions/${lesson.id}`;
const lessonUrl = `${BASE}/aprender/git-github-esencial/${lesson.id}`;

try {
  // Admin
  const adm = await login(accounts.admin);
  await adm.goto(`${BASE}/admin/cursos/${git.id}/lecciones/${lesson.id}`);
  const status = adm.locator('[data-testid="captions-status"]');
  check((await status.textContent()).includes("Sin subtítulos"), "el editor de la lección muestra el panel de subtítulos");
  await adm.setInputFiles('input[name="file"]', badPath);
  await adm.click("button:has-text('Subir subtítulos')");
  await adm.waitForSelector("[role=alert]:has-text('No es un archivo de subtítulos válido')", { timeout: 15000 });
  check(true, "rechaza un archivo que no es de subtítulos");
  await adm.setInputFiles('input[name="file"]', srtPath);
  await adm.click("button:has-text('Subir subtítulos')");
  await adm.waitForSelector("[role=status]:has-text('Subtítulos guardados (2 fragmentos)')", { timeout: 15000 });
  check((await status.textContent()).includes("Subtítulos cargados (Español)"), "sube el .srt y confirma 2 fragmentos en español");
  if (process.env.E2E_SHOT_DIR) await adm.locator("text=Subtítulos cargados").scrollIntoViewIfNeeded().then(() => adm.screenshot({ path: `${process.env.E2E_SHOT_DIR}/captions-admin.png` }));
  const { data: stored } = await admin.from("lesson_contents").select("captions_vtt").eq("lesson_id", lesson.id).single();
  check(stored.captions_vtt.startsWith("WEBVTT\n") && stored.captions_vtt.includes("00:00:01.000 --> 00:00:04.000"), "lo guarda convertido a WebVTT");
  const { data: auditRow } = await admin.from("admin_audit_log").select("action").eq("entity", "lesson_captions").eq("entity_id", lesson.id).limit(1).maybeSingle();
  check(auditRow?.action === "update", "queda registrado en la auditoría");

  // Alumna inscrita
  const stu = await login(accounts.student);
  await stu.goto(`${BASE}/cursos/git-github-esencial`);
  await stu.click("text=Inscribirme gratis");
  await stu.waitForURL(/\/aprender\/git-github-esencial\/[0-9a-f-]{36}/, { timeout: 20000 });
  await stu.goto(lessonUrl);
  const track = stu.locator("video[data-lesson-video] track");
  check((await track.getAttribute("src")) === `/api/captions/${lesson.id}` && (await track.getAttribute("srclang")) === "es" && (await track.getAttribute("label")) === "Español", "el reproductor incluye la pista de subtítulos");
  const loaded = await stu.evaluate(async () => {
    const v = document.querySelector("video[data-lesson-video]");
    const t = v.querySelector("track");
    if (t.readyState !== 2) await new Promise((r, j) => { t.addEventListener("load", r, { once: true }); t.addEventListener("error", j, { once: true }); setTimeout(j, 10000); });
    const tt = v.textTracks[0];
    v.currentTime = 2;
    await new Promise((r) => v.addEventListener("seeked", r, { once: true }));
    await new Promise((r) => setTimeout(r, 300));
    return { mode: tt.mode, cues: tt.cues.length, active: [...(tt.activeCues ?? [])].map((c) => c.text).join(" ") };
  }).catch((e) => ({ error: String(e) }));
  check(loaded.mode === "showing" && loaded.cues === 2, `el navegador carga y muestra los subtítulos (${JSON.stringify(loaded)})`);
  check(loaded.active?.includes("ornitorrinco digital"), "en el segundo 2 se ve el subtítulo correcto");
  if (process.env.E2E_SHOT_DIR) await stu.screenshot({ path: `${process.env.E2E_SHOT_DIR}/captions-player.png` });
  const res = await stu.request.get(captionsUrl);
  check(res.status() === 200 && res.headers()["content-type"].startsWith("text/vtt"), "la ruta de subtítulos responde text/vtt al alumno");

  // Búsqueda dentro del video
  await stu.goto(`${BASE}/cuenta/buscar?q=mantarraya`);
  const hit = stu.locator('[data-testid="search-result"]', { hasText: TITLE });
  check((await hit.count()) === 1, "la búsqueda encuentra la lección por lo que se dice en el video");
  check((await hit.locator("mark", { hasText: "mantarraya" }).count()) === 1, "el fragmento resalta la palabra de los subtítulos");

  // Sin acceso
  const other = await login(accounts.other);
  check((await other.request.get(captionsUrl)).status() === 404, "un alumno sin inscripción recibe 404");
  const anon = await browser.newContext();
  check((await anon.request.get(captionsUrl)).status() === 404, "sin sesión recibe 404");
  check((await anon.request.get(`${BASE}/api/captions/no-es-uuid`)).status() === 404, "un id inválido recibe 404");

  // Quitar
  await adm.reload();
  adm.once("dialog", (d) => d.accept());
  await adm.click("button:has-text('Quitar subtítulos')");
  await adm.waitForSelector("[role=status]:has-text('Subtítulos quitados')", { timeout: 15000 });
  check((await status.textContent()).includes("Sin subtítulos"), "el admin puede quitar los subtítulos");
  await stu.goto(lessonUrl);
  check((await stu.locator("video[data-lesson-video] track").count()) === 0 && (await stu.request.get(captionsUrl)).status() === 404, "al quitarlos desaparecen del aula");

  check(errors.length === 0, `sin errores de JavaScript${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} finally {
  await browser.close();
  await admin.from("lessons").delete().eq("id", lesson.id);
  await admin.storage.from("course-videos").remove([path]);
}
console.log(failures ? `\n${failures} fallo(s)` : "\nTodo OK");
process.exit(failures ? 1 : 0);
