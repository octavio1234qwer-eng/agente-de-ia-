/** Datos estructurales (no métricas): unidades de negocio y presupuesto inicial autorizado. Idempotente. */
import type { Db } from "../../core/db";
import { appendAudit } from "../../core/audit-log";
import { syncAgents } from "../../core/agent-registry";

export const UNITS = [
  { id: "cotizafacil-mx", name: "CotizaFácil MX", status: "validating", phase: 4, description: "Cotizaciones profesionales para oficios y pymes en México. Primera unidad a validar." },
  { id: "affiliate-engine", name: "Affiliate Engine", status: "research", phase: 5, description: "Contenido original con enlaces del Programa de Afiliados de Mercado Libre México." },
  { id: "digital-products", name: "Digital Products", status: "active", phase: 6, description: "Plantillas, ebooks e imprimibles vendidos en Gumroad (fabrica-productos/)." },
  { id: "media-engine", name: "Media Engine", status: "research", phase: 7, description: "Canales temáticos con contenido original." },
  { id: "micro-saas", name: "Micro SaaS", status: "research", phase: 8, description: "Software por suscripción para problemas recurrentes de pymes, solo tras validar demanda." },
  { id: "ai-services", name: "AI Services", status: "research", phase: 8, description: "Servicios automatizados (p. ej. agentes de WhatsApp para negocios)." },
] as const;

export async function seed(db: Db) {
  await db.transaction(async (tx) => {
    for (const u of UNITS)
      await tx.query(
        `insert into business_units(id, name, status, phase, description) values ($1,$2,$3,$4,$5) on conflict (id) do nothing`,
        [u.id, u.name, u.status, u.phase, u.description]);
    const b = await tx.query(
      `insert into budgets(id, amount_cents, currency, approved_by, note) values ('initial', 50000, 'MXN', 'owner:master-prompt', $1)
       on conflict (id) do nothing returning id`,
      ["Presupuesto máximo inicial de $500 MXN fijado por el propietario en el MASTER PROMPT (2026-11-27)."]);
    if (b.rows.length)
      await appendAudit(tx, { actor: "owner:master-prompt", action: "budget.set", level: "red", target: "initial", result: "approved", detail: { amountCents: 50000, currency: "MXN" } });
    await syncAgents(tx);
  });
}
