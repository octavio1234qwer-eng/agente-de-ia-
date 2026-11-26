// E2E: «Descargar mis datos» (derecho de acceso ARCO) en Configuración.
// Ejecutar con el entorno arriba: node e2e/my-data-export.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import pw from "playwright";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let failures = 0;
const check = (c, l) => { console.log(c ? "✔" : "✘", l); if (!c) failures++; };
const must = ({ data, error }) => { if (error) throw error; return data; };

const ts = Date.now();
const password = "MisDatos123";
const mk = async (tag, name) => (await admin.auth.admin.createUser({ email: `datos.${tag}.${ts}@test.dev`, password, email_confirm: true, user_metadata: { full_name: name } })).data.user;
const ana = await mk("ana", "Ana Datos");
const beto = await mk("beto", "Beto Ajeno");
const adm = await mk("admin", "Admin Datos");
await admin.from("profiles").update({ role: "admin" }).eq("id", adm.id);

const git = must(await admin.from("courses").select("id, title").eq("slug", "git-github-esencial").single());
const js = must(await admin.from("courses").select("id, title, price_cents").eq("slug", "javascript-moderno").single());
const lesson = must(await admin.from("lessons").select("id, title").eq("course_id", git.id).eq("type", "article").order("position").limit(1).single());
must(await admin.from("enrollments").insert([{ user_id: ana.id, course_id: git.id, source: "free" }, { user_id: beto.id, course_id: git.id, source: "free" }]));
must(await admin.from("lesson_notes").insert([
  { user_id: ana.id, lesson_id: lesson.id, course_id: git.id, body: `Nota privada de Ana ${ts}` },
  { user_id: beto.id, lesson_id: lesson.id, course_id: git.id, body: `Nota privada de Beto ${ts}` },
]));
must(await admin.from("favorites").insert({ user_id: ana.id, course_id: js.id }));
must(await admin.from("learning_activity").insert({ user_id: ana.id, at_hour: new Date(Math.floor(Date.now() / 3600_000) * 3600_000).toISOString() }));
const order = must(await admin.from("orders").insert({ user_id: ana.id, provider: "stripe", currency: "MXN", subtotal_cents: js.price_cents, discount_cents: 0, total_cents: js.price_cents, customer_email: ana.email, billing_details: { rfc: "DAAN900101AB1" } }).select("id, order_number").single());
must(await admin.from("order_items").insert({ order_id: order.id, item_type: "course", course_id: js.id, title: js.title, unit_price_cents: js.price_cents, total_cents: js.price_cents }));
must(await admin.rpc("fulfill_order", { p_order_id: order.id, p_provider_payment_id: `pi_datos_${ts}`, p_amount_cents: js.price_cents, p_currency: "MXN" }));

const browser = await pw.chromium.launch();
async function login(email) {
  const page = await (await browser.newContext({ acceptDownloads: true })).newPage();
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => u.pathname !== "/login", { timeout: 20000 });
  return page;
}

const page = await login(ana.email);
await page.goto(`${BASE}/cuenta/ajustes`);
const [download] = await Promise.all([page.waitForEvent("download"), page.click("a:has-text('Descargar mis datos (JSON)')")]);
check(/^mis-datos-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()), `descarga ${download.suggestedFilename()}`);
const raw = readFileSync(await download.path(), "utf8");
const d = JSON.parse(raw);
check(d.perfil?.email === ana.email && d.perfil?.full_name === "Ana Datos", "incluye su perfil");
check(d.inscripciones?.some((e) => e.course?.title === git.title) && d.inscripciones.some((e) => e.course?.title === js.title), "inscripciones (gratis y comprada) con el nombre del curso");
check(d.notas?.length === 1 && d.notas[0].body === `Nota privada de Ana ${ts}`, "sus notas");
check(d.compras?.length === 1 && d.compras[0].order_number === order.order_number && d.compras[0].items?.[0]?.title === js.title && d.compras[0].billing_details?.rfc === "DAAN900101AB1", "sus compras con artículos y datos de facturación");
check(d.favoritos?.[0]?.course?.title === js.title, "favoritos");
check(d.actividad_de_estudio_por_hora?.length === 1, "actividad de estudio");
const keys = ["perfil", "inscripciones", "progreso_por_leccion", "evaluaciones", "notas", "certificados", "compras", "cupones_usados", "favoritos", "resenas", "carrito", "conversaciones_ia", "actividad_de_estudio_por_hora", "correos_enviados", "boletin"];
check(keys.every((k) => k in d), "todas las secciones presentes");
check(!raw.includes(beto.email) && !raw.includes(`Nota privada de Beto ${ts}`) && !raw.includes(beto.id), "nada de otro alumno");

// Un administrador solo obtiene sus propios datos por esta vía
const admPage = await login(adm.email);
const admRaw = await (await admPage.request.get(`${BASE}/api/account/export`)).text();
check(JSON.parse(admRaw).perfil?.email === adm.email && !admRaw.includes(ana.email) && !admRaw.includes(`Nota privada de Ana ${ts}`), "un admin no puede descargar datos de alumnos por aquí");

const anon = await (await browser.newContext()).request.get(`${BASE}/api/account/export`);
check(anon.status() === 401, "sin sesión responde 401");
const res = await page.request.get(`${BASE}/api/account/export`);
check(res.headers()["cache-control"]?.includes("no-store"), "la respuesta no se guarda en caché");
await browser.close();
console.log(failures ? `\n${failures} fallo(s)` : "\nTodo OK");
process.exit(failures ? 1 : 0);
