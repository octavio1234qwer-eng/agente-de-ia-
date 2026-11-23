// E2E: exportación CSV de pedidos y alumnos en el panel de administración.
// Ejecutar con el entorno arriba: node e2e/admin-export.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import pw from "playwright";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let failures = 0;
const check = (c, l) => { console.log(c ? "✔" : "✘", l); if (!c) failures++; };

// Datos: administrador, alumna con un pedido pagado (con RFC y un nombre «malicioso») y uno pendiente.
const ts = Date.now();
const password = "Export12345";
const adminEmail = `export.admin.${ts}@test.dev`;
const studentEmail = `export.alumna.${ts}@test.dev`;
const { data: a } = await admin.auth.admin.createUser({ email: adminEmail, password, email_confirm: true, user_metadata: { full_name: "Admin Export" } });
await admin.from("profiles").update({ role: "admin" }).eq("id", a.user.id);
const { data: s } = await admin.auth.admin.createUser({ email: studentEmail, password, email_confirm: true, user_metadata: { full_name: "Elena Exportada" } });
const { data: js } = await admin.from("courses").select("id, title, price_cents").eq("slug", "javascript-moderno").single();
const evil = '=HYPERLINK("http://malo.example","clic")';
const { data: paid } = await admin.from("orders").insert({ user_id: s.user.id, provider: "stripe", currency: "MXN", subtotal_cents: js.price_cents, discount_cents: 0, total_cents: js.price_cents, customer_email: studentEmail, customer_name: evil, billing_details: { rfc: "EXEL900101AB1", razon_social: "Elena, Exportaciones S.A." } }).select("id, order_number").single();
await admin.from("order_items").insert({ order_id: paid.id, item_type: "course", course_id: js.id, title: js.title, unit_price_cents: js.price_cents, total_cents: js.price_cents });
const { error: fErr } = await admin.rpc("fulfill_order", { p_order_id: paid.id, p_provider_payment_id: `pi_export_${ts}`, p_amount_cents: js.price_cents, p_currency: "MXN" });
if (fErr) throw fErr;
const { data: pending } = await admin.from("orders").insert({ user_id: s.user.id, provider: "mercadopago", currency: "MXN", subtotal_cents: 49900, discount_cents: 0, total_cents: 49900, customer_email: studentEmail }).select("order_number").single();

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
const yesterday = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date(Date.now() - 86400000));

const browser = await pw.chromium.launch();
async function login(email) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })).newPage();
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => u.pathname !== "/login", { timeout: 20000 });
  return page;
}
const parse = (csv) => csv.replace(/^﻿/, "").trimEnd().split("\r\n");

const adm = await login(adminEmail);
await adm.goto(`${BASE}/admin/pedidos`);
await adm.click("summary:has-text('Exportar pedidos a CSV')");
await adm.fill("#export-pedidos-desde", today);
await adm.fill("#export-pedidos-hasta", today);
await adm.selectOption("#export-pedidos-estado", "paid");
const [download] = await Promise.all([adm.waitForEvent("download"), adm.click("button:has-text('Descargar CSV')")]);
const csv = readFileSync(await download.path(), "utf8");
check(/^nexus-pedidos-\d{4}-\d{2}-\d{2}\.csv$/.test(download.suggestedFilename()), `descarga ${download.suggestedFilename()}`);
check(csv.startsWith("﻿"), "incluye BOM para que Excel lea acentos");
const lines = parse(csv);
check(lines[0].startsWith("Pedido,Creado,Pagado,Estado,Método,Cliente,Correo,RFC,Razón social,Artículos"), "encabezados en español");
const row = lines.find((l) => l.startsWith(`${paid.order_number},`));
check(Boolean(row), "incluye el pedido pagado de hoy");
check(row?.includes(",Pagado,Tarjeta (Stripe),") && row.includes("EXEL900101AB1") && row.includes('"Elena, Exportaciones S.A."'), "con estado, método, RFC y razón social (bien entrecomillada)");
check(row?.includes(`,${js.title},`) && row.includes(",MXN,899.00,0.00,899.00,0.00,899.00,") && row.endsWith(`,pi_export_${ts}`), "con artículos, importes en decimal y referencia del pago");
check(row?.includes(`"'=HYPERLINK(""http://malo.example"",""clic"")"`), "neutraliza la fórmula maliciosa del nombre (no se ejecuta en Excel)");
check(!lines.some((l) => l.startsWith(`${pending.order_number},`)), "el filtro de estado excluye el pedido pendiente");

// Filtros por URL
const ayer = await adm.request.get(`${BASE}/api/admin/export/pedidos?desde=${yesterday}&hasta=${yesterday}`);
check(ayer.ok() && !(await ayer.text()).includes(paid.order_number), "el rango de fechas excluye pedidos fuera del periodo");
const todos = await (await adm.request.get(`${BASE}/api/admin/export/pedidos?desde=${today}`)).text();
check(todos.includes(paid.order_number) && todos.includes(pending.order_number), "sin filtro de estado incluye pagados y pendientes");
check((await adm.request.get(`${BASE}/api/admin/export/pedidos?desde=${today}&hasta=${yesterday}`)).status() === 400, "un rango al revés responde 400");
check((await adm.request.get(`${BASE}/api/admin/export/pedidos?estado=inventado`)).status() === 400, "un estado inválido responde 400");
check((await adm.request.get(`${BASE}/api/admin/export/otra-cosa`)).status() === 404, "una exportación desconocida responde 404");

// Alumnos
await adm.goto(`${BASE}/admin/alumnos`);
await adm.click("summary:has-text('Exportar alumnos a CSV')");
await adm.fill("#export-alumnos-desde", today);
const [dl2] = await Promise.all([adm.waitForEvent("download"), adm.click("button:has-text('Descargar CSV')")]);
const students = parse(readFileSync(await dl2.path(), "utf8"));
check(students[0] === "Nombre,Correo,Registro,Cursos inscritos,Cursos completados,Certificados,Total pagado neto (MXN)", "alumnos: encabezados");
const srow = students.find((l) => l.includes(studentEmail));
check(srow?.startsWith("Elena Exportada,") && srow.endsWith(",1,0,0,899.00"), `alumnos: inscripción y total pagado (${srow})`);
check(!students.some((l) => l.includes(adminEmail)), "alumnos: no incluye administradores");

// Permisos
const stu = await login(studentEmail);
check((await stu.request.get(`${BASE}/api/admin/export/pedidos`)).status() === 403, "un alumno recibe 403");
const anon = await browser.newContext();
check((await anon.request.get(`${BASE}/api/admin/export/pedidos`)).status() === 401, "sin sesión recibe 401");

// Auditoría
const { data: logs } = await admin.from("admin_audit_log").select("entity, details").eq("actor_id", a.user.id).eq("action", "export");
check(logs?.some((l) => l.entity === "orders" && l.details?.estado === "paid" && l.details?.rows >= 1) && logs.some((l) => l.entity === "students"), `cada descarga queda auditada (${logs?.length ?? 0} registros)`);

await browser.close();
console.log(failures ? `\n${failures} fallo(s)` : "\nTodo OK");
process.exit(failures ? 1 : 0);
