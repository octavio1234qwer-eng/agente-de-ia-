import type { Queryable } from "../../db/types";

export async function listSecurityEvents(db: Queryable, limit = 50) {
  return db.query<{ id: number; created_at: Date; type: string; severity: string; user_email: string | null; ip: string | null }>(
    `select e.id, e.created_at, e.type, e.severity, u.email as user_email, e.ip
       from vmf.security_events e left join vmf.users u on u.id = e.user_id
      order by e.created_at desc limit $1`,
    [limit],
  );
}

export async function listAuditLog(db: Queryable, limit = 50) {
  return db.query<{ id: number; occurred_at: Date; actor_source: string; action: string; table_name: string; record_id: string | null; user_email: string | null; fields: string[] }>(
    `select a.id, a.occurred_at, a.actor_source, a.action, a.table_name, a.record_id, u.email as user_email,
            array(select jsonb_object_keys(a.changes)) as fields
       from vmf.audit_log a left join vmf.users u on u.id = a.actor_user_id
      order by a.occurred_at desc limit $1`,
    [limit],
  );
}
