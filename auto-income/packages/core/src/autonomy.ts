/**
 * Política de autonomía.
 *
 * Niveles:
 *  0 Manual            — el sistema solo recomienda; cada tarea espera al propietario.
 *  1 Asistido          — el sistema prepara tareas y pide aprobación para todas.
 *  2 Autónomo limitado — ejecuta tareas internas de bajo riesgo. (NIVEL INICIAL)
 *  3 Supervisado       — además publica contenido YA APROBADO.
 *  4 Avanzado          — además ejecuta optimizaciones internas basadas en métricas.
 *
 * Reglas duras (todos los niveles): dinero, datos sensibles, acciones irreversibles y
 * compromisos/comunicaciones externas SIEMPRE requieren aprobación expresa.
 */

export const AUTONOMY_LEVELS = [0, 1, 2, 3, 4] as const;
export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];
export const DEFAULT_AUTONOMY_LEVEL: AutonomyLevel = 2;

export const RISK_CLASSES = [
  'internal_low', // análisis, borradores, informes internos
  'internal_optimization', // cambios internos basados en métricas (p. ej. reordenar prioridades)
  'publish_approved', // publicar contenido previamente aprobado
  'external_communication', // enviar mensajes/correos a terceros
  'financial', // pagos, compras, reembolsos, movimientos de dinero
  'sensitive_data', // exportar/eliminar datos personales
  'irreversible', // borrar datos, cambios no recuperables
] as const;
export type RiskClass = (typeof RISK_CLASSES)[number];

export type AutonomyDecision = 'execute' | 'require_approval';

const ALWAYS_APPROVAL: ReadonlySet<RiskClass> = new Set(['external_communication', 'financial', 'sensitive_data', 'irreversible']);

export function decideAutonomy(level: AutonomyLevel, risk: RiskClass): AutonomyDecision {
  if (!AUTONOMY_LEVELS.includes(level)) throw new RangeError('nivel de autonomía inválido');
  if (!RISK_CLASSES.includes(risk)) throw new RangeError('clase de riesgo inválida');
  if (ALWAYS_APPROVAL.has(risk)) return 'require_approval';
  if (level <= 1) return 'require_approval';
  if (risk === 'internal_low') return 'execute';
  if (risk === 'publish_approved') return level >= 3 ? 'execute' : 'require_approval';
  if (risk === 'internal_optimization') return level >= 4 ? 'execute' : 'require_approval';
  return 'require_approval';
}

export function describeLevel(level: AutonomyLevel): string {
  return [
    'Manual: el sistema recomienda y tú ejecutas.',
    'Asistido: el sistema prepara tareas y pide aprobación.',
    'Autónomo limitado: ejecuta tareas internas de bajo riesgo.',
    'Supervisado: además publica contenido aprobado.',
    'Avanzado: además optimiza con métricas reales dentro de presupuestos.',
  ][level];
}
