// E2E: compartir certificados en LinkedIn y tarjeta de vista previa (Open Graph).
// Ejecutar con el entorno arriba: node e2e/certificate-linkedin.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import pw from "playwright";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const SITE = (env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let failures = 0;
const check = (c, l) => { console.log(c ? "✔" : "✘", l); if (!c) failures++; };

// Alumna con un certificado emitido por el backend (como al aprobar el curso).
const email = `linkedin.${Date.now()}@test.dev`;
const password = "Linked12345";
const { data: created } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Lía Compartida Núñez" } });
const userId = created.user.id;
const { data: course } = await admin.from("courses").select("id, title").eq("slug", "git-github-esencial").single();
const { error: certErr } = await admin.rpc("issue_certificate", { p_user_id: userId, p_course_id: course.id, p_completed_at: new Date().toISOString() });
if (certErr) throw certErr;
const { data: cert } = await admin.from("certificates").select("code, issued_at").eq("user_id", userId).single();
const certUrl = `${SITE}/certificados/${cert.code}`;

const browser = await pw.chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(`${BASE}/login`);
await page.fill("#email", email);
await page.fill("#password", password);
await page.click('button[type="submit"]');
await page.waitForURL((u) => u.pathname.startsWith("/cuenta"), { timeout: 20000 });

// «Mis certificados»
await page.goto(`${BASE}/cuenta/certificados`);
const add = page.locator("a", { hasText: "Agregar a LinkedIn" });
check((await add.count()) === 1, "«Mis certificados» ofrece «Agregar a LinkedIn»");
const addUrl = new URL(await add.getAttribute("href"));
const now = new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", year: "numeric", month: "numeric" }).formatToParts(new Date(cert.issued_at));
check(addUrl.origin + addUrl.pathname === "https://www.linkedin.com/profile/add" && addUrl.searchParams.get("startTask") === "CERTIFICATION_NAME", "apunta al formulario oficial de LinkedIn");
check(addUrl.searchParams.get("name") === course.title, `prellena el nombre del curso («${addUrl.searchParams.get("name")}»)`);
check(addUrl.searchParams.get("organizationName") === "NEXUS ACADEMY", "prellena la academia como emisora");
check(addUrl.searchParams.get("issueYear") === now.find((p) => p.type === "year").value && addUrl.searchParams.get("issueMonth") === now.find((p) => p.type === "month").value, "prellena año y mes de emisión");
check(addUrl.searchParams.get("certUrl") === certUrl, "incluye la URL de verificación con el ID");
check((await add.getAttribute("target")) === "_blank" && (await add.getAttribute("rel")).includes("noopener"), "se abre en otra pestaña de forma segura");
const share = page.locator("a", { hasText: "Compartir" });
const shareUrl = new URL(await share.first().getAttribute("href"));
check(shareUrl.origin + shareUrl.pathname === "https://www.linkedin.com/sharing/share-offsite/" && shareUrl.searchParams.get("url") === certUrl, "«Compartir» usa el diálogo oficial con la URL del certificado");
await page.screenshot({ path: process.env.E2E_SHOT ?? "/tmp/certificate-linkedin.png" });

// Página pública: metadatos para la vista previa al compartir.
const pub = await (await browser.newContext()).newPage();
await pub.goto(`${BASE}/certificados/${cert.code}`);
const og = await pub.evaluate(() => Object.fromEntries([...document.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]')].map((m) => [m.getAttribute("property") ?? m.getAttribute("name"), m.getAttribute("content")])));
check(og["og:title"]?.includes("Lía Compartida Núñez") && og["og:title"]?.includes(course.title), "og:title con alumna y curso");
check(og["og:description"]?.includes(cert.code), "og:description incluye el ID verificable");
check(og["og:url"] === certUrl, "og:url es la URL de verificación");
check(og["twitter:card"] === "summary_large_image" && Boolean(og["og:image"]), "declara imagen grande para redes");
check(await pub.isVisible("a:has-text('Compartir en LinkedIn')"), "la página pública permite compartir");

// La imagen existe y es un PNG 1200×630.
const imgPath = new URL(og["og:image"]).pathname + new URL(og["og:image"]).search;
const img = await pub.request.get(`${BASE}${imgPath}`);
const buf = await img.body();
const isPng = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
check(img.ok() && img.headers()["content-type"] === "image/png" && isPng && buf.readUInt32BE(16) === 1200 && buf.readUInt32BE(20) === 630, `la imagen de vista previa es un PNG 1200×630 (${img.status()})`);
if (process.env.E2E_OG_SHOT) (await import("node:fs")).writeFileSync(process.env.E2E_OG_SHOT, buf);

// Certificado revocado: sin botón de compartir.
await admin.from("certificates").update({ revoked_at: new Date().toISOString() }).eq("code", cert.code);
await pub.goto(`${BASE}/certificados/${cert.code}`);
check(await pub.isVisible("text=fue revocado") && !(await pub.isVisible("a:has-text('Compartir en LinkedIn')")), "un certificado revocado no se ofrece para compartir");
await page.goto(`${BASE}/cuenta/certificados`);
check((await page.locator("a", { hasText: "Agregar a LinkedIn" }).count()) === 0, "ni aparece en «Mis certificados»");

check(errors.length === 0, `sin errores de JavaScript${errors.length ? `: ${errors.join(" | ")}` : ""}`);
await browser.close();
console.log(failures ? `\n${failures} fallo(s)` : "\nTodo OK");
process.exit(failures ? 1 : 0);
