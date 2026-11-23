// Rastrea los enlaces internos del sitio y falla si alguno devuelve error.
// Ejecutar: node e2e/links.mjs
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const seen = new Map();
const queue = ["/"];
const skip = (p) => p.startsWith("/api/") || p.startsWith("/_next") || p.startsWith("/aprender") || p.startsWith("/checkout") || p.startsWith("/cuenta") || p.startsWith("/carrito") || p.startsWith("/nexus-ai");
while (queue.length && seen.size < 400) {
  const path = queue.shift();
  if (seen.has(path)) continue;
  const res = await fetch(BASE + path, { redirect: "manual" });
  seen.set(path, res.status);
  if (res.status !== 200 || !(res.headers.get("content-type") ?? "").includes("text/html")) continue;
  const html = await res.text();
  for (const m of html.matchAll(/href="(\/[^"#]*)/g)) {
    const href = m[1].replace(/&amp;/g, "&");
    const key = href.split("?")[0] === "/cursos" ? href : href.split("?")[0];
    if (!seen.has(key) && !queue.includes(key) && !skip(key)) queue.push(key);
  }
}
const broken = [...seen].filter(([, s]) => s >= 400);
console.log(`${seen.size} rutas revisadas`);
for (const [p, s] of [...seen].sort()) if (s !== 200) console.log(`  ${s}  ${p}`);
console.log(broken.length ? `✘ ${broken.length} enlaces rotos` : "✔ sin enlaces rotos");
process.exit(broken.length ? 1 : 0);
