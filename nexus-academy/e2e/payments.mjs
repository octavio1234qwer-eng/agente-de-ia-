// Prueba de integración de pagos contra el servidor local.
// Requiere STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET de prueba en .env.local.
// Ejecutar: node e2e/payments.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import pw from "playwright";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const stripe = new Stripe("sk_test_dummy");
let failures = 0;
const check = (cond, label) => { console.log(cond ? "✔" : "✘", label); if (!cond) failures++; };

async function postStripe(event, secret = env.STRIPE_WEBHOOK_SECRET) {
  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  const res = await fetch(`${BASE}/api/webhooks/stripe`, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": header }, body: payload });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
const sessionEvent = (id, orderId, amount, currency = "mxn") => ({
  id, object: "event", type: "checkout.session.completed", api_version: "2026-10-28", created: Math.floor(Date.now() / 1000),
  data: { object: { id: `cs_test_${id}`, object: "checkout.session", metadata: { order_id: orderId }, client_reference_id: orderId, payment_status: "paid", amount_total: amount, currency, payment_intent: `pi_${id}` } },
});

// Usuario y curso de prueba
const email = `comprador.${Date.now()}@test.dev`;
const password = "Compra1234";
const { data: created, error: userErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Carlos Comprador" } });
if (userErr) throw userErr;
const userId = created.user.id;
const { data: course } = await admin.from("courses").select("id, title, price_cents, currency").eq("slug", "javascript-moderno").single();

async function pendingOrder(c, total = c.price_cents) {
  const { data: order } = await admin.from("orders").insert({ user_id: userId, provider: "stripe", currency: c.currency, subtotal_cents: total, discount_cents: 0, total_cents: total, customer_email: email }).select("id, order_number").single();
  await admin.from("order_items").insert({ order_id: order.id, item_type: "course", course_id: c.id, title: c.title, unit_price_cents: total, total_cents: total });
  return order;
}

// 1) Pago confirmado por webhook firmado
const order = await pendingOrder(course);
const evtId = `evt_${Date.now()}`;
let r = await postStripe(sessionEvent(evtId, order.id, course.price_cents));
check(r.status === 200, `webhook válido responde 200 (${r.status})`);
const { data: paid } = await admin.from("orders").select("status, provider_payment_id, paid_at").eq("id", order.id).single();
check(paid.status === "paid" && paid.provider_payment_id === `pi_${evtId}`, `la orden ${order.order_number} quedó pagada`);
const { data: enr } = await admin.from("enrollments").select("source, revoked_at").eq("user_id", userId).eq("course_id", course.id).maybeSingle();
check(enr?.source === "purchase" && !enr.revoked_at, "el acceso al curso se activó automáticamente");
const { data: mail } = await admin.from("email_log").select("status, error").eq("dedupe_key", `purchase:${order.id}`).maybeSingle();
check(Boolean(mail), `correo de compra registrado (estado: ${mail?.status}${mail?.error ? ` · ${mail.error}` : ""})`);

// 2) Reenvío del mismo evento (idempotencia)
r = await postStripe(sessionEvent(evtId, order.id, course.price_cents));
check(r.status === 200 && r.body.duplicate === true, "el mismo evento repetido se ignora (idempotente)");

// 3) Firma falsa
r = await postStripe(sessionEvent(`evt_fake_${Date.now()}`, order.id, course.price_cents), "whsec_atacante");
check(r.status === 400, `firma falsa rechazada (${r.status})`);

// 4) Importe alterado
const { data: react } = await admin.from("courses").select("id, title, price_cents, currency").eq("slug", "react-nextjs-produccion").single();
const order2 = await pendingOrder(react);
r = await postStripe(sessionEvent(`evt_mm_${Date.now()}`, order2.id, react.price_cents - 100));
const { data: mm } = await admin.from("orders").select("status, failure_reason").eq("id", order2.id).single();
check(r.status === 200 && mm.status === "pending" && /amount_mismatch/.test(mm.failure_reason ?? ""), "un importe distinto NO activa el acceso y queda para revisión");
const { data: noEnr } = await admin.from("enrollments").select("id").eq("user_id", userId).eq("course_id", react.id).maybeSingle();
check(!noEnr, "sin acceso al curso con importe alterado");

// 5) Interfaz: proveedor con credenciales inválidas => error honesto, sin cobro
const browser = await pw.chromium.launch();
const page = await (await browser.newContext()).newPage();
await page.goto(`${BASE}/login`);
await page.fill("#email", email);
await page.fill("#password", password);
await page.click('button[type="submit"]');
await page.waitForURL((u) => u.pathname === "/cuenta/cursos");
await page.goto(`${BASE}/cursos/python-ciencia-de-datos`);
await page.click("text=Comprar ahora");
await page.waitForURL((u) => u.pathname === "/checkout", { timeout: 20000 });
await page.check('input[name="terms"]');
await page.click('button:has-text("Pagar")');
await page.waitForSelector("text=No se realizó ningún cargo", { timeout: 30000 });
const { data: failed } = await admin.from("orders").select("status").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).single();
check(failed.status === "failed", "si el proveedor falla, se muestra un error honesto y la orden queda como fallida");

// 6) Cupón del 100 %: acceso sin cobro
const code = `GRATIS${Date.now().toString().slice(-5)}`;
await admin.from("coupons").insert({ code, discount_type: "percent", discount_value: 100, description: "Prueba E2E" });
await page.fill("#coupon", code);
await page.click('button:has-text("Aplicar")');
await page.waitForSelector(`text=Cupón ${code} aplicado`, { timeout: 15000 });
await page.check('input[name="terms"]');
await page.click('button:has-text("Obtener acceso")');
await page.waitForURL((u) => u.pathname === "/checkout/exito", { timeout: 30000 });
await page.waitForSelector("text=¡Pago confirmado!", { timeout: 15000 });
const { data: py } = await admin.from("courses").select("id").eq("slug", "python-ciencia-de-datos").single();
const { data: pyEnr } = await admin.from("enrollments").select("id").eq("user_id", userId).eq("course_id", py.id).maybeSingle();
const { data: cp } = await admin.from("coupons").select("redemptions_count").eq("code", code).single();
check(Boolean(pyEnr) && cp.redemptions_count === 1, "cupón del 100 %: acceso activado y canje registrado");
await page.screenshot({ path: "test-results/checkout-success.png" });
await browser.close();

console.log(failures === 0 ? "\nTODAS LAS PRUEBAS DE PAGO PASARON" : `\n${failures} PRUEBA(S) FALLARON`);
process.exit(failures === 0 ? 0 : 1);
