// E2E: reporte de ingresos por producto en el admin (página y CSV).
// Usa un pedido con fecha de pago aislada (marzo de 2001) para no mezclarse con otros datos.
// Ejecutar con el entorno arriba: node e2e/admin-revenue.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import pw from "playwright";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let failures = 0;
const check = (c, l) => { console.log(c ? "✔" : "✘", l); if (!c) failures++; };

const ts = Date.now();
const password = "Ingresos123";
const adminEmail = `rev.admin.${ts}@test.dev`;
const studentEmail = `rev.alumna.${ts}@test.dev`;
const { data: a } = await admin.auth.admin.createUser({ email: adminEmail, password, email_confirm: true, user_metadata: { full_name: "Admin Ingresos" } });
await admin.from("profiles").update({ role: "admin" }).eq("id", a.user.id);
const { data: s } = await admin.auth.admin.createUser({ email: studentEmail, password, email_confirm: true, user_metadata: { full_name: "Alumna Ingresos" } });
const { data: courses } = await admin.from("courses").select("id, slug, title").in("slug", ["javascript-moderno", "python-ciencia-de-datos"]);
const A = courses.find((c) => c.slug === "javascript-moderno");
const B = courses.find((c) => c.slug === "python-ciencia-de-datos");

// Pedido: A 899 − 100 de cupón, B 499 − 50 → total 1 248; reembolso parcial de 200.
const { data: order } = await admin.from("orders").insert({ user_id: s.user.id, provider: "stripe", currency: "MXN", subtotal_cents: 139800, discount_cents: 15000, total_cents: 124800, customer_email: studentEmail }).select("id").single();
await admin.from("order_items").insert([
  { order_id: order.id, item_type: "course", course_id: A.id, title: A.title, unit_price_cents: 89900, discount_cents: 10000, total_cents: 79900 },
  { order_id: order.id, item_type: "course", course_id: B.id, title: B.title, unit_price_cents: 49900, discount_cents: 5000, total_cents: 44900 },
]);
const { error: e1 } = await admin.rpc("fulfill_order", { p_order_id: order.id, p_provider_payment_id: `pi_rev_${ts}`, p_amount_cents: 124800, p_currency: "MXN" });
const { error: e2 } = await admin.rpc("record_refund", { p_order_id: order.id, p_amount_cents: 20000, p_provider_refund_id: `re_rev_${ts}`, p_reason: "prueba", p_actor: a.user.id });
if (e1 || e2) throw e1 ?? e2;
// Limpia otros pedidos de prueba que hayan quedado en ese mes aislado y fija la fecha de pago.
await admin.from("orders").update({ paid_at: "2001-03-15T18:00:00Z" }).eq("id", order.id);
const { data: others } = await admin.from("orders").select("id").gte("paid_at", "2001-03-01T06:00:00Z").lt("paid_at", "2001-04-01T06:00:00Z").neq("id", order.id);
if (others?.length) await admin.from("orders").update({ paid_at: "2000-01-01T00:00:00Z" }).in("id", others.map((o) => o.id));
// Un pedido pendiente en el mismo mes no debe contar.
await admin.from("orders").insert({ user_id: s.user.id, provider: "paypal", currency: "MXN", subtotal_cents: 49900, discount_cents: 0, total_cents: 49900, customer_email: studentEmail, paid_at: "2001-03-20T18:00:00Z" });

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
const errors = [];
const adm = await login(adminEmail);
adm.on("pageerror", (e) => errors.push(String(e)));

await adm.goto(`${BASE}/admin`);
check(await adm.isVisible('nav >> text=Ingresos'), "el menú del admin enlaza «Ingresos»");
await adm.goto(`${BASE}/admin/ingresos`);
check(await adm.isVisible('a[aria-current="true"]:has-text("Este mes")'), "por defecto muestra el mes en curso");

await adm.goto(`${BASE}/admin/ingresos?desde=2001-03-01&hasta=2001-03-31`);
const rows = adm.locator('[data-testid="revenue-row"]');
check((await rows.count()) === 2, "una fila por curso vendido (el pedido pendiente no cuenta)");
const text = async (loc) => (await loc.innerText()).replace(/\s+/g, " ");
const rowA = await text(rows.filter({ hasText: A.title }));
const rowB = await text(rows.filter({ hasText: B.title }));
const nb = (s) => s.replace(/ /g, " ");
check(nb(rowA).includes("$899.00 $100.00 $128.05 $670.95"), `curso A: bruto, descuento, reembolso proporcional y neto (${nb(rowA)})`);
check(nb(rowB).includes("$499.00 $50.00 $71.95 $377.05"), `curso B: mismo reparto (${nb(rowB)})`);
const total = nb(await text(adm.locator('[data-testid="revenue-total"]')));
check(total.includes("$1,398.00 $150.00 $200.00 $1,048.00"), `fila de totales cuadra con el pedido (${total})`);
const summary = nb(await text(adm.locator('[data-testid="revenue-summary"]')));
check(summary.includes("Neto $1,048.00") && summary.includes("Reembolsos $200.00") && summary.includes("Unidades 2"), "resumen superior");

// Periodo sin ventas e inválido
await adm.goto(`${BASE}/admin/ingresos?desde=2001-05-01&hasta=2001-05-31`);
check(await adm.isVisible("text=Sin ventas cobradas en este periodo."), "un periodo sin ventas lo dice");
await adm.goto(`${BASE}/admin/ingresos?desde=2001-05-31&hasta=2001-05-01`);
check(await adm.isVisible("[role=alert]:has-text('no es válido')"), "un periodo al revés muestra un error");

// CSV
await adm.goto(`${BASE}/admin/ingresos?desde=2001-03-01&hasta=2001-03-31`);
const [download] = await Promise.all([adm.waitForEvent("download"), adm.click("a:has-text('Exportar CSV')")]);
const csv = readFileSync(await download.path(), "utf8").replace(/^﻿/, "");
check(csv.startsWith("Producto,Tipo,Moneda,Pedidos,Unidades,Bruto,Descuentos,Reembolsos,Neto\r\n"), "CSV con encabezados");
check(csv.includes(`${A.title},Curso,MXN,1,1,899.00,100.00,128.05,670.95`) && csv.includes(",Curso,MXN,1,1,499.00,50.00,71.95,377.05"), "CSV con los mismos números que la página");

// Permisos
const stu = await login(studentEmail);
await stu.goto(`${BASE}/admin/ingresos`);
check(new URL(stu.url()).pathname !== "/admin/ingresos", "un alumno no entra a la página");
check((await stu.request.get(`${BASE}/api/admin/export/ingresos`)).status() === 403, "ni descarga el CSV (403)");

check(errors.length === 0, `sin errores de JavaScript${errors.length ? `: ${errors.join(" | ")}` : ""}`);
await browser.close();
console.log(failures ? `\n${failures} fallo(s)` : "\nTodo OK");
process.exit(failures ? 1 : 0);
