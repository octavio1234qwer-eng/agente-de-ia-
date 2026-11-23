// E2E del panel de administración. Ejecutar: node e2e/admin.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import pw from "playwright";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let failures = 0;
const check = (c, l) => { console.log(c ? "✔" : "✘", l); if (!c) failures++; };
const ts = Date.now();

// Archivos de prueba
mkdirSync("test-results", { recursive: true });
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
writeFileSync("test-results/cover.png", png);
const doc = await PDFDocument.create(); doc.addPage([200, 200]);
writeFileSync("test-results/material.pdf", await doc.save());

// Usuarios
const adminEmail = `admin.${ts}@test.dev`, studentEmail = `alumno.adm.${ts}@test.dev`, password = "Panel12345";
const { data: a } = await admin.auth.admin.createUser({ email: adminEmail, password, email_confirm: true, user_metadata: { full_name: "Ada Admin" } });
await admin.from("profiles").update({ role: "admin" }).eq("id", a.user.id);
const { data: s } = await admin.auth.admin.createUser({ email: studentEmail, password, email_confirm: true, user_metadata: { full_name: "Sofía Alumna" } });

const browser = await pw.chromium.launch();
async function login(email) {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  page.on("pageerror", (e) => { console.log("pageerror:", String(e)); failures++; });
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => u.pathname === "/cuenta/cursos");
  return page;
}

// 1) Un alumno no entra al panel
const student = await login(studentEmail);
await student.goto(`${BASE}/admin`);
check(new URL(student.url()).pathname === "/", "un alumno es expulsado de /admin");

// 2) Crear curso
const page = await login(adminEmail);
await page.goto(`${BASE}/admin/cursos/nuevo`);
const title = `Curso de prueba E2E ${ts}`;
await page.fill("#title", title);
await page.fill("#subtitle", "Creado por la prueba automática del panel");
await page.fill("#price", "499");
await page.fill("#compare_at", "799");
await page.selectOption("#status", "published");
await page.fill("#learn", "Objetivo uno\nObjetivo dos");
await page.click('button:has-text("Crear curso")');
await page.waitForURL(/\/admin\/cursos\/[0-9a-f-]{36}\?creado=1/, { timeout: 20000 });
const courseId = page.url().split("/admin/cursos/")[1].split("?")[0];
check(true, "curso creado y redirigido al editor");

// Portada
await page.locator('input[type="file"][accept^="image"]').setInputFiles("test-results/cover.png");
await page.waitForSelector("text=subido", { timeout: 20000 });
await page.click('button:has-text("Guardar curso")');
await page.waitForSelector("text=Curso guardado", { timeout: 15000 });
const { data: course } = await admin.from("courses").select("slug, cover_url, price_cents, compare_at_price_cents").eq("id", courseId).single();
check(course.cover_url?.includes("course-covers") && course.price_cents === 49900 && course.compare_at_price_cents === 79900, "portada subida y precios guardados en centavos");

// Temario: módulo + lección
await page.fill('input[aria-label="Título del nuevo módulo"]', "Módulo de prueba");
await page.click('button:has-text("Módulo")');
await page.waitForSelector('input[aria-label="Título de la nueva lección"]', { timeout: 15000 });
await page.fill('input[aria-label="Título de la nueva lección"]', "Lección de lectura");
await page.selectOption('select[aria-label="Tipo de lección"]', "article");
await page.click('button:has-text("Lección")');
await page.waitForURL(/\/lecciones\//, { timeout: 15000 });
const lessonId = page.url().split("/lecciones/")[1];
await page.fill("#minutes", "7");
await page.fill("#body", "## Hola\n\nContenido secreto de la lección E2E.");
await page.click('button:has-text("Guardar lección")');
await page.waitForSelector("text=Lección guardada", { timeout: 15000 });
await page.locator('input[type="file"]').setInputFiles("test-results/material.pdf");
await page.waitForSelector("text=material", { timeout: 20000 });
await page.reload();
check(await page.isVisible("text=material"), "recurso PDF subido y listado");
const { data: c2 } = await admin.from("courses").select("lessons_count, duration_minutes").eq("id", courseId).single();
check(c2.lessons_count === 1 && c2.duration_minutes === 7, "duración y conteo del curso se recalculan solos");

// Visible en el catálogo; contenido protegido
const pub = await fetch(`${BASE}/cursos/${course.slug}`).then((r) => r.text());
check(pub.includes(title) && pub.includes("Lección de lectura"), "el curso publicado aparece con su temario");
check(!pub.includes("Contenido secreto"), "el contenido de la lección no aparece en la página pública");
await student.goto(`${BASE}/aprender/${course.slug}/${lessonId}`);
check(await student.isVisible("text=Lección bloqueada"), "un alumno sin compra no ve la lección");

// Otorgar acceso al alumno desde el panel
await page.goto(`${BASE}/admin/alumnos/${s.user.id}`);
await page.selectOption('select[aria-label="Curso"]', courseId);
await page.click('button:has-text("Otorgar acceso")');
await page.waitForSelector(`text=${title}`, { timeout: 15000 });
await student.goto(`${BASE}/aprender/${course.slug}/${lessonId}`);
check(await student.isVisible("text=Contenido secreto de la lección E2E"), "tras otorgar acceso, el alumno ve la lección");
const res = await student.evaluate(async (id) => (await fetch(`/api/resources/${id}`, { redirect: "manual" })).status, (await admin.from("lesson_resources").select("id").eq("lesson_id", lessonId).single()).data.id);
check(res === 307 || res === 302 || res === 0, `descarga del recurso redirige a URL firmada (${res})`);

// Cupón
await page.goto(`${BASE}/admin/cupones`);
await page.fill("#code", `E2E${ts}`.slice(0, 20));
await page.fill("#discount_value", "15");
await page.click('button:has-text("Crear cupón")');
await page.waitForSelector("text=guardado", { timeout: 15000 });
check(await page.isVisible(`text=${`E2E${ts}`.slice(0, 20).toUpperCase()}`), "cupón creado y listado");

// Reembolso manual de un pedido pagado (primero se retira el acceso otorgado a mano)
await admin.from("enrollments").update({ revoked_at: new Date().toISOString() }).eq("user_id", s.user.id).eq("course_id", courseId);
const { data: order } = await admin.from("orders").insert({ user_id: s.user.id, provider: "stripe", currency: "MXN", subtotal_cents: 49900, discount_cents: 0, total_cents: 49900, customer_email: studentEmail }).select("id").single();
await admin.from("order_items").insert({ order_id: order.id, item_type: "course", course_id: courseId, title, unit_price_cents: 49900, total_cents: 49900 });
await admin.rpc("fulfill_order", { p_order_id: order.id, p_provider_payment_id: `pi_admin_${ts}`, p_amount_cents: 49900, p_currency: "MXN" });
await page.goto(`${BASE}/admin/pedidos/${order.id}`);
await page.check('input[name="manual"]');
await page.click('button:has-text("Procesar reembolso")');
await page.waitForSelector("text=Reembolso total registrado", { timeout: 15000 });
const { data: refunded } = await admin.from("orders").select("status, refunded_cents").eq("id", order.id).single();
const { data: enr } = await admin.from("enrollments").select("revoked_at").eq("user_id", s.user.id).eq("course_id", courseId).single();
check(refunded.status === "refunded" && refunded.refunded_cents === 49900 && enr.revoked_at, "reembolso total registrado y acceso retirado");

// Todas las secciones cargan
for (const path of ["/admin", "/admin/cursos", "/admin/categorias", "/admin/instructores", "/admin/paquetes", "/admin/alumnos", "/admin/pedidos", "/admin/cupones", "/admin/resenas", "/admin/correos"]) {
  const r = await page.goto(`${BASE}${path}`);
  check(r.status() === 200, `${path} carga (${r.status()})`);
}
const { data: audit } = await admin.from("admin_audit_log").select("action").eq("actor_id", a.user.id);
check((audit ?? []).length >= 5, `acciones registradas en auditoría (${audit?.length})`);

// Eliminar curso sin alumnos activos se archiva si hubo inscripciones
await page.goto(`${BASE}/admin/cursos/${courseId}`);
page.once("dialog", (d) => d.accept());
await page.click('button:has-text("Eliminar curso")');
await page.waitForURL(/archivado=1|eliminado=1/, { timeout: 15000 });
check(page.url().includes("archivado=1"), "un curso con historial de alumnos se archiva en lugar de borrarse");
await page.screenshot({ path: "test-results/admin-course.png", fullPage: true });

await browser.close();
console.log(failures === 0 ? "\nTODAS LAS PRUEBAS DEL PANEL PASARON" : `\n${failures} PRUEBA(S) FALLARON`);
process.exit(failures === 0 ? 0 : 1);
