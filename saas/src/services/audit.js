export async function audit(db, { actor, action, target, details = {}, ip }) {
  await db.query(
    `INSERT INTO audit_log (actor_id, actor_email, action, target_user_id, target_email, details, ip)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [actor?.id ?? null, actor?.email ?? null, action, target?.id ?? null, target?.email ?? null, details, ip ?? null],
  );
}
