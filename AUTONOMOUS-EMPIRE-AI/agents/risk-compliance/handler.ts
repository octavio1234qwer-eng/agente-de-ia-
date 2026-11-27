import type { AgentHandlers } from "../../core/agent-registry/types";
import { verifyAuditChain } from "../../core/audit-log";
import { raiseAlert } from "../../core/event-bus";
import { findBannedClaims, saveReport } from "../shared";
import { periodKey } from "../../core/scheduler";

export const handlers: AgentHandlers = {
  async compliance_scan(ctx) {
    await ctx.require("analysis.run");
    const findings: string[] = [];
    const chain = await verifyAuditChain(ctx.db);
    if (!chain.ok) findings.push(`CRÍTICO: cadena de auditoría rota en el registro ${chain.brokenAt}`);

    const stale = await ctx.db.query<{ n: string }>("select count(*) n from approvals where status='pending' and created_at < now() - interval '7 days'");
    if (Number(stale.rows[0]?.n) > 0) findings.push(`${stale.rows[0]!.n} autorización(es) pendiente(s) por más de 7 días`);

    const noConsent = await ctx.db.query<{ n: string }>(
      "select count(*) n from email_outbox o join leads l on l.id=o.lead_id where o.status in ('approved','sent') and not l.consent_contact");
    if (Number(noConsent.rows[0]?.n) > 0) findings.push("CRÍTICO: correos aprobados/enviados a leads sin consentimiento");

    const unverified = await ctx.db.query<{ n: string }>("select count(*) n from ledger_entries where nature='real' and kind in ('income','commission') and not verified");
    if (Number(unverified.rows[0]?.n) > 0) findings.push("CRÍTICO: ingresos reales sin verificación");

    // Revisar borradores de contenido: afirmaciones prohibidas → rechazar.
    await ctx.require("content.optimize_unpublished");
    const drafts = await ctx.db.query<{ id: string; title: string; body: string }>("select id, title, body from content_items where status in ('draft','approved')");
    let rejected = 0;
    for (const d of drafts.rows) {
      const hits = findBannedClaims(`${d.title}\n${d.body}`);
      if (hits.length) {
        await ctx.db.query("update content_items set status='rejected' where id=$1", [d.id]);
        rejected++;
        findings.push(`Contenido "${d.title}" rechazado por afirmaciones prohibidas`);
      }
    }
    await ctx.require("alert.raise");
    for (const f of findings)
      await raiseAlert(ctx.db, { severity: f.startsWith("CRÍTICO") ? "critical" : "warning", source: ctx.agentId, message: f, dedupeKey: `rc:${periodKey("daily", ctx.now)}:${f.slice(0, 80)}` });
    const body = `# Revisión de cumplimiento\n\n- Cadena de auditoría: ${chain.ok ? `íntegra (${chain.checked} registros)` : `ROTA en ${chain.brokenAt}`}\n- Borradores revisados: ${drafts.rows.length}, rechazados: ${rejected}\n\n## Hallazgos\n${findings.length ? findings.map((f) => `- ${f}`).join("\n") : "- Sin hallazgos"}\n`;
    await ctx.require("report.generate");
    await saveReport(ctx.db, { kind: "compliance", periodKey: periodKey("daily", ctx.now), agentId: ctx.agentId, bodyMd: body, data: { chain, findings } });
    return { chain, findings, rejected };
  },
};
