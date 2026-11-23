// E2E de las notas con marca de tiempo en lecciones de video.
// Usa un video WebM real de 20 s (e2e/fixtures/test-20s.webm) en una lección
// temporal del curso gratuito, que se elimina al terminar.
// Ejecutar con el entorno arriba: node e2e/video-timestamps.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import pw from "playwright";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let failures = 0;
const check = (c, l) => { console.log(c ? "✔" : "✘", l); if (!c) failures++; };
const TITLE = "E2E video con marcas";

// Preparación: lección de video temporal con un archivo real.
const { data: git } = await admin.from("courses").select("id").eq("slug", "git-github-esencial").single();
await admin.from("lessons").delete().eq("course_id", git.id).eq("title", TITLE);
const { data: mod } = await admin.from("modules").select("id").eq("course_id", git.id).order("position").limit(1).single();
const path = `e2e/marcas-${Date.now()}.webm`;
const { error: upErr } = await admin.storage.from("course-videos").upload(path, readFileSync(new URL("./fixtures/test-20s.webm", import.meta.url)), { contentType: "video/webm" });
if (upErr) throw upErr;
const { data: lesson, error: lErr } = await admin.from("lessons").insert({ module_id: mod.id, course_id: git.id, title: TITLE, type: "video", duration_seconds: 20, position: 99 }).select("id").single();
if (lErr) throw lErr;
await admin.from("lesson_contents").update({ video_provider: "storage", video_ref: path }).eq("lesson_id", lesson.id);

const email = `marcas.${Date.now()}@test.dev`;
const password = "Marcas12345";
await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Vera Video" } });

const browser = await pw.chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const videoReady = () => page.waitForFunction(() => (document.querySelector("video[data-lesson-video]")?.readyState ?? 0) >= 1, null, { timeout: 20000 });
const videoTime = () => page.evaluate(() => document.querySelector("video[data-lesson-video]").currentTime);
const setVideoTime = (t) => page.evaluate((s) => { const v = document.querySelector("video[data-lesson-video]"); v.currentTime = s; return new Promise((r) => v.addEventListener("seeked", r, { once: true })); }, t);

try {
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => u.pathname.startsWith("/cuenta"), { timeout: 20000 });
  await page.goto(`${BASE}/cursos/git-github-esencial`);
  await page.click("text=Inscribirme gratis");
  await page.waitForURL(/\/aprender\/git-github-esencial\/[0-9a-f-]{36}/, { timeout: 20000 });

  // Una lección de lectura no ofrece marcas de tiempo.
  check(await page.isVisible("#lesson-note") && !(await page.isVisible("button:has-text('Marca de tiempo')")), "en una lectura no hay botón de marca de tiempo");

  // Lección de video
  const lessonUrl = `${BASE}/aprender/git-github-esencial/${lesson.id}`;
  await page.goto(lessonUrl);
  await videoReady();
  const duration = await page.evaluate(() => document.querySelector("video[data-lesson-video]").duration);
  check(Math.round(duration) === 20, `el video real carga (duración ${duration.toFixed(1)} s)`);
  check(await page.isVisible("button:has-text('Marca de tiempo')"), "en el video aparece «Marca de tiempo»");

  await setVideoTime(7.4);
  await page.click("button:has-text('Marca de tiempo')");
  await page.keyboard.type("definición de commit");
  await setVideoTime(15.2);
  await page.click("button:has-text('Marca de tiempo')");
  await page.keyboard.type("repaso");
  const text = await page.inputValue("#lesson-note");
  check(text === "[0:07] definición de commit\n[0:15] repaso", `inserta la marca en el cursor y en línea nueva (${JSON.stringify(text)})`);

  const chips = page.locator('ul[aria-label="Marcas de tiempo de tu nota"] button');
  check((await chips.count()) === 2, "muestra una marca clicable por cada [m:ss]");
  await page.locator("#mis-notas").scrollIntoViewIfNeeded();
  await page.screenshot({ path: process.env.E2E_SHOT ?? "/tmp/video-timestamps.png" });
  await setVideoTime(0);
  await chips.filter({ hasText: "0:07" }).click();
  await page.waitForTimeout(400);
  const t1 = await videoTime();
  check(t1 >= 7 && t1 < 8.5, `al hacer clic salta a ese segundo (${t1.toFixed(2)} s)`);
  await page.evaluate(() => document.querySelector("video[data-lesson-video]").pause());

  await page.click('button:has-text("Guardar nota")');
  await page.waitForSelector("#lesson-note-status:has-text('Nota guardada')", { timeout: 15000 });
  await page.reload();
  await videoReady();
  check((await chips.count()) === 2, "las marcas siguen tras recargar");

  // «Mis notas»: las marcas enlazan al video en ese momento.
  await page.goto(`${BASE}/cuenta/notas`);
  const link = page.locator('[data-testid="note"] a', { hasText: "[0:15]" });
  check((await link.getAttribute("href"))?.endsWith(`/aprender/git-github-esencial/${lesson.id}?t=15`), "en «Mis notas» la marca enlaza a ?t=15");
  await link.click();
  await page.waitForURL((u) => u.searchParams.get("t") === "15", { timeout: 20000 });
  await videoReady();
  await page.waitForFunction(() => document.querySelector("video[data-lesson-video]").currentTime >= 14, null, { timeout: 10000 }).catch(() => {});
  const t2 = await videoTime();
  check(t2 >= 14.5 && t2 < 16, `el enlace abre el video en el segundo 15 (${t2.toFixed(2)} s)`);

  // Entradas inválidas no rompen la página.
  await page.goto(`${lessonUrl}?t=abc`);
  await videoReady();
  check((await videoTime()) < 1, "?t inválido se ignora");
  await page.goto(`${lessonUrl}?t=99999`);
  await videoReady();
  await page.waitForTimeout(300);
  const t3 = await videoTime();
  check(t3 <= 20, `?t mayor que el video no pasa del final (${t3.toFixed(2)} s)`);

  check(errors.length === 0, `sin errores de JavaScript${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} finally {
  await browser.close();
  await admin.from("lessons").delete().eq("id", lesson.id);
  await admin.storage.from("course-videos").remove([path]);
}
console.log(failures ? `\n${failures} fallo(s)` : "\nTodo OK");
process.exit(failures ? 1 : 0);
