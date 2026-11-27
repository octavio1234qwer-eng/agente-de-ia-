import type { AgentHandlers } from "../../core/agent-registry/types";
import { raiseAlert } from "../../core/event-bus";
import { validateRegistry } from "../../core/agent-registry";

export type LinkHealth = "ok" | "broken" | "unknown";

/** 404/410/5xx = roto; 401/403/405/429 o errores de red = desconocido (muchas tiendas bloquean bots). */
export async function checkUrl(url: string, fetchFn: typeof fetch = fetch): Promise<{ health: LinkHealth; status: number | null }> {
  try {
    let res = await fetchFn(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(10_000) });
    if (res.status === 405 || res.status === 403) res = await fetchFn(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(10_000) });
    const s = res.status;
    if (s >= 200 && s < 400) return { health: "ok", status: s };
    if (s === 404 || s === 410 || s >= 500) return { health: "broken", status: s };
    return { health: "unknown", status: s };
  } catch {
    return { health: "unknown", status: null };
  }
}

export const handlers: AgentHandlers = {
  async health_check(ctx) {
    await ctx.require("tests.run");
    const t0 = Date.now();
    await ctx.db.query("select 1");
    const dbMs = Date.now() - t0;
    const migrations = await ctx.db.query<{ id: string }>("select id from schema_migrations order by id");
    const failed = await ctx.db.query<{ job_name: string; period_key: string }>("select job_name, period_key from job_runs where status='failed' and started_at > now() - interval '7 days'");
    const registryProblems = validateRegistry();
    if (registryProblems.length) {
      await ctx.require("alert.raise");
      await raiseAlert(ctx.db, { severity: "critical", source: ctx.agentId, message: `Registro de agentes inconsistente: ${registryProblems.join("; ")}`, dedupeKey: "registry-inconsistent" });
    }
    return { db: { kind: ctx.db.kind, latencyMs: dbMs }, migrations: migrations.rows.map((m) => m.id), failedJobs7d: failed.rows, registryProblems };
  },
  async check_affiliate_links(ctx, input) {
    await ctx.require("affiliate.link.check");
    const fetchFn = (input.__fetch as typeof fetch | undefined) ?? fetch;
    const links = await ctx.db.query<{ id: string; slug: string; destination_url: string; status: string }>(
      "select id, slug, destination_url, status from affiliate_links where status <> 'paused'");
    const results = [];
    for (const l of links.rows) {
      const r = await checkUrl(l.destination_url, fetchFn);
      const newStatus = r.health === "broken" ? "broken" : r.health === "ok" ? "active" : l.status;
      await ctx.db.query("update affiliate_links set last_checked_at=now(), last_http_status=$2, status=$3 where id=$1", [l.id, r.status, newStatus]);
      if (r.health === "broken") {
        await ctx.require("alert.raise");
        await raiseAlert(ctx.db, { severity: "warning", source: ctx.agentId, message: `Enlace de afiliado roto: /go/${l.slug} (HTTP ${r.status})`, dedupeKey: `broken:${l.slug}:${ctx.now.toISOString().slice(0, 10)}` });
      }
      results.push({ slug: l.slug, ...r });
    }
    return { checked: results.length, results };
  },
};
