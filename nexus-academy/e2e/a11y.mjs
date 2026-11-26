// Auditoría automática de accesibilidad (axe-core, WCAG 2.1 A/AA) en las
// páginas principales: públicas, de alumno, aula y panel de administración.
// Ejecutar con el entorno arriba: node e2e/a11y.mjs   (A11Y_VERBOSE=1 para ver nodos)
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import pw from "playwright";
import { AxeBuilder } from "@axe-core/playwright";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

// Datos: alumna con curso gratuito, nota y certificado; administrador.
const ts = Date.now();
const password = "Acceso12345";
const studentEmail = `a11y.${ts}@test.dev`;
const adminEmail = `a11y.admin.${ts}@test.dev`;
const { data: s } = await admin.auth.admin.createUser({ email: studentEmail, password, email_confirm: true, user_metadata: { full_name: "Ana Accesible" } });
const { data: a } = await admin.auth.admin.createUser({ email: adminEmail, password, email_confirm: true, user_metadata: { full_name: "Admin Accesible" } });
await admin.from("profiles").update({ role: "admin" }).eq("id", a.user.id);
const { data: git } = await admin.from("courses").select("id").eq("slug", "git-github-esencial").single();
await admin.from("enrollments").insert({ user_id: s.user.id, course_id: git.id, source: "free" });
const { data: lesson } = await admin.from("lessons").select("id").eq("course_id", git.id).eq("type", "article").order("position").limit(1).single();
const { data: quiz } = await admin.from("lessons").select("id").eq("course_id", git.id).eq("type", "quiz").limit(1).single();
await admin.from("lesson_notes").insert({ user_id: s.user.id, lesson_id: lesson.id, course_id: git.id, body: "Nota de prueba" });
await admin.rpc("issue_certificate", { p_user_id: s.user.id, p_course_id: git.id, p_completed_at: new Date().toISOString() });
const { data: cert } = await admin.from("certificates").select("code").eq("user_id", s.user.id).single();
const { data: anyOrder } = await admin.from("orders").select("id").limit(1).maybeSingle();

const pages = {
  public: ["/", "/cursos", "/cursos/javascript-moderno", "/paquetes", "/instructores", "/nexus-ai", "/login", "/registro", "/recuperar", "/verificar", `/certificados/${cert.code}`, "/terminos", "/privacidad", "/reembolsos", "/carrito"],
  student: ["/cuenta", "/cuenta/cursos", "/cuenta/buscar?q=commit", "/cuenta/notas", "/cuenta/certificados", "/cuenta/compras", "/cuenta/favoritos", "/cuenta/ajustes", `/aprender/git-github-esencial/${lesson.id}`, `/aprender/git-github-esencial/${quiz.id}`],
  admin: ["/admin", "/admin/cursos", `/admin/cursos/${git.id}`, `/admin/cursos/${git.id}/embudo`, `/admin/cursos/${git.id}/lecciones/${lesson.id}`, "/admin/categorias", "/admin/instructores", "/admin/paquetes", "/admin/alumnos", "/admin/pedidos", "/admin/ingresos", ...(anyOrder ? [`/admin/pedidos/${anyOrder.id}`] : []), "/admin/cupones", "/admin/preguntas", "/admin/preguntas?filtro=all", "/admin/resenas", "/admin/correos"],
};

const browser = await pw.chromium.launch();
async function context(email) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (email) {
    const p = await ctx.newPage();
    await p.goto(`${BASE}/login`);
    await p.fill("#email", email);
    await p.fill("#password", password);
    await p.click('button[type="submit"]');
    await p.waitForURL((u) => u.pathname !== "/login", { timeout: 20000 });
    await p.close();
  }
  return ctx;
}

const summary = new Map();
let total = 0;
for (const [group, paths] of Object.entries(pages)) {
  const ctx = await context(group === "public" ? null : group === "admin" ? adminEmail : studentEmail);
  for (const path of paths) {
    const page = await ctx.newPage();
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    // Móvil y escritorio comparten marcado; se audita en escritorio.
    const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    for (const v of violations) {
      total += v.nodes.length;
      const key = `${v.id} (${v.impact})`;
      const entry = summary.get(key) ?? { help: v.help, pages: new Set(), nodes: [] };
      entry.pages.add(path);
      entry.nodes.push(...v.nodes.slice(0, 3).map((n) => `${path} → ${n.target.join(" ")}${process.env.A11Y_VERBOSE ? `\n      ${n.failureSummary?.split("\n").slice(1, 3).join(" ")}` : ""}`));
      summary.set(key, entry);
    }
    console.log(`${violations.length ? "✘" : "✔"} [${group}] ${path}${violations.length ? ` — ${violations.map((v) => v.id).join(", ")}` : ""}`);
    await page.close();
  }
  await ctx.close();
}
// Estados interactivos en móvil (menús y paneles abiertos).
async function audit(page, label) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  for (const v of violations) {
    total += v.nodes.length;
    const key = `${v.id} (${v.impact})`;
    const entry = summary.get(key) ?? { help: v.help, pages: new Set(), nodes: [] };
    entry.pages.add(label);
    entry.nodes.push(...v.nodes.slice(0, 3).map((n) => `${label} → ${n.target.join(" ")}`));
    summary.set(key, entry);
  }
  console.log(`${violations.length ? "✘" : "✔"} [móvil] ${label}${violations.length ? ` — ${violations.map((v) => v.id).join(", ")}` : ""}`);
}
const mctx = await context(studentEmail);
const mobile = await mctx.newPage();
await mobile.setViewportSize({ width: 390, height: 844 });
await mobile.goto(`${BASE}/`, { waitUntil: "networkidle" });
await mobile.click('button[aria-label="Abrir menú"]');
await mobile.waitForSelector('nav[aria-label="Menú móvil"]');
await audit(mobile, "menú principal abierto");
await mobile.goto(`${BASE}/aprender/git-github-esencial/${lesson.id}`, { waitUntil: "networkidle" });
await audit(mobile, "aula (cerrado)");
await mobile.click("button:has-text('Contenido')");
await mobile.waitForSelector('[role="dialog"][aria-label="Contenido del curso"]');
await audit(mobile, "temario del aula abierto");
await mobile.keyboard.press("Escape");
await mobile.goto(`${BASE}/aprender/git-github-esencial/${lesson.id}`, { waitUntil: "networkidle" });
await mobile.click("button:has-text('NEXUS AI')");
await mobile.waitForTimeout(400);
await audit(mobile, "chat NEXUS AI abierto");
await mctx.close();
await browser.close();

if (summary.size) {
  console.log("\nProblemas encontrados:");
  for (const [key, e] of summary) {
    console.log(`\n• ${key}: ${e.help} — ${e.pages.size} página(s)`);
    for (const n of e.nodes.slice(0, 6)) console.log(`    ${n}`);
  }
}
console.log(total ? `\n${total} nodo(s) con problemas en ${summary.size} regla(s)` : "\nTodo OK: sin infracciones WCAG 2.1 A/AA detectables automáticamente");
process.exit(total ? 1 : 0);
