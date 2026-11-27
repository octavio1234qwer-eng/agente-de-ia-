import type { Queryable } from "../db/types";

export type SecurityEvent = {
  type: string;
  severity?: "info" | "warning" | "critical";
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown>;
};

/** Registra un evento de seguridad. Debe llamarse en contexto de servicio. */
export async function recordSecurityEvent(db: Queryable, event: SecurityEvent): Promise<void> {
  await db.query(
    `insert into vmf.security_events (type, severity, user_id, ip, user_agent, details)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      event.type,
      event.severity ?? "info",
      event.userId ?? null,
      event.ip ?? null,
      event.userAgent?.slice(0, 300) ?? null,
      JSON.stringify(event.details ?? {}),
    ],
  );
}
