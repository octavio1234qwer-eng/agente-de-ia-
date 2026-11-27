import { expect, test, type Page } from "@playwright/test";

const OWNER = { email: "owner@e2e.test", password: "Fabrica-E2E-Segura-2026", name: "Dueña E2E" };
const SETUP_TOKEN = "e2e-setup-token-solo-para-pruebas-locales";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(OWNER.email);
  await page.getByLabel("Contraseña").fill(OWNER.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Estado de la fábrica" })).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe.configure({ mode: "serial" });

test.describe("escritorio", () => {
  test.skip(({ isMobile }) => isMobile, "solo escritorio");

  test("sin sesión redirige a configuración inicial y la API exige autenticación", async ({ page, request }) => {
    await page.goto("/models");
    await expect(page).toHaveURL(/\/setup$/);
    const res = await request.get("/api/anything");
    expect(res.status()).toBe(401);
    const health = await request.get("/api/health");
    expect(await health.json()).toEqual({ status: "ok", database: "pglite" });
    expect(health.headers()["x-frame-options"]).toBe("DENY");
    expect(health.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  });

  test("configuración inicial rechaza token incorrecto y crea el propietario", async ({ page }) => {
    await page.goto("/setup");
    const fill = async (token: string) => {
      await page.getByLabel("Token de configuración").fill(token);
      await page.getByLabel("Nombre").fill(OWNER.name);
      await page.getByLabel("Correo electrónico").fill(OWNER.email);
      await page.getByLabel("Contraseña", { exact: true }).fill(OWNER.password);
      await page.getByLabel("Repite la contraseña").fill(OWNER.password);
      await page.getByRole("button", { name: "Crear propietario" }).click();
    };
    await fill("token-incorrecto-de-prueba-123");
    await expect(page.getByRole("alert").filter({ hasText: /./ })).toContainText("Token de configuración incorrecto");
    await fill(SETUP_TOKEN);
    await expect(page.getByRole("heading", { name: "Estado de la fábrica" })).toBeVisible();
    await page.goto("/setup");
    await expect(page).toHaveURL(/\/$/);
  });

  test("login, error uniforme y logout", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(OWNER.email);
    await page.getByLabel("Contraseña").fill("contraseña-incorrecta");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /./ })).toContainText("Correo o contraseña incorrectos");
    await login(page);
    const cookies = await page.context().cookies();
    const session = cookies.find((c) => c.name === "vmf_session");
    expect(session?.httpOnly).toBe(true);
    expect(session?.sameSite).toBe("Lax");
    await page.getByRole("button", { name: "Salir" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("dashboard sin datos inventados y carga de demo", async ({ page }) => {
    await login(page);
    await expect(page.getByText("Aún no hay modelos")).toBeVisible();
    await page.getByRole("link", { name: /Configuración/ }).click();
    await page.getByRole("button", { name: "Cargar modelos de demostración" }).click();
    await expect(page.getByText(/Creados: demo-luna-vex/)).toBeVisible();
    await page.getByRole("link", { name: /Modelos virtuales/ }).click();
    await expect(page.getByText("Luna Vex")).toBeVisible();
    await expect(page.getByText("Aria Solenne")).toBeVisible();
    await expect(page.getByText("Dante Ríos")).toBeVisible();
    await expect(page.getByText("DEMO").first()).toBeVisible();
    await page.goto("/");
    await expect(page.getByText(/^(US\$|USD)\s?0\.00$/).first()).toBeVisible();
    await page.screenshot({ path: "test-results/dashboard-desktop.png", fullPage: true });
  });

  test("crear modelo: validación de edad y alta correcta", async ({ page }) => {
    await login(page);
    await page.goto("/models/new");
    await page.getByLabel("Nombre artístico").fill("Nova Reyes");
    await page.getByLabel("Identificador (slug)").fill("nova-reyes");
    const age = page.getByLabel("Edad ficticia");
    await age.evaluate((el: HTMLInputElement) => el.removeAttribute("min"));
    await age.fill("22");
    await page.getByRole("button", { name: "Crear modelo" }).click();
    await expect(page.getByText("La edad ficticia mínima es 25 años.")).toBeVisible();
    await age.fill("29");
    await page.getByLabel("Biografía").fill("Personaje virtual de arte digital y música electrónica, creado para pruebas.");
    await page.getByRole("button", { name: "Crear modelo" }).click();
    await expect(page.getByText("Modelo creado como borrador.")).toBeVisible();
    await expect(page.getByText("Falta la declaración")).toBeVisible();
    await page.getByRole("button", { name: "Activar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "No se puede activar" }).or(page.getByRole("alert").filter({ hasText: "persona real" })).first()).toBeVisible();

    await page.getByRole("link", { name: "Editar" }).click();
    await page.getByLabel(/Declaro que este personaje/).check();
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Cambios guardados.")).toBeVisible();
    await page.getByRole("button", { name: "Activar" }).click();
    await expect(page.getByText("Estado actualizado.")).toBeVisible();
    await expect(page.getByText("Activo").first()).toBeVisible();
  });

  test("parada de emergencia con motivo, banner y auditoría", async ({ page }) => {
    await login(page);
    await page.goto("/settings");
    await page.getByLabel("Motivo para Parada de emergencia").fill("Prueba E2E");
    await page.getByRole("button", { name: "Activar parada de emergencia" }).click();
    await expect(page.getByText("Parada de emergencia activa").first()).toBeVisible();
    await page.goto("/");
    await expect(page.getByText("Automatizaciones detenidas")).toBeVisible();
    await page.goto("/settings");
    await page.getByRole("button", { name: "Desactivar parada de emergencia" }).click();
    await expect(page.getByText("Desactivado.")).toBeVisible();
    await page.goto("/security");
    await expect(page.getByText("emergency_stop_on")).toBeVisible();
    await expect(page.getByText("login_succeeded").first()).toBeVisible();
    await expect(page.getByRole("cell", { name: "models" }).first()).toBeVisible();
  });
});

test.describe("iPhone", () => {
  test.skip(({ isMobile }) => !isMobile, "solo móvil");

  test("navegación móvil y diseño sin desbordes", async ({ page }) => {
    await login(page);
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: "Abrir menú" }).click();
    const menu = page.getByRole("dialog", { name: "Menú de navegación" });
    await expect(menu).toBeVisible();
    await expect(menu.getByText("Fase 3").first()).toBeVisible();
    await menu.getByRole("link", { name: /Modelos virtuales/ }).click();
    await expect(menu).toBeHidden();
    await expect(page.getByRole("heading", { name: "Modelos virtuales" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByText("Luna Vex").click();
    await expect(page.getByRole("heading", { name: "Luna Vex" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: "test-results/model-iphone.png", fullPage: true });
    await page.goto("/models/new");
    await expectNoHorizontalOverflow(page);
    const box = await page.getByRole("button", { name: "Crear modelo" }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await page.goto("/");
    await page.screenshot({ path: "test-results/dashboard-iphone.png", fullPage: true });
  });
});
