// Prueba E2E: registro, inscripción gratuita, favoritos, perfil, sesión y recuperación de contraseña.
// Requiere: bash scripts/dev-up.sh  ·  Ejecutar: node e2e/auth-account.mjs
import pw from "playwright";
const { chromium } = pw;
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const email = `alumno.${Date.now()}@test.dev`;
const log = (...a) => console.log("•", ...a);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
try {
  // Ruta protegida sin sesión -> login con next
  await page.goto(`${BASE}/cuenta/cursos`);
  log("sin sesión /cuenta/cursos ->", new URL(page.url()).pathname + new URL(page.url()).search);

  // Registro
  await page.goto(`${BASE}/registro`);
  await page.fill("#fullName", "Ana Prueba López");
  await page.fill("#email", email);
  await page.fill("#password", "corta");
  await page.check('input[name="terms"]');
  await page.click('button[type="submit"]');
  await page.waitForSelector("text=al menos 8 caracteres", { timeout: 15000 });
  log("validación de contraseña débil: OK");
  await page.fill("#password", "Segura123");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/cuenta\/cursos/, { timeout: 20000 });
  log("registro -> ", new URL(page.url()).pathname, "|", await page.locator("h3").first().textContent());

  // Inscripción gratuita
  await page.goto(`${BASE}/cursos/git-github-esencial`);
  await page.click("text=Inscribirme gratis");
  await page.waitForURL(/\/aprender\/git-github-esencial/, { timeout: 20000 });
  log("inscripción gratis -> ", new URL(page.url()).pathname);
  await page.goto(`${BASE}/cuenta/cursos`);
  log("mis cursos muestra:", (await page.locator("article h2").allTextContents()).join(", "));

  // Favorito en un curso de pago
  await page.goto(`${BASE}/cursos/javascript-moderno`);
  await page.click("text=Guardar en favoritos");
  await page.waitForSelector("text=En tus favoritos", { timeout: 10000 });
  await page.goto(`${BASE}/cuenta/favoritos`);
  log("favoritos:", (await page.locator("main h3").allTextContents()).join(", "));

  // Perfil
  await page.goto(`${BASE}/cuenta`);
  await page.fill("#headline", "Aprendiz de desarrollo web");
  await page.click("text=Guardar cambios");
  await page.waitForSelector("text=Perfil actualizado", { timeout: 10000 });
  log("perfil actualizado: OK");

  // Cerrar sesión e iniciar sesión
  await page.goto(`${BASE}/`);
  await page.click(`button:has-text("Ana Prueba López")`);
  await page.click("text=Cerrar sesión");
  await page.waitForSelector('header >> text=Iniciar sesión', { timeout: 15000 });
  log("cerrar sesión: OK");
  await page.goto(`${BASE}/login?next=/cuenta/favoritos`);
  await page.fill("#email", email);
  await page.fill("#password", "incorrecta1");
  await page.click('button[type="submit"]');
  await page.waitForSelector("text=Correo o contraseña incorrectos", { timeout: 10000 });
  log("login con contraseña incorrecta rechazado: OK");
  await page.fill("#password", "Segura123");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => u.pathname === "/cuenta/favoritos", { timeout: 15000 });
  log("login con next -> ", new URL(page.url()).pathname);

  // Recuperación de contraseña (correo real vía Mailpit)
  await ctx.clearCookies();
  await page.goto(`${BASE}/recuperar`);
  await page.fill("#email", email);
  await page.click('button[type="submit"]');
  await page.waitForSelector("text=Si existe una cuenta", { timeout: 15000 });
  let link = null;
  for (let i = 0; i < 20 && !link; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent("to:" + email)}`)).json();
    const msg = list.messages?.find((m) => /contraseña/i.test(m.Subject));
    if (msg) {
      const full = await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json();
      link = (full.HTML.match(/href="([^"]*auth\/confirm[^"]*)"/) || [])[1]?.replace(/&amp;/g, "&");
      log("correo recibido:", msg.Subject);
    }
  }
  if (!link) throw new Error("No llegó el correo de recuperación");
  await page.goto(link);
  await page.waitForURL(/\/restablecer/, { timeout: 15000 });
  await page.fill("#password", "NuevaClave456");
  await page.fill("#confirm", "NuevaClave456");
  await page.click('button[type="submit"]');
  await page.waitForSelector("text=Tu contraseña se actualizó", { timeout: 15000 });
  log("contraseña restablecida desde el enlace del correo: OK");
  await ctx.clearCookies();
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", "NuevaClave456");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/cuenta\/cursos/, { timeout: 15000 });
  log("login con la nueva contraseña: OK");

  // Un alumno no puede entrar al panel de administración
  await page.goto(`${BASE}/admin`);
  log("alumno en /admin ->", new URL(page.url()).pathname + new URL(page.url()).search);
  await page.screenshot({ path: "test-results/account-courses.png" });
} catch (e) {
  console.log("FALLÓ:", e.message, "en", page.url());
  await page.screenshot({ path: "test-results/e2e-fail.png" });
  process.exitCode = 1;
} finally {
  console.log("errores de página:", errors.length ? errors : "ninguno");
  await browser.close();
}
