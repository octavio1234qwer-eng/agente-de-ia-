import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@empire": path.resolve(import.meta.dirname) } },
  test: { include: ["tests/**/*.test.ts"], testTimeout: 30000, pool: "forks" },
});
