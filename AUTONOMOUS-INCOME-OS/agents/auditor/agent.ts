import type { AgentDefinition } from "@/server/orchestrator/agent";
import { verifyAuditChain } from "@/server/audit";
import { notifyAdmin } from "@/server/notifications";
import { setKillSwitch, getKillSwitch } from "@/server/settings";

/** Umbrales de anomalías (por hora). */
export const AUDIT_THRESHOLDS = { failedLogins: 20, rejectedWebhooks: 10, agentConsecutiveFailures: 3 };

export const auditorAgent: AgentDefinition = {
  name: "auditor",
  title: "Auditor",
  mission: "Verificar la integridad de los registros, detectar accesos sospechosos y fallos, y detener operaciones inseguras.",
  async run(ctx) {
    const findings: { severity: "warning" | "critical"; title: string; detail: string }[] = [];
    const chain = await verifyAuditChain(ctx.db);
    if (!chain.ok) findings.push({ severity: "critical", title: "Bitácora alterada", detail: `Fila ${chain.brokenAtId}: ${chain.reason}` });

    const count = async (sql: string) => (await ctx.db.query<{ n: number }>(sql)).rows[0]?.n ?? 0;
    const failedLogins = await count("SELECT count(*)::int AS n FROM audit_logs WHERE action IN ('admin.login_failed','admin.totp_failed') AND at > now() - interval '1 hour'");
    if (failedLogins >= AUDIT_THRESHOLDS.failedLogins) findings.push({ severity: "warning", title: "Muchos intentos de acceso fallidos", detail: `${failedLogins} en la última hora.` });
    const rejected = await count("SELECT count(*)::int AS n FROM audit_logs WHERE action = 'webhook.rejected' AND at > now() - interval '1 hour'");
    if (rejected >= AUDIT_THRESHOLDS.rejectedWebhooks) findings.push({ severity: "warning", title: "Avisos de pago con firma inválida", detail: `${rejected} en la última hora (posible intento de fraude o secreto mal configurado).` });
    const inReview = await count("SELECT count(*)::int AS n FROM orders WHERE status = 'in_review'");
    if (inReview > 0) findings.push({ severity: "warning", title: "Pedidos en revisión", detail: `${inReview} pedidos con monto distinto al cobrado.` });
    const dead = await count("SELECT count(*)::int AS n FROM tasks WHERE status = 'dead' AND finished_at > now() - interval '1 day'");
    if (dead > 0) findings.push({ severity: "warning", title: "Tareas fallidas", detail: `${dead} tareas agotaron sus reintentos hoy.` });

    // Agentes que fallan seguido: se pausan (nunca el auditor a sí mismo).
    const { rows: agents } = await ctx.db.query<{ agent: string }>("SELECT agent FROM agent_controls WHERE enabled = true AND agent <> 'auditor'");
    const paused: string[] = [];
    for (const { agent } of agents) {
      const { rows } = await ctx.db.query<{ status: string }>("SELECT status FROM agent_runs WHERE agent = $1 ORDER BY started_at DESC LIMIT $2", [agent, AUDIT_THRESHOLDS.agentConsecutiveFailures]);
      if (rows.length === AUDIT_THRESHOLDS.agentConsecutiveFailures && rows.every((r) => r.status === "failed")) {
        const r = await ctx.perform("agent.pause", { summary: `Pausar ${agent} por fallos consecutivos` }, () =>
          ctx.db.query("UPDATE agent_controls SET enabled = false, reason = $2, updated_at = now(), updated_by = 'agent:auditor' WHERE agent = $1", [agent, "Pausado por el auditor: 3 fallos seguidos"]),
        );
        if (r.status === "done") paused.push(agent);
      }
    }
    if (paused.length) findings.push({ severity: "warning", title: "Agentes pausados", detail: paused.join(", ") });

    // Riesgo crítico: detener todo.
    const critical = findings.filter((f) => f.severity === "critical");
    const kill = await getKillSwitch(ctx.db);
    if (critical.length && !kill.active) {
      await ctx.perform("system.kill_switch", { summary: "Detener operaciones automáticas por riesgo crítico" }, () =>
        setKillSwitch(ctx.db, true, critical.map((c) => c.title).join("; "), { type: "agent", id: "auditor" }),
      );
    }
    for (const f of findings) {
      await ctx.perform("notify.admin", { summary: f.title }, () =>
        notifyAdmin(ctx.db, { subject: f.title, body: f.detail, severity: f.severity, dedupeKey: `audit:${f.title}:${ctx.now.toISOString().slice(0, 13)}` }),
      );
    }
    return {
      summary: findings.length ? `${findings.length} hallazgos (${critical.length} críticos). Bitácora: ${chain.ok ? "íntegra" : "ALTERADA"} (${chain.checked} registros).` : `Sin hallazgos. Bitácora íntegra (${chain.checked} registros).`,
      data: { chain, findings, paused },
    };
  },
};
