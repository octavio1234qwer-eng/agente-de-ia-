// E2E: subida reanudable de video (TUS) desde el editor de lecciones, pausa/reanudación y entrega firmada.
// Ejecutar: node e2e/video-upload.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import pw from "playwright";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let failures = 0;
const check = (c, l) => { console.log(c ? "✔" : "✘", l); if (!c) failures++; };
const ts = Date.now();
const SIZE = 20 * 1024 * 1024;
mkdirSync("test-results", { recursive: true });
writeFileSync("test-results/clase.mp4", randomBytes(SIZE));

const email = `video.admin.${ts}@test.dev`, password = "Video12345";
const { data: u } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
await admin.from("profiles").update({ role: "admin" }).eq("id", u.user.id);
const { data: course } = await admin.from("courses").select("id, slug").eq("slug", "react-nextjs-produccion").single();
const { data: mod } = await admin.from("modules").select("id").eq("course_id", course.id).order("position").limit(1).single();
const { data: lesson } = await admin.from("lessons").insert({ module_id: mod.id, course_id: course.id, title: `Video E2E ${ts}`, type: "video", position: 99 }).select("id").single();
await admin.from("lesson_contents").insert({ lesson_id: lesson.id, course_id: course.id, body: "" });

const browser = await pw.chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(`${BASE}/login`);
await page.fill("#email", email);
await page.fill("#password", password);
await page.click('button[type="submit"]');
await page.waitForURL((x) => x.pathname === "/cuenta/cursos");
await page.goto(`${BASE}/admin/cursos/${course.id}/lecciones/${lesson.id}`);
await page.selectOption("#video_provider", "storage");

// Limitar el ancho de banda para poder pausar a mitad de la subida.
const cdp = await page.context().newCDPSession(page);
await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 20, downloadThroughput: 50 * 1024 * 1024, uploadThroughput: 4 * 1024 * 1024 });
await page.locator('input[type="file"][accept^="video"]').setInputFiles("test-results/clase.mp4");
// TUS solo puede reanudar después de confirmar el primer bloque (6 MB ≈ 30 %).
await page.waitForFunction(() => {
  const m = document.body.innerText.match(/Subiendo… (\d+)%/);
  return m && Number(m[1]) >= 40 && Number(m[1]) < 90;
}, null, { timeout: 60000, polling: 100 });
const midway = await page.locator("button:has-text('Subiendo')").textContent();
await page.click("button:has-text('Pausar')");
await page.waitForSelector("text=Subida pausada", { timeout: 10000 });
check(true, `subida pausada a medio camino (${midway?.trim()})`);

// Reanudar: mismo archivo, sin límite de ancho de banda.
await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
let resumedFrom = null;
page.on("request", (r) => { if (r.method() === "HEAD" && r.url().includes("/upload/resumable/")) resumedFrom = r.url(); });
await page.locator('input[type="file"][accept^="video"]').setInputFiles("test-results/clase.mp4");
await page.waitForSelector("text=«clase.mp4» subido", { timeout: 90000 });
check(Boolean(resumedFrom), "la segunda subida retomó la anterior (TUS HEAD a la misma subida)");
const ref = await page.inputValue("#video_ref");
check(ref.startsWith(`${course.id}/${lesson.id}/`), `ruta privada asignada: ${ref}`);
await page.click('button:has-text("Guardar lección")');
await page.waitForSelector("text=Lección guardada", { timeout: 15000 });

// El objeto existe completo en el bucket privado
const folder = ref.split("/").slice(0, 2).join("/");
const { data: files } = await admin.storage.from("course-videos").list(folder);
const obj = files?.find((f) => ref.endsWith(f.name));
check(obj?.metadata?.size === SIZE, `archivo completo en storage (${obj?.metadata?.size} bytes)`);

// Un anónimo no puede leerlo; el aula entrega URL firmada que sirve el archivo completo
const anon = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/course-videos/${ref}`);
check(anon.status >= 400, `el bucket es privado (acceso público → ${anon.status})`);
await page.goto(`${BASE}/aprender/${course.slug}/${lesson.id}`);
const src = await page.getAttribute("video", "src");
check(Boolean(src?.includes("/object/sign/course-videos/")), "el aula entrega una URL firmada");
const head = await fetch(src, { method: "GET", headers: { Range: "bytes=0-0" } });
check(head.status === 206 && head.headers.get("content-range")?.endsWith(`/${SIZE}`), `la URL firmada sirve el video (${head.headers.get("content-range")})`);

await admin.from("lessons").delete().eq("id", lesson.id);
await admin.storage.from("course-videos").remove([ref]);
await browser.close();
console.log(failures === 0 ? "\nSUBIDA REANUDABLE: TODAS LAS PRUEBAS PASARON" : `\n${failures} PRUEBA(S) FALLARON`);
process.exit(failures === 0 ? 0 : 1);
