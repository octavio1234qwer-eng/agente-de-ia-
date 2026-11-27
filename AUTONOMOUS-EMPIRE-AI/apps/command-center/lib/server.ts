import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, type Db } from "@empire/core/db";
import { seed } from "@empire/infrastructure/database/seed";
import { getSessionUser, anonHash, type SessionUser } from "@empire/core/auth";

// En desarrollo sin DATABASE_URL, compartir la misma base PGlite que la CLI (raíz del monorepo).
if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL && !process.env.PGLITE_DIR && process.cwd().endsWith("command-center"))
  process.env.PGLITE_DIR = `${process.cwd()}/../../.data/pglite`;

export const SESSION_COOKIE = "empire_session";
let seeded: Promise<Db> | null = null;

export function db(): Promise<Db> {
  if (!seeded) {
    seeded = getDb().then(async (d) => { await seed(d); return d; });
    seeded.catch(() => (seeded = null));
  }
  return seeded;
}

export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getSessionUser(await db(), token);
}

const RANK = { viewer: 0, operator: 1, owner: 2 } as const;
export async function requireUser(min: keyof typeof RANK = "viewer"): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) redirect("/login");
  if (RANK[u.role] < RANK[min]) throw new Error("Permisos insuficientes");
  return u;
}

export async function visitorHash(): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]!.trim() || h.get("x-real-ip") || "unknown";
  return anonHash(`${ip}|${h.get("user-agent") ?? ""}`);
}

/** Verifica que una petición mutante venga de nuestro propio origen (defensa CSRF adicional). */
export async function assertSameOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (origin && host && new URL(origin).host !== host) throw new Error("Origen no permitido");
}
