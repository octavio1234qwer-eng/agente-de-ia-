// Adaptador de modelos de IA. Con el presupuesto autorizado en 0 MXN, el proveedor es
// "none" y los agentes trabajan con reglas deterministas.
//
// Para activar Claude (requiere aprobar un presupuesto > 0 en limits.json, categoría "llm"):
//  1. npm install @anthropic-ai/sdk   (SDK oficial; no usar fetch directo)
//  2. LLM_PROVIDER=anthropic, ANTHROPIC_API_KEY=..., LLM_MODEL=claude-opus-5-5 (modelo por defecto)
//  3. Implementar `anthropicProvider` con client.messages.create y registrar el costo real en agent_runs.cost_cents.
// Nada se activa solo: el guardián de gasto bloquea cualquier llamada con costo mientras el límite sea 0.

export interface LlmProvider {
  name: string;
  /** Costo máximo estimado por llamada en centavos MXN (para el guardián de gasto). */
  maxCostPerCallCents: number;
  complete(input: { system: string; prompt: string; maxTokens: number }): Promise<{ text: string; tokens: number }>;
}

export function getLlmProvider(): LlmProvider | null {
  const provider = process.env.LLM_PROVIDER ?? "none";
  if (provider === "none") return null;
  // Ningún proveedor está implementado sin presupuesto aprobado; ver instrucciones arriba.
  return null;
}
