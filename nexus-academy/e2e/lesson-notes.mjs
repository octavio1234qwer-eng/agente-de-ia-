// E2E de las notas personales por lección.
// Ejecutar con el entorno arriba: node e2e/lesson-notes.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import pw from "playwright";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let failures = 0;
const check = (c, l) => { console.log(c ? "✔" : "✘", l); if (!c) failures++; };

const ts = Date.now();
const password = "Notas12345";
const users = { nora: `notas.${ts}@test.dev`, otto: `otro.${ts}@test.dev` };
for (const [name, email] of Object.entries(users)) {
  await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name === "nora" ? "Nora Notas" : "Otto Otro" } });
}

const browser = await pw.chromium.launch();
async function login(email, viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => u.pathname.startsWith("/cuenta"), { timeout: 20000 });
  return page;
}
const errors = [];

const page = await login(users.nora);
page.on("pageerror", (e) => errors.push(String(e)));

// Sin notas
await page.goto(`${BASE}/cuenta/notas`);
check(await page.isVisible("text=Aún no tienes notas"), "sin notas explica dónde tomarlas");
check(await page.isVisible('nav[aria-label="Mi cuenta"] >> text=Mis notas'), "el menú de la cuenta enlaza «Mis notas»");

// Lección de pago sin comprar: no hay notas (está bloqueada)
const { data: js } = await admin.from("courses").select("id").eq("slug", "javascript-moderno").single();
const { data: locked } = await admin.from("lessons").select("id").eq("course_id", js.id).eq("is_preview", false).limit(1).single();
await page.goto(`${BASE}/aprender/javascript-moderno/${locked.id}`);
check(await page.isVisible("text=Lección bloqueada") && !(await page.isVisible("#lesson-note")), "una lección bloqueada no muestra notas");

// Se inscribe al curso gratuito y toma una nota
await page.goto(`${BASE}/cursos/git-github-esencial`);
await page.click("text=Inscribirme gratis");
await page.waitForURL(/\/aprender\/git-github-esencial\/[0-9a-f-]{36}/, { timeout: 20000 });
const lessonUrl = page.url().split("?")[0];
const save = page.locator('button:has-text("Guardar nota")');
check(await page.isVisible("#lesson-note"), "la lección muestra «Mis notas»");
check(await save.isDisabled(), "«Guardar nota» está deshabilitado sin cambios");
const note = "Recordar: git add antes de commit.\n<script>alert('x')</script>\n- usar mensajes claros";
await page.fill("#lesson-note", note);
check(await page.isVisible("text=Cambios sin guardar"), "avisa de cambios sin guardar");
await save.click();
await page.waitForSelector("#lesson-note-status:has-text('Nota guardada')", { timeout: 15000 });
check((await page.inputValue("#lesson-note")) === note, "el texto sigue en el editor después de guardar");
check(await save.isDisabled(), "tras guardar ya no hay cambios pendientes");

// Persistencia
await page.reload();
check((await page.inputValue("#lesson-note")) === note.trim(), "la nota persiste al recargar");
check(await page.isVisible("#lesson-note-status:has-text('Guardada el')"), "muestra cuándo se guardó");

// Editar con Ctrl+Enter
await page.fill("#lesson-note", `${note}\nEditada con atajo`);
await page.press("#lesson-note", "Control+Enter");
await page.waitForSelector("#lesson-note-status:has-text('Nota guardada')", { timeout: 15000 });
const { data: dbNote } = await admin.from("lesson_notes").select("body, course_id").like("body", "%Editada con atajo%").maybeSingle();
check(Boolean(dbNote), "Ctrl+Enter guarda la nota");
const { data: git } = await admin.from("courses").select("id").eq("slug", "git-github-esencial").single();
check(dbNote?.course_id === git.id, "la nota queda ligada al curso correcto");

// Límite de longitud
await page.fill("#lesson-note", "x".repeat(5001));
check(await page.isVisible("text=5001/5000") && (await save.isDisabled()), "no deja guardar más de 5000 caracteres");
await page.reload();

// Página «Mis notas»
await page.goto(`${BASE}/cuenta/notas`);
const card = page.locator('[data-testid="note"]');
check((await card.count()) === 1, "«Mis notas» lista la nota");
check(await card.first().locator("text=Editada con atajo").isVisible(), "muestra el texto completo de la nota");
check((await page.content()).includes("&lt;script&gt;alert('x')&lt;/script&gt;"), "el HTML de la nota se muestra como texto, sin ejecutarse");
check(await page.isVisible("text=Git y GitHub") || (await page.locator("section h3").count()) === 1, "agrupa por curso");

// Descarga en Markdown
const [download] = await Promise.all([page.waitForEvent("download"), page.click("text=Descargar (.md)")]);
const md = readFileSync(await download.path(), "utf8");
check(download.suggestedFilename() === "mis-notas-nexus-academy.md", "descarga un archivo .md");
check(md.includes("# Mis notas · NEXUS ACADEMY") && md.includes("Editada con atajo") && md.includes("## "), "el archivo contiene las notas agrupadas por curso");

// «Ir a la lección» vuelve al editor
await card.first().locator("text=Ir a la lección").click();
await page.waitForURL(/\/aprender\/git-github-esencial\/[0-9a-f-]{36}/, { timeout: 20000 });
check((await page.inputValue("#lesson-note")).includes("Editada con atajo"), "«Ir a la lección» abre la lección con su nota");

// Privacidad: otro alumno no ve ni descarga la nota
const other = await login(users.otto);
await other.goto(`${BASE}/cuenta/notas`);
check(await other.isVisible("text=Aún no tienes notas"), "otro alumno no ve notas ajenas");
const otherExport = await other.request.get(`${BASE}/api/notes/export`);
check(otherExport.ok() && !(await otherExport.text()).includes("Editada con atajo"), "la descarga de otro alumno no incluye notas ajenas");
const anon = await browser.newContext();
const anonExport = await anon.request.get(`${BASE}/api/notes/export`);
check(anonExport.status() === 401, "sin sesión la descarga responde 401");

// Borrar
await page.goto(lessonUrl);
page.once("dialog", (d) => d.accept());
await page.click('button:has-text("Borrar")');
await page.waitForSelector("#lesson-note-status:has-text('Nota borrada')", { timeout: 15000 });
check((await page.inputValue("#lesson-note")) === "", "«Borrar» vacía el editor");
const { count } = await admin.from("lesson_notes").select("lesson_id", { count: "exact", head: true }).like("body", "%Editada con atajo%");
check(count === 0, "la nota se elimina de la base de datos");

// Móvil
const mobile = await login(users.nora, { width: 390, height: 844 });
await mobile.goto(lessonUrl);
await mobile.fill("#lesson-note", "Nota desde el celular");
await mobile.click('button:has-text("Guardar nota")');
await mobile.waitForSelector("#lesson-note-status:has-text('Nota guardada')", { timeout: 15000 });
await mobile.goto(`${BASE}/cuenta/notas`);
const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
check(!overflow && (await mobile.isVisible("text=Nota desde el celular")), "funciona en móvil sin desbordarse");
// El menú se desplaza al hidratar la página: se espera a que la pestaña activa quede a la vista.
const activeTab = await mobile
  .waitForFunction(() => { const a = document.querySelector('nav[aria-label="Mi cuenta"] [aria-current="page"]'); const r = a?.getBoundingClientRect(); return r && r.left >= 0 && r.right <= window.innerWidth; }, null, { timeout: 8000 })
  .then(() => true, () => false);
check(activeTab, "en móvil la pestaña activa del menú queda visible");
await mobile.screenshot({ path: process.env.E2E_SHOT ?? "/tmp/lesson-notes-mobile.png", fullPage: true });

check(errors.length === 0, `sin errores de JavaScript${errors.length ? `: ${errors.join(" | ")}` : ""}`);
await browser.close();
console.log(failures ? `\n${failures} fallo(s)` : "\nTodo OK");
process.exit(failures ? 1 : 0);
