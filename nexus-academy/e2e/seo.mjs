// E2E de SEO: robots.txt, sitemap.xml y datos estructurados (JSON-LD).
// Ejecutar con el entorno arriba: node e2e/seo.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const SITE = (env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let failures = 0;
const check = (c, l) => { console.log(c ? "✔" : "✘", l); if (!c) failures++; };

// robots.txt
const robotsRes = await fetch(`${BASE}/robots.txt`);
const robots = await robotsRes.text();
check(robotsRes.ok && robotsRes.headers.get("content-type")?.startsWith("text/plain"), "robots.txt responde texto plano");
const disallowed = [...robots.matchAll(/^Disallow: (.+)$/gm)].map((m) => m[1].trim());
for (const p of ["/admin", "/cuenta", "/aprender", "/nexus-ai", "/api/", "/checkout"]) check(disallowed.includes(p), `robots.txt bloquea ${p}`);
check(!disallowed.some((p) => "/certificados/NX-AAAAA-BBBBB".startsWith(p)), "los certificados no se bloquean (LinkedIn debe poder leerlos para la vista previa)");
check(!disallowed.some((p) => "/cursos/javascript-moderno".startsWith(p)), "los cursos no se bloquean");
check(robots.includes(`Sitemap: ${SITE}/sitemap.xml`), "robots.txt anuncia el sitemap");

// sitemap.xml
const smRes = await fetch(`${BASE}/sitemap.xml`);
const sm = await smRes.text();
check(smRes.ok && smRes.headers.get("content-type")?.includes("xml") && sm.startsWith("<?xml") && sm.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'), "sitemap.xml es XML válido de sitemaps.org");
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const { data: published } = await admin.from("courses").select("slug").eq("status", "published");
const { data: notPublished } = await admin.from("courses").select("slug").neq("status", "published");
const { data: bundles } = await admin.from("bundles").select("slug").eq("status", "published");
check(published.every((c) => locs.includes(`${SITE}/cursos/${c.slug}`)), `incluye los ${published.length} cursos publicados`);
check((notPublished ?? []).every((c) => !locs.includes(`${SITE}/cursos/${c.slug}`)), `excluye ${notPublished?.length ?? 0} curso(s) en borrador o archivados`);
check(bundles.every((b) => locs.includes(`${SITE}/paquetes/${b.slug}`)), `incluye los ${bundles.length} paquetes publicados`);
check(!locs.some((l) => /\/(cuenta|admin|aprender|checkout|api)\b/.test(l)), "no incluye áreas privadas");
check(locs.every((l) => l.startsWith(`${SITE}/`)), "todas las URLs son absolutas del sitio");
check(new Set(locs).size === locs.length, "sin URLs duplicadas");
const statuses = await Promise.all(locs.map(async (l) => [l, (await fetch(l.replace(SITE, BASE), { redirect: "manual" })).status]));
const broken = statuses.filter(([, s]) => s !== 200);
check(broken.length === 0, `las ${locs.length} URLs del sitemap responden 200${broken.length ? `: ${JSON.stringify(broken)}` : ""}`);

// JSON-LD
const home = await (await fetch(`${BASE}/`)).text();
const blocks = [...home.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const graph = blocks.flatMap((b) => b["@graph"] ?? [b]);
const org = graph.find((n) => n["@type"] === "EducationalOrganization");
const site = graph.find((n) => n["@type"] === "WebSite");
check(org?.name === "NEXUS ACADEMY" && org?.url === SITE, "la portada declara la organización (schema.org)");
check(site?.potentialAction?.target?.urlTemplate === `${SITE}/cursos?q={search_term_string}`, "declara el buscador del catálogo");
const searchUrl = site.potentialAction.target.urlTemplate.replace("{search_term_string}", "javascript").replace(SITE, BASE);
check((await (await fetch(searchUrl)).text()).includes("JavaScript"), "la URL de búsqueda declarada funciona");
const course = await (await fetch(`${BASE}/cursos/javascript-moderno`)).text();
const courseLd = [...course.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
check(courseLd.some((b) => b["@type"] === "Course"), "la página de curso declara un Course (schema.org)");

console.log(failures ? `\n${failures} fallo(s)` : "\nTodo OK");
process.exit(failures ? 1 : 0);
