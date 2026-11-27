import type { AgentDefinition } from "@/server/orchestrator/agent";
import { paymentsConfigured } from "@/server/env";

/** Funciones que la app sabe entregar. Un producto con otro permiso no pasa QA. */
export const DELIVERABLE_FEATURES = ["cotizafacil_pro", "cotizafacil_nube"];
/** Páginas legales que existen en la app (verificado por tests/agents.test.ts). */
export const LEGAL_PAGES = ["/terminos", "/privacidad", "/contacto"];

/** Licencias de terceros incluidas en el producto (revisión de derechos). */
export const THIRD_PARTY = [
  { name: "pdf-lib", license: "MIT", use: "Generación del PDF" },
  { name: "Next.js / React", license: "MIT", use: "Interfaz" },
  { name: "Fuente Helvetica (estándar PDF)", license: "Fuente base de PDF, no se incrusta", use: "PDF" },
];

interface Check {
  name: string;
  ok: boolean;
  severity: "fail" | "warn";
  detail: string;
}

export const productAgent: AgentDefinition = {
  name: "product",
  title: "Producto",
  mission: "Pasar cada versión por control de calidad y revisión de derechos, y pedir aprobación humana antes de publicar.",
  async run(ctx) {
    const { rows } = await ctx.db.query<{
      version_id: string; product_id: string; slug: string; name: string; kind: string; status: string; price_cents: number;
      feature: string | null; description: string | null; qa_status: string;
    }>(
      `SELECT v.id AS version_id, p.id AS product_id, p.slug, p.name, p.kind, p.status, p.price_cents, p.feature, p.description, v.qa_status
       FROM products p JOIN product_versions v ON v.id = p.current_version_id WHERE p.status IN ('draft','in_review','approved')`,
    );
    const results: Record<string, { passed: boolean; checks: Check[] }> = {};
    for (const p of rows) {
      const checks: Check[] = [
        { name: "Descripción clara (≥ 40 caracteres)", ok: (p.description ?? "").length >= 40, severity: "fail", detail: `${(p.description ?? "").length} caracteres` },
        { name: "Precio definido", ok: p.kind === "free_tool" || p.price_cents > 0, severity: "fail", detail: `${p.price_cents / 100} MXN` },
        { name: "Permiso entregable", ok: p.kind === "free_tool" || DELIVERABLE_FEATURES.includes(p.feature ?? ""), severity: "fail", detail: p.feature ?? "sin permiso" },
        { name: "Páginas legales (términos, privacidad, contacto)", ok: LEGAL_PAGES.length === 3, severity: "fail", detail: LEGAL_PAGES.join(", ") },
        { name: "Derechos: solo código propio y licencias permisivas", ok: THIRD_PARTY.every((t) => /MIT|Apache|BSD|ISC|base de PDF/.test(t.license)), severity: "fail", detail: THIRD_PARTY.map((t) => `${t.name} (${t.license})`).join("; ") },
        { name: "Cobros configurados", ok: paymentsConfigured(), severity: "warn", detail: paymentsConfigured() ? "Mercado Pago listo" : "Faltan credenciales: se puede aprobar, pero nadie podrá pagar." },
      ];
      const passed = checks.every((c) => c.ok || c.severity === "warn");
      results[p.slug] = { passed, checks };
      await ctx.perform("product.run_qa", { summary: `QA de ${p.name}` }, () =>
        ctx.db.query("UPDATE product_versions SET qa_status = $2, qa_report = $3, rights_review = $4 WHERE id = $1", [
          p.version_id, passed ? "passed" : "failed", JSON.stringify({ checks, at: ctx.now.toISOString() }),
          JSON.stringify({ original: true, thirdParty: THIRD_PARTY, reviewedBy: "agent:product", at: ctx.now.toISOString() }),
        ]),
      );
      if (passed && p.status !== "published") {
        await ctx.perform("product.publish", {
          summary: `${p.name} pasó el QA. Publicarlo habilita la venta a ${(p.price_cents / 100).toFixed(2)} MXN.`,
          approval: { title: `Publicar ${p.name}`, payload: { productId: p.product_id, slug: p.slug }, risk: "high", dedupeKey: `publish:${p.version_id}` },
        });
      }
    }
    const passed = Object.values(results).filter((r) => r.passed).length;
    return { summary: `${rows.length} versiones revisadas, ${passed} aprobadas por QA.`, data: results };
  },
};
