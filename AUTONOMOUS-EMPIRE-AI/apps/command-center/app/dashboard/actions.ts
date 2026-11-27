"use server";
import { revalidatePath } from "next/cache";
import { db, requireUser, assertSameOrigin } from "@/lib/server";
import { userActor } from "@empire/core/auth";
import { authorize, decideApproval } from "@empire/core/permissions";
import { appendAudit } from "@empire/core/audit-log";
import { LEAD_STATUSES } from "@empire/businesses/cotizafacil-mx/leads";
import { createLink, importCommissionsCsv, reconcilePayoutsCsv } from "@empire/businesses/affiliate-engine/links";
import { requestSpend, recordApprovedExpense } from "@empire/finance/ledger";
import { runAgentTask } from "@empire/core/orchestrator";
import { ROUTINES, runRoutine } from "@empire/automation/routines";
import { AGENTS } from "@empire/core/agent-registry";

const s = (f: FormData, k: string, max = 500) => String(f.get(k) ?? "").slice(0, max);

async function guarded(min: "viewer" | "operator" | "owner", action: string, target?: string) {
  await assertSameOrigin();
  const u = await requireUser(min);
  const d = await db();
  const actor = userActor(u);
  if (!action.startsWith("approval.")) {
    const dec = await authorize(d, actor, action, { target });
    if (!dec.allowed) throw new Error(dec.reason);
  }
  return { u, d, actor };
}

export async function setLeadStatus(f: FormData) {
  const id = s(f, "id", 40), status = s(f, "status", 20);
  if (!(LEAD_STATUSES as readonly string[]).includes(status)) throw new Error("Estado inválido");
  const { d, actor } = await guarded("operator", "lead.manage", id);
  await d.transaction(async (tx) => {
    await tx.query("update leads set status=$2, updated_at=now() where id=$1", [id, status]);
    await tx.query("insert into lead_activities(lead_id, type, detail, actor) values ($1,'status',$2,$3)", [id, status, actor.id]);
    await appendAudit(tx, { actor: actor.id, action: "lead.status", level: "yellow", target: id, result: status });
  });
  revalidatePath("/dashboard/leads");
}

export async function approveEmail(f: FormData) {
  const id = s(f, "id", 40), decision = s(f, "decision", 10);
  const { d, actor } = await guarded("operator", "email.send_commercial", id);
  const status = decision === "approve" ? "approved" : "blocked";
  await d.query("update email_outbox set status=$2 where id=$1 and status='draft'", [id, status]);
  await appendAudit(d, { actor: actor.id, action: "email.review", level: "yellow", target: id, result: status });
  revalidatePath("/dashboard/leads");
}

export async function reviewContent(f: FormData) {
  const id = s(f, "id", 40), decision = s(f, "decision", 10);
  const { d, actor } = await guarded("operator", "content.approve", id);
  const status = decision === "approve" ? "approved" : "rejected";
  await d.query("update content_items set status=$2, approved_by=$3 where id=$1 and status in ('draft','approved')", [id, status, actor.id]);
  await appendAudit(d, { actor: actor.id, action: "content.review", level: "yellow", target: id, result: status });
  revalidatePath("/dashboard/content");
}

export async function markPublished(f: FormData) {
  const id = s(f, "id", 40), url = s(f, "url", 500);
  if (!/^https:\/\//.test(url)) throw new Error("URL https requerida");
  const { d, actor } = await guarded("operator", "content.publish", id);
  const r = await d.query("update content_items set status='published', published_url=$2 where id=$1 and status='approved' returning id", [id, url]);
  if (!r.rows.length) throw new Error("Solo se puede publicar contenido aprobado");
  await appendAudit(d, { actor: actor.id, action: "content.publish", level: "yellow", target: id, result: "published", detail: { url } });
  revalidatePath("/dashboard/content");
}

export async function addAffiliateLink(f: FormData) {
  await assertSameOrigin();
  const u = await requireUser("operator");
  const bps = s(f, "commissionRatePct", 10);
  await createLink(await db(), userActor(u), {
    slug: s(f, "slug", 64), title: s(f, "title", 160), destinationUrl: s(f, "destinationUrl", 1000),
    commissionRateBps: bps ? Math.round(Number(bps) * 100) : null,
  });
  revalidatePath("/dashboard/affiliates");
}

export async function importCommissions(f: FormData) {
  const { d, actor } = await guarded("operator", "metrics.update");
  const file = f.get("csv");
  const text = file instanceof File ? await file.text() : "";
  if (!text || text.length > 1_000_000) throw new Error("CSV vacío o demasiado grande");
  await importCommissionsCsv(d, text, actor.id);
  revalidatePath("/dashboard/affiliates");
}

export async function requestSpendAction(f: FormData) {
  const { d, actor } = await guarded("operator", "draft.create");
  const amount = Math.round(Number(s(f, "amountMxn", 12)) * 100);
  await requestSpend(d, { requestedBy: actor.id, businessUnitId: s(f, "unit", 40), amountCents: amount, vendor: s(f, "vendor", 120), reason: s(f, "reason", 500) });
  revalidatePath("/dashboard/decisions");
}

export async function decide(f: FormData) {
  const { d, actor } = await guarded("owner", "approval.decide");
  const id = s(f, "id", 40);
  await d.transaction((tx) => decideApproval(tx, { approvalId: id, decidedBy: actor, approve: s(f, "decision", 10) === "approve", note: s(f, "note", 500) || undefined }));
  revalidatePath("/dashboard/decisions");
}

export async function recordExpenseAction(f: FormData) {
  await assertSameOrigin();
  const u = await requireUser("owner");
  await recordApprovedExpense(await db(), userActor(u), { approvalId: s(f, "id", 40), externalId: s(f, "receipt", 120) || undefined, description: s(f, "description", 300) || undefined });
  revalidatePath("/dashboard/decisions");
  revalidatePath("/dashboard/finance");
}

export async function runRoutineNow(f: FormData) {
  const name = s(f, "name", 60);
  if (!ROUTINES[name]) throw new Error("Rutina desconocida");
  await guarded("operator", "tests.run", name);
  await runRoutine(await db(), name, { force: s(f, "force", 5) === "1" });
  revalidatePath("/dashboard/automations");
  revalidatePath("/dashboard");
}

export async function runAgentNow(f: FormData) {
  const agent = s(f, "agent", 40), task = s(f, "task", 60);
  if (!AGENTS.get(agent)?.def.tasks.includes(task)) throw new Error("Tarea inválida");
  await guarded("operator", "analysis.run", `${agent}.${task}`);
  await runAgentTask(await db(), agent, task, {});
  revalidatePath("/dashboard/agents");
  revalidatePath("/dashboard/tasks");
}

export async function resolveAlert(f: FormData) {
  const id = s(f, "id", 40);
  const { d, actor } = await guarded("operator", "data.organize", id);
  await d.query("update alerts set resolved=true where id=$1", [id]);
  await appendAudit(d, { actor: actor.id, action: "alert.resolve", level: "green", target: id, result: "resolved" });
  revalidatePath("/dashboard/alerts");
}

export async function setUnitStatus(f: FormData) {
  const id = s(f, "id", 40), status = s(f, "status", 20);
  if (!["research", "validating", "active", "paused", "killed"].includes(status)) throw new Error("Estado inválido");
  const { d, actor } = await guarded("owner", "config.update_reversible", id);
  await d.query("update business_units set status=$2 where id=$1", [id, status]);
  await appendAudit(d, { actor: actor.id, action: "unit.status", level: "yellow", target: id, result: status });
  await d.query("insert into decisions(made_by, title, rationale) values ($1,$2,$3)", [actor.id, `Unidad ${id} → ${status}`, s(f, "rationale", 500) || "Sin justificación escrita"]);
  revalidatePath("/dashboard/businesses");
}

export async function reconcilePayouts(f: FormData) {
  const { d, actor } = await guarded("owner", "metrics.update");
  const file = f.get("csv");
  const text = file instanceof File ? await file.text() : "";
  if (!text || text.length > 1_000_000) throw new Error("CSV vacío o demasiado grande");
  await reconcilePayoutsCsv(d, text, actor.id);
  revalidatePath("/dashboard/affiliates");
  revalidatePath("/dashboard/finance");
}
