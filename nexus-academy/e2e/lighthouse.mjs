// Lighthouse (móvil, con limitación simulada) sobre la versión de PRODUCCIÓN.
// 1) npm run build && npx next start -p 3100
// 2) LH_BASE=http://localhost:3100 node e2e/lighthouse.mjs
// Usa el Chromium de Playwright (el mismo de las demás pruebas) por el puerto de depuración.
import { writeFileSync, mkdirSync } from "node:fs";
import lighthouse from "lighthouse";
import pw from "playwright";

const BASE = process.env.LH_BASE ?? "http://localhost:3100";
const OUT = process.env.LH_OUT ?? "/tmp/lighthouse";
const PORT = 9333;
const paths = (process.env.LH_PATHS ?? "/,/cursos,/cursos/javascript-moderno,/paquetes,/login").split(",");
const MIN = { performance: 0.9, accessibility: 0.95, "best-practices": 0.95, seo: 0.95 };
// Páginas que a propósito no se indexan (robots noindex).
const NOINDEX = new Set(["/login", "/registro", "/recuperar"]);
// Next.js envía los metadatos de páginas dinámicas «en streaming» a los navegadores
// (Lighthouse 13 ya no se identifica como bot) y en el <head> a los bots reales.
// Por eso la meta descripción se verifica aparte con el user agent de un bot.
async function metaInHeadForBots(url) {
  const out = {};
  for (const [name, ua] of [["LinkedInBot", "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)"], ["Bingbot", "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)"]]) {
    const html = await (await fetch(url, { headers: { "user-agent": ua } })).text();
    const head = html.slice(0, html.indexOf("</head>"));
    out[name] = /<meta name="description" content="[^"]+"/.test(head);
  }
  return out;
}
mkdirSync(OUT, { recursive: true });

// Verificación previa: el servidor sirve la compilación actual (si quedó uno viejo
// corriendo, el HTML apunta a CSS que ya no existe y las cifras no valen).
{
  const html = await (await fetch(`${BASE}/`)).text();
  const css = [...html.matchAll(/href="(\/_next\/static\/[^"]+\.css)"/g)].map((m) => m[1]);
  const types = await Promise.all(css.map(async (href) => (await fetch(`${BASE}${href}`)).headers.get("content-type") ?? ""));
  if (!css.length || types.some((t) => !t.startsWith("text/css"))) {
    console.error(`✘ El servidor en ${BASE} no sirve su CSS (${types.join(", ") || "sin hojas de estilo"}). ¿Quedó corriendo una compilación vieja?`);
    process.exit(2);
  }
}

const browser = await pw.chromium.launch({ args: [`--remote-debugging-port=${PORT}`] });
let failures = 0;
const rows = [];
try {
  for (const path of paths) {
    const result = await lighthouse(`${BASE}${path}`, { port: PORT, output: "json", logLevel: "error", onlyCategories: Object.keys(MIN) });
    const lhr = result.lhr;
    writeFileSync(`${OUT}/${path.replace(/\W+/g, "_") || "_"}.json`, result.report);
    const scores = Object.fromEntries(Object.entries(lhr.categories).map(([k, c]) => [k, c.score]));
    const metrics = {
      LCP: lhr.audits["largest-contentful-paint"].displayValue,
      CLS: lhr.audits["cumulative-layout-shift"].displayValue,
      TBT: lhr.audits["total-blocking-time"].displayValue,
    };
    // Auditorías de SEO que fallan por diseño o por el streaming de metadatos (ver arriba).
    const seoFails = lhr.categories.seo.auditRefs.map((r) => lhr.audits[r.id]).filter((a) => a.score === 0).map((a) => a.id);
    const bots = await metaInHeadForBots(`${BASE}${path}`);
    const explained = seoFails.every((id) => (id === "is-crawlable" && NOINDEX.has(path)) || (id === "meta-description" && Object.values(bots).every(Boolean)));
    if (seoFails.length && explained) scores.seo = 1;
    if (!Object.values(bots).every(Boolean) && !NOINDEX.has(path)) console.log(`    · meta descripción ausente en el <head> para bots: ${JSON.stringify(bots)}`);
    const low = Object.entries(MIN).filter(([k, min]) => (scores[k] ?? 0) < min);
    if (low.length) failures++;
    rows.push({ path, scores, metrics });
    console.log(`${low.length ? "✘" : "✔"} ${path} — ${Object.entries(scores).map(([k, v]) => `${k} ${Math.round(v * 100)}`).join(" · ")} — LCP ${metrics.LCP} · CLS ${metrics.CLS} · TBT ${metrics.TBT}${seoFails.length && explained ? ` (SEO: ${seoFails.join(", ")} verificado aparte)` : ""}`);
    if (low.length || process.env.LH_VERBOSE) {
      const failing = Object.values(lhr.audits)
        .filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== "informative" && a.scoreDisplayMode !== "notApplicable")
        .sort((a, b) => a.score - b.score)
        .slice(0, 8);
      for (const a of failing) console.log(`    · ${a.id} (${Math.round(a.score * 100)}): ${a.title}${a.displayValue ? ` — ${a.displayValue}` : ""}`);
    }
  }
} finally {
  await browser.close();
}
writeFileSync(`${OUT}/summary.json`, JSON.stringify(rows, null, 2));
console.log(failures ? `\n${failures} página(s) por debajo del mínimo` : "\nTodo OK");
process.exit(failures ? 1 : 0);
