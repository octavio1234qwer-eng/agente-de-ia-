/** Genera infrastructure/database/migrations/bundle.generated.ts a partir de los .sql (para empaquetar sin acceso a disco). */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
const dir = path.resolve(import.meta.dirname, "../infrastructure/database/migrations");
export async function buildBundle() {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const entries = await Promise.all(files.map(async (f) => [f, await readFile(path.join(dir, f), "utf8")] as const));
  return `// ARCHIVO GENERADO por scripts/bundle-migrations.ts — no editar. Fuente: *.sql en esta carpeta.\nexport const MIGRATIONS: ReadonlyArray<readonly [string, string]> = ${JSON.stringify(entries, null, 2)};\n`;
}
if (process.argv[1]?.endsWith("bundle-migrations.ts")) {
  await writeFile(path.join(dir, "bundle.generated.ts"), await buildBundle());
  console.log("bundle.generated.ts actualizado");
}
