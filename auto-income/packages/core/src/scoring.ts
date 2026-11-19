/**
 * Business Factory — puntuación de oportunidades.
 *
 * Cada criterio se califica de 1 a 5 por quien tenga evidencia (propietario o agente de investigación).
 * Para criterios "negativos" (competencia, costos, complejidad, riesgo, tiempo) un 5 significa MÁS desfavorable,
 * así que se invierten antes de ponderar. Resultado: 0–100.
 *
 * Cada criterio debe declarar su nivel de evidencia: verified | estimate | hypothesis.
 * La confianza global baja cuando predominan hipótesis; nunca se presenta una hipótesis como dato.
 */

export const CRITERIA = [
  'demand',
  'competition',
  'devCost',
  'opCost',
  'monetization',
  'complexity',
  'risk',
  'timeToValidate',
] as const;
export type Criterion = (typeof CRITERIA)[number];

const NEGATIVE: ReadonlySet<Criterion> = new Set(['competition', 'devCost', 'opCost', 'complexity', 'risk', 'timeToValidate']);

export const DEFAULT_WEIGHTS: Record<Criterion, number> = {
  demand: 0.22,
  competition: 0.1,
  devCost: 0.1,
  opCost: 0.12,
  monetization: 0.2,
  complexity: 0.08,
  risk: 0.1,
  timeToValidate: 0.08,
};

export type EvidenceLevel = 'verified' | 'estimate' | 'hypothesis';

export interface CriterionScore {
  value: number; // 1..5
  evidence: EvidenceLevel;
  note?: string;
  source?: string;
}

export type OpportunityScores = Record<Criterion, CriterionScore>;

export interface ScoreResult {
  score: number; // 0..100
  confidence: 'alta' | 'media' | 'baja';
  recommendation: 'validar' | 'investigar_mas' | 'descartar';
  breakdown: Record<Criterion, { normalized: number; weighted: number; evidence: EvidenceLevel }>;
  warnings: string[];
}

export function scoreOpportunity(scores: OpportunityScores, weights: Record<Criterion, number> = DEFAULT_WEIGHTS): ScoreResult {
  const totalWeight = CRITERIA.reduce((s, c) => s + weights[c], 0);
  if (Math.abs(totalWeight) < 1e-9) throw new RangeError('los pesos no pueden sumar 0');
  const warnings: string[] = [];
  const breakdown = {} as ScoreResult['breakdown'];
  let sum = 0;
  let hypotheses = 0;
  let verified = 0;
  for (const c of CRITERIA) {
    const entry = scores[c];
    if (!entry) throw new RangeError(`falta el criterio ${c}`);
    if (!Number.isFinite(entry.value) || entry.value < 1 || entry.value > 5) throw new RangeError(`${c}: valor entre 1 y 5`);
    if (!['verified', 'estimate', 'hypothesis'].includes(entry.evidence)) throw new RangeError(`${c}: evidencia inválida`);
    if (entry.evidence === 'verified' && !entry.source) {
      warnings.push(`${c}: marcado como verificado sin fuente; se trata como estimación`);
    }
    const evidence: EvidenceLevel = entry.evidence === 'verified' && !entry.source ? 'estimate' : entry.evidence;
    if (evidence === 'hypothesis') hypotheses++;
    if (evidence === 'verified') verified++;
    const positive = NEGATIVE.has(c) ? 6 - entry.value : entry.value;
    const normalized = (positive - 1) / 4; // 0..1
    const weighted = (normalized * weights[c]) / totalWeight;
    sum += weighted;
    breakdown[c] = { normalized, weighted, evidence };
  }
  const score = Math.round(sum * 1000) / 10;
  const confidence = hypotheses >= 4 ? 'baja' : verified >= 3 && hypotheses <= 1 ? 'alta' : 'media';
  if (confidence === 'baja') warnings.push('La mayoría de los datos son hipótesis: valida la demanda antes de invertir tiempo.');
  let recommendation: ScoreResult['recommendation'] = score >= 65 ? 'validar' : score >= 45 ? 'investigar_mas' : 'descartar';
  if (recommendation === 'validar' && confidence === 'baja') recommendation = 'investigar_mas';
  return { score, confidence, recommendation, breakdown, warnings };
}

/** Normaliza un nombre para detectar negocios duplicados. */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
