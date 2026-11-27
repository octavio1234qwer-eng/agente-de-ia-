/**
 * Adaptador opcional para Claude API (servicio de PAGO). Inactivo si no hay ANTHROPIC_API_KEY.
 * Activarlo requiere autorización del propietario (FINANCIAL_RULES.md: suscripción/servicio de pago = ROJO).
 */
export const anthropicConfigured = () => !!process.env.ANTHROPIC_API_KEY;

export async function generateText(prompt: string, system: string, maxTokens = 800): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY no configurada");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5", max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { content: { type: string; text?: string }[] };
  return j.content.filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();
}
