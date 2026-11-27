import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { loadEnvFiles } from "./_db.ts";

/**
 * Crea un usuario del panel. La contraseña se pide por consola (sin eco) o se
 * lee de VMF_ADMIN_PASSWORD; nunca como argumento (quedaría en el historial).
 * Uso: npm run admin:create -- --email tu@correo.com --name "Tu nombre" [--role owner]
 */
loadEnvFiles();
const { values } = parseArgs({ options: { email: { type: "string" }, name: { type: "string" }, role: { type: "string", default: "owner" } } });
if (!values.email || !values.name) {
  console.error('Uso: npm run admin:create -- --email tu@correo.com --name "Tu nombre" [--role owner|admin|operator|viewer]');
  process.exit(1);
}

async function askHidden(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
  let muted = false;
  out._writeToOutput = (s: string) => (muted ? undefined : out.output.write(s));
  const answer = rl.question(question);
  muted = true;
  const value = await answer;
  rl.close();
  process.stdout.write("\n");
  return value;
}

let password = process.env.VMF_ADMIN_PASSWORD ?? "";
if (!password) {
  password = await askHidden("Contraseña (mín. 12 caracteres): ");
  if (password !== (await askHidden("Repite la contraseña: "))) {
    console.error("Las contraseñas no coinciden.");
    process.exit(1);
  }
}

const { getDb } = await import("@/server/db");
const { withServiceContext } = await import("@/server/db/context");
const { AuthError, createUser } = await import("@/server/auth/service");
try {
  const user = await withServiceContext("cli", (db) =>
    createUser(db, { email: values.email!, displayName: values.name!, role: values.role as "owner", password }),
  );
  console.log(`Usuario creado (${values.role}): ${user.id}`);
} catch (error) {
  if (error instanceof AuthError) {
    console.error(error.message);
    process.exitCode = 1;
  } else throw error;
} finally {
  await (await getDb()).close();
}
