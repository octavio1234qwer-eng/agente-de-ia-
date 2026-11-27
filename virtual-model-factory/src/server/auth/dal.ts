import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getEnv } from "../config/env";
import { withServiceContext, withUserContext } from "../db/context";
import type { Queryable } from "../db/types";
import { recordSecurityEvent } from "../security/events";
import { can, hasMinRole, type Permission, type Role } from "./permissions";
import { validateSession, type SessionUser } from "./service";
import { getRequestMeta, readSessionToken } from "./session";

/**
 * Capa de acceso a datos (DAL). Toda página, Server Action y Route Handler
 * protegidos pasan por aquí; el proxy solo hace una comprobación optimista.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = await readSessionToken();
  if (!token) return null;
  return withServiceContext("panel", (db) => validateSession(db, token, getEnv().SESSION_IDLE_HOURS));
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(min: Role): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasMinRole(user.role, min)) await denied(user, `role:${min}`);
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) await denied(user, permission);
  return user;
}

async function denied(user: SessionUser, what: string): Promise<never> {
  const meta = await getRequestMeta();
  await withServiceContext("panel", (db) =>
    recordSecurityEvent(db, { type: "permission_denied", severity: "warning", userId: user.id, ...meta, details: { required: what } }),
  );
  redirect("/?denied=1");
}

/** Consulta con RLS como el usuario actual. */
export async function asCurrentUser<T>(fn: (db: Queryable, user: SessionUser) => Promise<T>): Promise<T> {
  const user = await requireUser();
  return withUserContext(user.id, "panel", (db) => fn(db, user));
}
