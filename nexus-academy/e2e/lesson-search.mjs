// E2E de la búsqueda de texto completo dentro de las lecciones.
// Ejecutar con el entorno arriba: node e2e/lesson-search.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import pw from "playwright";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let failures = 0;
const check = (c, l) => { console.log(c ? "✔" : "✘", l); if (!c) failures++; };

const email = `busca.${Date.now()}@test.dev`;
const password = "Busca12345";
await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Bruno Buscador" } });

const browser = await pw.chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

// Sin sesión: redirige a login conservando la búsqueda.
await page.goto(`${BASE}/cuenta/buscar?q=commit`);
check(new URL(page.url()).pathname === "/login", "sin sesión la búsqueda pide iniciar sesión");

await page.fill("#email", email);
await page.fill("#password", password);
await page.click('button[type="submit"]');
await page.waitForURL((u) => u.pathname.startsWith("/cuenta"), { timeout: 20000 });

// Sin cursos: no hay nada que buscar.
await page.goto(`${BASE}/cuenta/buscar?q=commit`);
check(await page.isVisible("text=Aún no tienes cursos"), "sin cursos explica que la búsqueda recorre sus cursos");

// Se inscribe al curso gratuito desde la página del curso.
await page.goto(`${BASE}/cursos/git-github-esencial`);
await page.click("text=Inscribirme gratis");
await page.waitForURL(/\/aprender\/git-github-esencial\/[0-9a-f-]{36}/, { timeout: 20000 });

// Buscador dentro del aula (limitado al curso).
const box = page.locator('aside form[role="search"] input[name="q"]');
check(await box.isVisible(), "el aula muestra un buscador del curso");
await box.fill("rama");
await box.press("Enter");
await page.waitForURL((u) => u.pathname === "/cuenta/buscar" && u.searchParams.get("curso") === "git-github-esencial", { timeout: 20000 });
const results = page.locator('[data-testid="search-result"]');
check((await results.count()) >= 1, "encuentra lecciones del curso por una palabra del contenido");
check(await page.locator('[data-testid="search-result"]', { hasText: "Ramas y pull requests" }).count() === 1, "«rama» encuentra «Ramas y pull requests» (raíz en español)");
check((await page.locator("mark").count()) >= 1, "las coincidencias aparecen resaltadas");
const selectValue = await page.locator('select[name="curso"]').count() ? await page.locator('select[name="curso"]').inputValue() : "git-github-esencial";
check(selectValue === "git-github-esencial", "el filtro por curso queda seleccionado");

// Al abrir un resultado lleva a la lección.
await page.locator('[data-testid="search-result"]', { hasText: "Ramas y pull requests" }).click();
await page.waitForURL(/\/aprender\/git-github-esencial\/[0-9a-f-]{36}/, { timeout: 20000 });
check(await page.isVisible("h1:has-text('Ramas y pull requests')") || (await page.content()).includes("Ramas y pull requests"), "el resultado abre la lección correcta");

// Sin acentos y por prefijo.
await page.goto(`${BASE}/cuenta/buscar?q=${encodeURIComponent("historíal")}`);
check((await results.count()) >= 1, "ignora acentos de más («historíal» → «historial»)");
await page.goto(`${BASE}/cuenta/buscar?q=comm`);
check((await results.count()) >= 1, "busca por inicio de palabra («comm» → «commit»)");

// Contenido de un curso no comprado: nunca aparece (ni por título).
await page.goto(`${BASE}/cuenta/buscar?q=addEventListener`);
check(await page.isVisible("text=Sin resultados"), "no encuentra contenido de un curso de pago no comprado");
await page.goto(`${BASE}/cuenta/buscar?q=${encodeURIComponent("DOM eventos")}`);
check(await page.isVisible("text=Sin resultados"), "tampoco por el título de una lección de pago");

// Tras la compra (confirmada por el backend como lo haría un webhook verificado) sí aparece.
const { data: me } = await admin.from("profiles").select("id").eq("email", email).single();
const { data: js } = await admin.from("courses").select("id, price_cents").eq("slug", "javascript-moderno").single();
const { data: order } = await admin.from("orders").insert({ user_id: me.id, provider: "stripe", currency: "MXN", subtotal_cents: js.price_cents, discount_cents: 0, total_cents: js.price_cents, customer_email: email }).select("id").single();
await admin.from("order_items").insert({ order_id: order.id, item_type: "course", course_id: js.id, title: "JavaScript", unit_price_cents: js.price_cents, total_cents: js.price_cents });
const { error: fErr } = await admin.rpc("fulfill_order", { p_order_id: order.id, p_provider_payment_id: `pi_e2e_search_${Date.now()}`, p_amount_cents: js.price_cents, p_currency: "MXN" });
check(!fErr, "pago confirmado por el backend");
await page.goto(`${BASE}/cuenta/buscar?q=addEventListener`);
check(await page.locator('[data-testid="search-result"]', { hasText: "El DOM y los eventos" }).count() === 1, "tras comprar encuentra identificadores de código («addEventListener»)");
check(await page.locator("mark", { hasText: "addEventListener" }).count() >= 1, "resalta el identificador dentro del fragmento");
await page.goto(`${BASE}/cuenta/buscar?q=${encodeURIComponent("api")}`);
check(await page.locator('[data-testid="search-result"]', { hasText: "Promesas" }).count() >= 1, "encuentra partes de rutas («/api/cursos» → «api»)");

// Al abrir un resultado, la lección resalta lo buscado (mismas raíces que el índice).
await page.goto(`${BASE}/cuenta/buscar?q=eventos`);
await page.locator('[data-testid="search-result"]', { hasText: "El DOM y los eventos" }).click();
await page.waitForURL((u) => u.pathname.startsWith("/aprender/javascript-moderno/") && u.searchParams.get("resaltar") === "eventos", { timeout: 20000 });
await page.waitForSelector("[data-search-banner]:has-text('coincidencia')", { timeout: 15000 });
const highlighted = await page.evaluate(() => [...(CSS.highlights.get("nexus-search") ?? [])].map((r) => r.toString()));
check(highlighted.length >= 2, `la lección resalta las coincidencias (${highlighted.length})`);
check(highlighted.every((t) => /^event/i.test(t)), `solo resalta palabras de la búsqueda (${[...new Set(highlighted)].join(", ")})`);
check(await page.isVisible(`[data-search-banner]:has-text("${highlighted.length} coincidencias")`), "el aviso indica cuántas coincidencias hay");
const styled = await page.evaluate(() => [...document.styleSheets].some((sh) => { try { return [...sh.cssRules].some((r) => r.cssText.includes("highlight(nexus-search)")); } catch { return false; } }));
check(styled, "la regla de color del resaltado está cargada en la página");
const lessonUrl = new URL(page.url());
lessonUrl.searchParams.set("resaltar", "suscribir");
await page.goto(lessonUrl.toString());
await page.waitForSelector("[data-search-banner]:has-text('coincidencia')", { timeout: 15000 });
const variants = await page.evaluate(() => [...(CSS.highlights.get("nexus-search") ?? [])].map((r) => r.toString()));
check(variants.includes("suscribir") && variants.includes("suscribirte"), `resalta variantes de la palabra (${[...new Set(variants)].join(", ")})`);
await page.screenshot({ path: process.env.E2E_SHOT_LESSON ?? "/tmp/lesson-highlight.png" });
lessonUrl.searchParams.set("resaltar", "eventos");
await page.goto(lessonUrl.toString());
await page.waitForSelector("[data-search-banner]:has-text('coincidencia')", { timeout: 15000 });
await page.click("[data-search-banner] >> text=Quitar");
await page.waitForURL((u) => !u.searchParams.has("resaltar"), { timeout: 15000 });
await page.waitForTimeout(300);
check(!(await page.isVisible("[data-search-banner]")) && (await page.evaluate(() => CSS.highlights.has("nexus-search"))) === false, "«Quitar» elimina el resaltado");
await page.goBack();
await page.waitForSelector("[data-search-banner]", { timeout: 15000 });
await page.click("[data-search-banner] >> text=Volver a los resultados");
await page.waitForURL((u) => u.pathname === "/cuenta/buscar" && u.searchParams.get("q") === "eventos", { timeout: 15000 });
check(true, "«Volver a los resultados» regresa a la búsqueda");

// Entradas raras no rompen nada.
await page.goto(`${BASE}/cuenta/buscar?q=${encodeURIComponent("!!! & | :* ()")}`);
check(await page.isVisible("text=Sin resultados"), "operadores y símbolos sueltos no generan errores");
await page.goto(`${BASE}/cuenta/buscar?q=${encodeURIComponent("<script>alert(1)</script>")}`);
check(!(await page.content()).includes("<script>alert(1)</script>"), "la consulta se muestra escapada");

// Accesos desde «Mis cursos» y el menú de la cuenta.
await page.goto(`${BASE}/cuenta/cursos`);
check(await page.isVisible('form[role="search"]'), "«Mis cursos» incluye el buscador");
check(await page.isVisible('nav[aria-label="Mi cuenta"] >> text=Buscar en mis cursos'), "el menú de la cuenta enlaza la búsqueda");

// Móvil: el buscador también está en el panel de contenido.
const mobile = await (await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await page.context().storageState() })).newPage();
await mobile.goto(`${BASE}/cuenta/buscar?q=commit`);
const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
check(!overflow, "la página de resultados no se desborda en móvil");
await mobile.screenshot({ path: process.env.E2E_SHOT ?? "/tmp/lesson-search-mobile.png", fullPage: true });

check(errors.length === 0, `sin errores de JavaScript en la página${errors.length ? `: ${errors.join(" | ")}` : ""}`);
await browser.close();
console.log(failures ? `\n${failures} fallo(s)` : "\nTodo OK");
process.exit(failures ? 1 : 0);
