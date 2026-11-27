import type { Queryable } from "../core/db";

export async function saveReport(
  q: Queryable, r: { kind: string; periodKey: string; agentId: string; bodyMd: string; data?: unknown },
) {
  await q.query(
    `insert into reports(kind, period_key, agent_id, body_md, data) values ($1,$2,$3,$4,$5)
     on conflict (kind, period_key, agent_id) do update set body_md=excluded.body_md, data=excluded.data, created_at=now()`,
    [r.kind, r.periodKey, r.agentId, r.bodyMd, JSON.stringify(r.data ?? {})],
  );
}

/** Frases prohibidas en contenido comercial (promesas de ingresos, afirmaciones no verificables). */
export const BANNED_CLAIMS = [
  /ingresos? garantizad/i, /hazte rico/i, /dinero f[aá]cil/i, /sin esfuerzo/i, /100\s?% seguro/i,
  /gana \$?\d[\d,.]* (al|por) (d[ií]a|mes)/i, /el mejor del mercado/i, /resultados garantizados/i,
];
export const findBannedClaims = (text: string) => BANNED_CLAIMS.filter((re) => re.test(text)).map((re) => re.source);
