import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** Carga .env.local / .env (sin dependencias) para los scripts de consola. */
export function loadEnvFiles(): void {
  for (const file of [".env.local", ".env"]) {
    const p = path.join(process.cwd(), file);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m || process.env[m[1]!] !== undefined) continue;
      process.env[m[1]!] = m[2]!.replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}
