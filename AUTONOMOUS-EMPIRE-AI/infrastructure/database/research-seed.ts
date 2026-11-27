/** Oportunidades con evidencia citada (investigación 2026-11-27). Idempotente por título. */
import type { Db } from "../../core/db";
import { opportunityScore } from "../../agents/market-intelligence/handler";

const OPPS = [
  { businessUnitId: "cotizafacil-mx", title: "Cotizaciones móviles con envío por WhatsApp y seguimiento para oficios (< $100/mes)",
    demand: 4, pain: 3, competition: 3, feasibility: 4, monthlyCostCents: 0,
    evidence: [
      { source: "https://inegi.org.mx/contenidos/saladeprensa/boletines/2025/ce/CE_2024_RO_Nal.pdf", note: "5.45 M establecimientos, 95.5 % micro (CE 2024)" },
      { source: "https://apps.apple.com/mx/app/cotiza-pro/id6747967324", note: "Competidor directo iOS a $49 MXN/mes: el mercado paga, pero el precio es bajo" },
      { source: "https://www.aurorainbox.com/precio-whatsapp-business-api-mexico-2026/", note: "CRMs con WhatsApp ~$1,390+/mes: hueco de precio entre app simple y CRM" },
    ] },
  { businessUnitId: "digital-products", title: "Plantillas de cotización y control para oficios (producto digital de entrada)",
    demand: 3, pain: 3, competition: 4, feasibility: 5, monthlyCostCents: 0,
    evidence: [{ source: "https://en.www.inegi.org.mx/contenidos/saladeprensa/boletines/2020/OtrTemEcon/CenEconResDef2019_Nal.pdf", note: "Solo 26 % de establecimientos con computadora (2019): formato debe ser imprimible/móvil" }] },
];

export async function seedResearch(db: Db) {
  for (const o of OPPS) {
    const ex = await db.query("select 1 from opportunities where title=$1", [o.title]);
    if (ex.rows.length) continue;
    await db.query(
      `insert into opportunities(business_unit_id, title, demand, pain, competition, feasibility, monthly_cost_cents, evidence, score, status, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'validating','agent:market-intelligence')`,
      [o.businessUnitId, o.title, o.demand, o.pain, o.competition, o.feasibility, o.monthlyCostCents, JSON.stringify(o.evidence), opportunityScore(o)]);
  }
}
