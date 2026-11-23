// E2E del aula virtual: acceso, vista previa, progreso, evaluación, certificado, verificación y PDF.
// Ejecutar con el entorno arriba: node e2e/classroom.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import pw from "playwright";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let failures = 0;
const check = (c, l) => { console.log(c ? "✔" : "✘", l); if (!c) failures++; };

const email = `aula.${Date.now()}@test.dev`;
const password = "Aprende123";
await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Lucía Estudiante Ramírez" } });

const browser = await pw.chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`${BASE}/login`);
await page.fill("#email", email);
await page.fill("#password", password);
await page.click('button[type="submit"]');
await page.waitForURL((u) => u.pathname === "/cuenta/cursos");

// Curso de pago sin comprar: lección normal bloqueada, vista previa visible
const { data: js } = await admin.from("courses").select("id").eq("slug", "javascript-moderno").single();
const { data: jsLessons } = await admin.from("lessons").select("id, is_preview, position, modules(position)").eq("course_id", js.id);
const locked = jsLessons.find((l) => !l.is_preview);
const preview = jsLessons.find((l) => l.is_preview);
await page.goto(`${BASE}/aprender/javascript-moderno/${locked.id}`);
check(await page.isVisible("text=Lección bloqueada"), "lección de pago bloqueada sin compra");
const lockedHtml = await page.content();
const { data: lockedBody } = await admin.from("lesson_contents").select("body").eq("lesson_id", locked.id).single();
check(!lockedHtml.includes(lockedBody.body.slice(0, 40)), "el contenido de pago no se envía al navegador");
await page.goto(`${BASE}/aprender/javascript-moderno/${preview.id}`);
check(await page.isVisible("text=Vista previa gratuita"), "la lección de vista previa sí se puede ver");

// Curso gratuito completo
await page.goto(`${BASE}/cursos/git-github-esencial`);
await page.click("text=Inscribirme gratis");
await page.waitForURL(/\/aprender\/git-github-esencial\/[0-9a-f-]{36}/, { timeout: 20000 });
check(true, "inscripción gratis lleva directo a la primera lección");
const { data: git } = await admin.from("courses").select("id").eq("slug", "git-github-esencial").single();
const { data: lessons } = await admin.from("lessons").select("id, type, title, position").eq("course_id", git.id).order("position");
for (const l of lessons.filter((x) => x.type !== "quiz")) {
  await page.goto(`${BASE}/aprender/git-github-esencial/${l.id}`);
  await page.click("text=Marcar como completada");
  await page.waitForSelector("button:has-text('Completada')", { timeout: 15000 });
}
check(true, "lecciones de lectura marcadas como completadas");
const quiz = lessons.find((x) => x.type === "quiz");
await page.goto(`${BASE}/aprender/git-github-esencial/${quiz.id}`);
const radiosPerQ = await page.locator('[role="radiogroup"][aria-label^="Pregunta"]').count();
// Intento incorrecto: elige la última opción en cada pregunta
const { data: qs } = await admin.from("quiz_questions").select("id, correct_index, options").eq("lesson_id", quiz.id).order("position");
for (let i = 0; i < qs.length; i++) {
  const group = page.locator('[role="radiogroup"]').nth(i);
  const wrong = qs[i].correct_index === 0 ? 1 : 0;
  await group.locator("input[type=radio]").nth(wrong).check();
}
await page.click("text=Enviar respuestas");
await page.waitForSelector("text=Aún no apruebas", { timeout: 15000 });
check(radiosPerQ === qs.length, `evaluación muestra ${qs.length} preguntas`);
check(true, "respuestas incorrectas: no aprueba");
const html = await page.content();
check(!html.includes("correct_index"), "las respuestas correctas no se filtran al navegador");
await page.click("text=Reintentar");
for (let i = 0; i < qs.length; i++) {
  await page.locator('[role="radiogroup"]').nth(i).locator("input[type=radio]").nth(qs[i].correct_index).check();
}
await page.click("text=Enviar respuestas");
await page.waitForSelector("text=¡Aprobado!", { timeout: 15000 });
check(true, "respuestas correctas: aprueba");
await page.goto(`${BASE}/aprender/git-github-esencial/${quiz.id}`);
check(await page.isVisible("text=¡Completaste el curso!"), "curso al 100 % muestra el aviso de certificado");

// Certificado
await page.goto(`${BASE}/cuenta/certificados`);
const code = (await page.locator("p.font-mono").first().textContent())?.trim();
check(/^NX-[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(code ?? ""), `certificado emitido: ${code}`);
await page.goto(`${BASE}/certificados/${code}`);
check(await page.isVisible("text=Certificado auténtico"), "página pública de verificación válida");
check(await page.isVisible("text=Lucía Estudiante Ramírez"), "el certificado muestra el nombre del alumno");
await page.screenshot({ path: "test-results/certificate.png", fullPage: true });
const pdf = await fetch(`${BASE}/api/certificates/${code}/pdf`);
const bytes = new Uint8Array(await pdf.arrayBuffer());
check(pdf.status === 200 && pdf.headers.get("content-type") === "application/pdf" && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-", `PDF descargable (${bytes.length} bytes)`);
const fake = await fetch(`${BASE}/certificados/NX-AAAAA-BBBBB`);
check(fake.status === 404, `código inexistente devuelve 404 (${fake.status})`);
await page.goto(`${BASE}/verificar?code=${code.toLowerCase()}`);
check(page.url().endsWith(`/certificados/${code}`), "verificar con el código lleva al certificado");

// NEXUS AI sin clave: mensaje honesto, sin respuesta inventada
const ai = await page.evaluate(async (lessonId) => {
  const r = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "Hola", lessonId }) });
  return { status: r.status, body: await r.json().catch(() => null) };
}, quiz.id);
check(ai.status === 503 && /no está activado/.test(ai.body?.error ?? ""), `NEXUS AI sin credenciales responde 503 honesto`);

await page.goto(`${BASE}/aprender/git-github-esencial/${lessons[0].id}`);
await page.screenshot({ path: "test-results/classroom.png" });
await page.setViewportSize({ width: 390, height: 844 });
await page.reload();
await page.screenshot({ path: "test-results/classroom-mobile.png" });
console.log("errores de página:", errors.length ? errors : "ninguno");
await browser.close();
console.log(failures === 0 ? "\nTODAS LAS PRUEBAS DEL AULA PASARON" : `\n${failures} PRUEBA(S) FALLARON`);
process.exit(failures === 0 ? 0 : 1);
