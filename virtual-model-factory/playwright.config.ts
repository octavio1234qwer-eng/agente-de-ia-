import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

/**
 * Pruebas end-to-end sobre la build de producción con una base PGlite desechable.
 * Requiere `npm run build` previo. Uso: npm run test:e2e
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "off" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "iphone", use: { ...devices["iPhone 15"], defaultBrowserType: "chromium" }, dependencies: ["desktop"] },
  ],
  webServer: {
    command: `rm -rf .data/e2e && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ALLOW_EMBEDDED_DB_IN_PRODUCTION: "true",
      PGLITE_DATA_DIR: ".data/e2e",
      SETUP_TOKEN: "e2e-setup-token-solo-para-pruebas-locales",
      SECURE_COOKIES: "false",
      DATABASE_URL: "",
    },
  },
});
