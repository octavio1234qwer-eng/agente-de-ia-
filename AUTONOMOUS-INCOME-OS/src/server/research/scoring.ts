// Puntuación de oportunidades. Regla central: sin evidencia no hay puntuación.
// Cada dimensión se calcula solo con evidencia registrada (URL + fecha). Fórmulas en docs/AUTOMATIONS.md.

export interface EvidenceItem {
  kind: "demand" | "competition" | "pricing" | "customer_problem" | "difficulty" | "channel";
  data: Record<string, unknown>;
  observed_on: string;
}

export interface Scores {
  demand: number | null;
  competition: number | null;
  difficulty: number | null;
  margin: number | null;
  total: number | null;
  confidence: "none" | "low" | "medium" | "high";
  notes: string[];
}

const clamp = (n: number) => Math.max(0, Math.min(10, Math.round(n * 100) / 100));
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function scoreOpportunity(evidence: EvidenceItem[], today = new Date()): Scores {
  const notes: string[] = [];
  const fresh = evidence.filter((e) => (today.getTime() - new Date(e.observed_on).getTime()) / 86_400_000 <= 180);
  if (fresh.length < evidence.length) notes.push(`${evidence.length - fresh.length} evidencias con más de 180 días no cuentan.`);
  const of = (k: EvidenceItem["kind"]) => fresh.filter((e) => e.kind === k);

  // Demanda: señales medibles (impresiones de búsqueda/mes, prospectos, ventas). Escala logarítmica.
  let demand: number | null = null;
  const d = of("demand").concat(of("customer_problem"));
  if (d.length) {
    const impressions = Math.max(0, ...d.map((e) => num(e.data.monthly_impressions) ?? 0));
    const leads = d.reduce((s, e) => s + (num(e.data.leads) ?? 0), 0);
    const sales = d.reduce((s, e) => s + (num(e.data.sales) ?? 0), 0);
    const signal = impressions / 100 + leads * 2 + sales * 20 + d.length;
    demand = clamp(Math.log10(1 + signal) * 3.3);
    if (!impressions && !leads && !sales) notes.push("Demanda solo cualitativa (sin cifras): confianza baja.");
  } else notes.push("Sin evidencia de demanda.");

  // Competencia: más competidores = puntuación más baja (10 = sin competencia observada, pero exige evidencia).
  let competition: number | null = null;
  const c = of("competition");
  if (c.length) {
    const competitors = c.reduce((s, e) => s + (num(e.data.competitors) ?? 1), 0);
    competition = clamp(10 - competitors * 1.5);
  } else notes.push("Sin evidencia de competencia.");

  // Dificultad: 10 = fácil. Requiere una estimación registrada (días de trabajo).
  let difficulty: number | null = null;
  const df = of("difficulty");
  if (df.length) {
    const days = Math.max(...df.map((e) => num(e.data.build_days) ?? 30));
    difficulty = clamp(10 - days / 6);
  } else notes.push("Sin estimación de dificultad.");

  // Margen: precio observado del mercado vs. costo unitario estimado.
  let margin: number | null = null;
  const pr = of("pricing");
  const prices = pr.map((e) => num(e.data.price_mxn)).filter((v): v is number => v !== null && v > 0);
  if (prices.length) {
    const sorted = [...prices].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    const unitCost = Math.max(0, ...pr.map((e) => num(e.data.unit_cost_mxn) ?? 0));
    const fee = median * 0.05 + 4.64; // comisión aproximada de pasarela (supuesto documentado)
    const m = (median - unitCost - fee) / median;
    margin = clamp(m * 10);
  } else notes.push("Sin precios observados.");

  const parts = [demand, competition, difficulty, margin];
  const known = parts.filter((p): p is number => p !== null);
  const total = known.length === 4 ? clamp(demand! * 0.4 + competition! * 0.2 + difficulty! * 0.15 + margin! * 0.25) : null;
  if (total === null) notes.push("Total sin calcular: faltan dimensiones con evidencia.");
  const quantitative = d.some((e) => num(e.data.monthly_impressions) || num(e.data.leads) || num(e.data.sales));
  const confidence: Scores["confidence"] = known.length === 0 ? "none" : known.length < 4 ? "low" : quantitative && fresh.length >= 6 ? "high" : "medium";
  return { demand, competition, difficulty, margin, total, confidence, notes };
}
