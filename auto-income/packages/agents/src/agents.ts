/**
 * Definición de los agentes y sus tareas. Toda la lógica es determinista y usa datos reales de la base;
 * ningún handler inventa estadísticas. Cuando falta información, la tarea falla con un mensaje claro.
 * (La integración opcional con un LLM se hará detrás de una interfaz; ver DECISIONS.md D-008.)
 */
import { randomUUID } from 'node:crypto';
import { all, get, run, parseJson, notify } from '../../database/src/index.ts';
import { scoreOpportunity, CRITERIA, type OpportunityScores } from '../../core/src/scoring.ts';
import { marginPct } from '../../core/src/pricing.ts';
import { TaskError, tokenize } from './orchestrator.ts';
import type { AgentDefinition, TaskContext } from './types.ts';
import { financialSummary } from '../../analytics/src/metrics.ts';

const LIMITS = { maxTasksPerHour: 60, maxAttempts: 3, timeoutMs: 30_000 };

function requireBusiness(ctx: TaskContext): Record<string, unknown> {
  if (!ctx.businessId) throw new TaskError('esta tarea requiere un negocio');
  const b = get<Record<string, unknown>>(ctx.db, 'SELECT * FROM businesses WHERE id = ?', ctx.businessId);
  if (!b) throw new TaskError('negocio no encontrado');
  return b;
}

function requireProduct(ctx: TaskContext): Record<string, unknown> {
  const productId = ctx.input.productId;
  if (typeof productId !== 'string') throw new TaskError('falta productId');
  const p = get<Record<string, unknown>>(ctx.db, 'SELECT * FROM products WHERE id = ? AND business_id = ?', productId, ctx.businessId ?? '');
  if (!p) throw new TaskError('producto no encontrado en este negocio');
  return p;
}

function text(v: unknown, field: string, max = 2000): string {
  if (typeof v !== 'string' || !v.trim()) throw new TaskError(`falta el dato "${field}" (no se inventan datos)`);
  return v.trim().slice(0, max);
}

// ---------- CEO ----------
const ceo: AgentDefinition = {
  id: 'ceo',
  name: 'CEO Agent',
  objective: 'Coordinar el ecosistema: priorizar, distribuir tareas, detectar problemas y recomendar estrategias.',
  instructions: ['Basar cada recomendación en datos de la base.', 'Delegar en agentes especializados mediante subtareas.', 'Nunca ejecutar operaciones financieras.'],
  tools: ['db.read', 'tasks.enqueue', 'notifications.write'],
  forbidden: ['mover dinero', 'comprar servicios', 'enviar mensajes externos'],
  limits: LIMITS,
  handlers: {
    'ceo.review': {
      description: 'Revisión del ecosistema y detección de problemas',
      risk: 'internal_low',
      idempotent: true,
      run(ctx) {
        const businesses = all<Record<string, unknown>>(ctx.db, "SELECT id, name, status FROM businesses WHERE status != 'archived'");
        const problems: string[] = [];
        const recommendations: string[] = [];
        const perBusiness = businesses.map((b) => {
          const id = b.id as string;
          const products = get<{ n: number }>(ctx.db, "SELECT COUNT(*) n FROM products WHERE business_id = ? AND status != 'archived'", id)!.n;
          const customers = get<{ n: number }>(ctx.db, 'SELECT COUNT(*) n FROM customers WHERE business_id = ?', id)!.n;
          const fin = financialSummary(ctx.db, { businessId: id });
          if (products === 0) { problems.push(`${b.name}: sin productos`); recommendations.push(`Crear el primer producto de ${b.name} (Product Creation Agent).`); }
          if (customers === 0) recommendations.push(`${b.name}: registrar prospectos reales en el CRM antes de escalar.`);
          if (fin.netProfitCents < 0) problems.push(`${b.name}: beneficio neto negativo`);
          return { id, name: b.name, status: b.status, products, customers, netProfitCents: fin.netProfitCents, grossIncomeCents: fin.grossIncomeCents };
        });
        const failed = get<{ n: number }>(ctx.db, "SELECT COUNT(*) n FROM tasks WHERE status = 'FAILED'")!.n;
        const waiting = get<{ n: number }>(ctx.db, "SELECT COUNT(*) n FROM tasks WHERE status = 'WAITING_APPROVAL'")!.n;
        if (failed > 0) problems.push(`${failed} tarea(s) fallida(s) por revisar`);
        if (waiting > 0) recommendations.push(`Hay ${waiting} tarea(s) esperando tu aprobación.`);
        if (businesses.length === 0) recommendations.push('Crea tu primer negocio (sugerido: CotizaFácil MX).');
        if (problems.length) notify(ctx.db, { level: 'warning', title: 'Revisión del CEO: problemas detectados', body: problems.join('\n') });
        return { businesses: perBusiness, failedTasks: failed, waitingApproval: waiting, problems, recommendations };
      },
    },
    'ceo.launch_pipeline': {
      description: 'Lanzar el proceso Business Factory para un negocio',
      risk: 'internal_low',
      idempotent: true,
      run(ctx) {
        const b = requireBusiness(ctx);
        const id = b.id as string;
        const product = ctx.input.product as Record<string, unknown> | undefined;
        const steps: string[] = [];
        const research = ctx.input.scores
          ? ctx.enqueue({ agentId: 'market_research', type: 'research.evaluate_opportunity', input: { scores: ctx.input.scores }, idempotencyKey: `pipeline:${id}:research`, priority: 70 })
          : null;
        if (research) steps.push(research.id);
        if (product) {
          const spec = ctx.enqueue({ agentId: 'product_creation', type: 'product.create_spec', input: product, dependsOn: research ? [research.id] : [], idempotencyKey: `pipeline:${id}:product:${String(product.name)}`, priority: 60 });
          steps.push(spec.id);
        }
        const fin = ctx.enqueue({ agentId: 'financial', type: 'finance.report', input: {}, idempotencyKey: `pipeline:${id}:finance:${ctx.task.id}`, priority: 30 });
        steps.push(fin.id);
        return { business: b.name, createdTasks: steps, note: product ? 'Al terminar la especificación ejecuta product.quality_check y seo.metadata.' : 'Sin datos de producto: solo se programó investigación/finanzas.' };
      },
    },
  },
};

// ---------- MARKET RESEARCH ----------
const marketResearch: AgentDefinition = {
  id: 'market_research',
  name: 'Market Research Agent',
  objective: 'Evaluar oportunidades distinguiendo datos verificados, estimaciones e hipótesis.',
  instructions: ['No inventar búsquedas, ventas ni tendencias.', 'Cada dato lleva nivel de evidencia y fuente si es verificado.'],
  tools: ['db.read', 'scoring', 'knowledge.write'],
  forbidden: ['inventar estadísticas', 'presentar hipótesis como hechos'],
  limits: LIMITS,
  handlers: {
    'research.evaluate_opportunity': {
      description: 'Puntuar una oportunidad de negocio (Business Factory)',
      risk: 'internal_low',
      idempotent: true,
      run(ctx) {
        const b = requireBusiness(ctx);
        const scores = ctx.input.scores as OpportunityScores | undefined;
        if (!scores || typeof scores !== 'object') throw new TaskError('se requieren las puntuaciones por criterio con su evidencia; el agente no inventa datos');
        const result = scoreOpportunity(scores);
        run(ctx.db, "UPDATE businesses SET opportunity_score = ?, opportunity_data = ?, status = CASE WHEN status = 'idea' THEN 'validating' ELSE status END, updated_at = ? WHERE id = ?",
          result.score, JSON.stringify({ scores, result }), ctx.now().toISOString(), b.id as string);
        const lines = CRITERIA.map((c) => `- ${c}: ${scores[c].value}/5 (${result.breakdown[c].evidence})${scores[c].source ? ' fuente: ' + scores[c].source : ''}`);
        ctx.knowledge.add({ kind: 'research', title: `Evaluación de oportunidad: ${b.name}`, body: `Puntuación ${result.score}/100, confianza ${result.confidence}, recomendación ${result.recommendation}.\n${lines.join('\n')}\n${result.warnings.join('\n')}`, tags: ['business-factory'] });
        return result;
      },
    },
  },
};

// ---------- PRODUCT CREATION ----------
function salesPage(p: { name: string; audience: string; problem: string; valueProposition: string; description: string; priceText: string }): string {
  return [
    `# ${p.name}`, '', p.valueProposition, '',
    '## ¿Para quién es?', p.audience, '',
    '## El problema', p.problem, '',
    '## Qué incluye', p.description, '',
    '## Precio', p.priceText, '',
    '## Garantía y soporte', 'Escríbenos si tienes dudas antes o después de tu compra.',
  ].join('\n');
}

const productCreation: AgentDefinition = {
  id: 'product_creation',
  name: 'Product Creation Agent',
  objective: 'Crear productos digitales originales, útiles y comercializables, con control de calidad.',
  instructions: ['Usar solo los datos proporcionados.', 'No publicar productos que no pasen QA.'],
  tools: ['products.write', 'knowledge.write'],
  forbidden: ['publicar sin QA aprobado', 'copiar contenido de terceros'],
  limits: LIMITS,
  handlers: {
    'product.create_spec': {
      description: 'Crear especificación, página de venta y documentación base de un producto',
      risk: 'internal_low',
      idempotent: false,
      run(ctx) {
        const b = requireBusiness(ctx);
        const name = text(ctx.input.name, 'name', 120);
        const kind = text(ctx.input.kind ?? 'template', 'kind', 40);
        const audience = text(ctx.input.audience, 'audience');
        const problem = text(ctx.input.problem, 'problem');
        const valueProposition = text(ctx.input.valueProposition, 'valueProposition');
        const description = text(ctx.input.description, 'description', 5000);
        const priceCents = Number(ctx.input.priceCents ?? 0);
        const costCents = Number(ctx.input.costCents ?? 0);
        if (!Number.isInteger(priceCents) || priceCents < 0 || !Number.isInteger(costCents) || costCents < 0) throw new TaskError('precio/costo deben ser centavos enteros');
        const priceText = priceCents > 0 ? `$${(priceCents / 100).toFixed(2)} ${b.currency}` : 'Gratis';
        const id = `prd_${randomUUID().replace(/-/g, '')}`;
        const now = ctx.now().toISOString();
        run(ctx.db, `INSERT INTO products (id, business_id, name, kind, description, audience, problem, value_proposition, price_cents, cost_cents, currency, status, sales_page, documentation, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
          id, b.id as string, name, kind, description, audience, problem, valueProposition, priceCents, costCents, b.currency as string,
          salesPage({ name, audience, problem, valueProposition, description, priceText }),
          `# ${name} — Guía de uso\n\n## Requisitos\n\n## Pasos\n\n## Preguntas frecuentes\n`, now, now);
        return { productId: id, status: 'draft', next: 'product.quality_check' };
      },
    },
    'product.quality_check': {
      description: 'Control de calidad de un producto antes de publicarlo',
      risk: 'internal_low',
      idempotent: true,
      run(ctx) {
        const p = requireProduct(ctx);
        const issues: string[] = [];
        const warnings: string[] = [];
        if (String(p.name).length < 3) issues.push('nombre demasiado corto');
        if (String(p.description).length < 40) issues.push('descripción insuficiente (mínimo 40 caracteres)');
        for (const f of ['audience', 'problem', 'value_proposition'] as const) if (!String(p[f]).trim()) issues.push(`falta ${f}`);
        if ((p.price_cents as number) > 0 && (p.price_cents as number) <= (p.cost_cents as number)) issues.push('el precio no cubre el costo');
        const m = marginPct(p.price_cents as number, p.cost_cents as number);
        if (m !== null && m < 30 && m > 0) warnings.push(`margen bajo (${m.toFixed(1)}%)`);
        const blob = `${p.sales_page} ${p.description}`;
        if (/lorem ipsum|TODO|\[PENDIENTE\]/i.test(blob)) issues.push('contiene texto de relleno');
        if (!/##\s*Precio/.test(String(p.sales_page))) issues.push('la página de venta no tiene sección de precio');
        if (/#\s*Requisitos\s*\n\s*\n##/.test(String(p.documentation))) warnings.push('la documentación tiene secciones vacías');
        const passed = issues.length === 0;
        const report = { passed, issues, warnings, checkedAt: ctx.now().toISOString() };
        const status = passed ? (p.status === 'published' ? 'published' : 'ready') : 'review';
        run(ctx.db, 'UPDATE products SET qa_report = ?, status = ?, updated_at = ? WHERE id = ?', JSON.stringify(report), status, ctx.now().toISOString(), p.id as string);
        return { ...report, status };
      },
    },
    'product.publish': {
      description: 'Publicar un producto que pasó QA',
      risk: 'publish_approved',
      idempotent: true,
      run(ctx) {
        const p = requireProduct(ctx);
        const qa = parseJson<{ passed?: boolean }>(p.qa_report, {});
        if (!qa.passed) throw new TaskError('el producto no ha pasado el control de calidad');
        run(ctx.db, "UPDATE products SET status = 'published', updated_at = ? WHERE id = ?", ctx.now().toISOString(), p.id as string);
        return { productId: p.id, status: 'published', note: 'Publicado dentro de AUTO-INCOME (catálogo). No se publicó en plataformas externas.' };
      },
    },
  },
};

// ---------- SOFTWARE ENGINEERING ----------
const softwareEngineering: AgentDefinition = {
  id: 'software_engineering',
  name: 'Software Engineering Agent',
  objective: 'Construir y mantener aplicaciones; verificar el sistema antes de declarar algo terminado.',
  instructions: ['Nunca declarar completada una tarea sin verificación.', 'No ejecutar código arbitrario sin aislamiento.'],
  tools: ['db.integrity_check'],
  forbidden: ['ejecutar código arbitrario', 'desplegar sin pruebas'],
  limits: LIMITS,
  handlers: {
    'engineering.system_check': {
      description: 'Verificar integridad de la base de datos y migraciones',
      risk: 'internal_low',
      idempotent: true,
      run(ctx) {
        const integrity = get<{ integrity_check: string }>(ctx.db, 'PRAGMA integrity_check')?.integrity_check;
        const fk = all(ctx.db, 'PRAGMA foreign_key_check');
        const version = get<{ v: number }>(ctx.db, 'SELECT MAX(version) v FROM schema_migrations')?.v;
        return { integrity, foreignKeyViolations: fk.length, schemaVersion: version, ok: integrity === 'ok' && fk.length === 0 };
      },
    },
  },
};

// ---------- SEO ----------
const INTENT: Record<string, RegExp> = {
  transaccional: /\b(comprar|precio|precios|barato|cotizar|cotizacion|plantilla|descargar|gratis|app|herramienta|calculadora)\b/,
  comercial: /\b(mejor|mejores|vs|comparar|comparativa|opiniones|alternativa|alternativas|top)\b/,
  informacional: /\b(como|que|guia|ejemplo|ejemplos|calcular|formula|significa|pasos|tutorial)\b/,
};
function classifyIntent(keyword: string): string {
  const k = keyword.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  for (const [intent, re] of Object.entries(INTENT)) if (re.test(k)) return intent;
  return 'navegacional/indefinida';
}
function slugify(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}
function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  return cut.slice(0, cut.lastIndexOf(' ') > 20 ? cut.lastIndexOf(' ') : cut.length) + '…';
}

const seo: AgentDefinition = {
  id: 'seo',
  name: 'SEO Agent',
  objective: 'Adquisición orgánica con contenido original y optimización técnica honesta.',
  instructions: ['No inventar volúmenes de búsqueda.', 'Evitar contenido masivo de baja calidad.'],
  tools: ['products.read', 'knowledge.write'],
  forbidden: ['contenido duplicado masivo', 'técnicas de manipulación de buscadores'],
  limits: LIMITS,
  handlers: {
    'seo.keyword_plan': {
      description: 'Clasificar palabras clave semilla por intención de búsqueda',
      risk: 'internal_low',
      idempotent: true,
      run(ctx) {
        const seeds = Array.isArray(ctx.input.keywords) ? (ctx.input.keywords as unknown[]).filter((k): k is string => typeof k === 'string' && k.trim() !== '').slice(0, 100) : [];
        if (seeds.length === 0) throw new TaskError('proporciona palabras clave semilla (keywords)');
        const plan = seeds.map((k) => ({ keyword: k.trim(), intent: classifyIntent(k), slug: slugify(k), searchVolume: null, volumeNote: 'desconocido: requiere una fuente verificada (p. ej. Google Search Console)' }));
        return { keywords: plan };
      },
    },
    'seo.metadata': {
      description: 'Generar título, meta descripción y slug para un producto',
      risk: 'internal_low',
      idempotent: true,
      run(ctx) {
        const p = requireProduct(ctx);
        const b = requireBusiness(ctx);
        const title = clip(`${p.name} | ${b.name}`, 60);
        const description = clip(`${p.value_proposition} ${p.audience ? 'Para ' + String(p.audience).charAt(0).toLowerCase() + String(p.audience).slice(1) : ''}`.trim(), 155);
        return { title, description, slug: slugify(String(p.name)), titleLength: title.length, descriptionLength: description.length };
      },
    },
  },
};

// ---------- MARKETING ----------
const marketing: AgentDefinition = {
  id: 'marketing',
  name: 'Marketing Agent',
  objective: 'Preparar contenido comercial y experimentos; publicar solo con permisos.',
  instructions: ['Todo contenido nace como borrador.', 'No prometer resultados ni usar reseñas falsas.'],
  tools: ['products.read', 'knowledge.write'],
  forbidden: ['publicar sin aprobación', 'spam', 'reseñas falsas', 'comprar tráfico'],
  limits: LIMITS,
  handlers: {
    'marketing.draft_posts': {
      description: 'Redactar borradores de publicaciones para un producto',
      risk: 'internal_low',
      idempotent: true,
      run(ctx) {
        const p = requireProduct(ctx);
        const channels = ['facebook', 'instagram', 'whatsapp_estado', 'linkedin'];
        const drafts = channels.map((channel) => ({
          channel,
          status: 'borrador',
          text: channel === 'linkedin'
            ? `${p.problem}\n\nCreamos ${p.name}: ${p.value_proposition}\n\nIdeal para: ${p.audience}.`
            : `¿${String(p.problem).replace(/[.?¿!]+$/, '')}? 🤔\n${p.name}: ${p.value_proposition}\n👉 Escríbenos para más información.`,
        }));
        ctx.knowledge.add({ kind: 'strategy', title: `Borradores de publicaciones: ${p.name}`, body: drafts.map((d) => `[${d.channel}]\n${d.text}`).join('\n\n'), tags: ['draft-post', String(p.id)] });
        return { drafts, note: 'Borradores sin publicar. Publicar requiere conectar un canal y aprobación.' };
      },
    },
  },
};

// ---------- SALES ----------
const sales: AgentDefinition = {
  id: 'sales',
  name: 'Sales Agent',
  objective: 'Organizar prospectos, clasificarlos y preparar propuestas.',
  instructions: ['Sin spam ni mensajes masivos sin autorización.'],
  tools: ['crm.read', 'crm.write_followups', 'quotes.read'],
  forbidden: ['enviar mensajes sin aprobación', 'mensajes masivos'],
  limits: LIMITS,
  handlers: {
    'sales.score_leads': {
      description: 'Clasificar prospectos del CRM (caliente/tibio/frío)',
      risk: 'internal_low',
      idempotent: true,
      run(ctx) {
        requireBusiness(ctx);
        const now = ctx.now().getTime();
        const leads = all<Record<string, unknown>>(ctx.db, "SELECT * FROM customers WHERE business_id = ? AND stage NOT IN ('won','lost')", ctx.businessId!);
        const scored = leads.map((l) => {
          let score = 0;
          if (l.email) score += 15;
          if (l.phone) score += 15;
          score += ({ new: 5, contacted: 15, qualified: 30, proposal: 45 } as Record<string, number>)[l.stage as string] ?? 0;
          const quotes = get<{ n: number }>(ctx.db, 'SELECT COUNT(*) n FROM quotes WHERE customer_id = ?', l.id as string)!.n;
          if (quotes > 0) score += 15;
          const ageDays = (now - Date.parse(l.updated_at as string)) / 86_400_000;
          if (ageDays > 30) score -= 20;
          const temperature = score >= 60 ? 'caliente' : score >= 30 ? 'tibio' : 'frío';
          return { id: l.id, name: l.name, stage: l.stage, score, temperature, staleDays: Math.floor(ageDays) };
        }).sort((a, b) => b.score - a.score);
        return { leads: scored, total: scored.length };
      },
    },
    'sales.draft_proposal': {
      description: 'Redactar propuesta comercial para una cotización',
      risk: 'internal_low',
      idempotent: true,
      run(ctx) {
        const b = requireBusiness(ctx);
        const q = get<Record<string, unknown>>(ctx.db, 'SELECT * FROM quotes WHERE id = ? AND business_id = ?', String(ctx.input.quoteId ?? ''), ctx.businessId!);
        if (!q) throw new TaskError('cotización no encontrada');
        const totals = parseJson<{ totalCents: number; lines: { description: string; quantity: number }[] }>(q.totals, { totalCents: 0, lines: [] });
        const body = [
          `Hola ${q.customer_name || ''}`.trim() + ',', '',
          `Gracias por tu interés en ${b.name}. Te compartimos la cotización ${q.number}:`,
          ...totals.lines.map((l) => `• ${l.quantity} × ${l.description}`),
          `Total: $${(totals.totalCents / 100).toFixed(2)} ${q.currency}`,
          q.valid_until ? `Vigente hasta: ${q.valid_until}` : '', '',
          'Quedamos atentos a cualquier duda.',
        ].filter((x) => x !== '').join('\n');
        return { draft: body, status: 'borrador', note: 'No se envió. El envío requiere tu aprobación.' };
      },
    },
  },
};

// ---------- CUSTOMER SUPPORT ----------
const support: AgentDefinition = {
  id: 'customer_support',
  name: 'Customer Support Agent',
  objective: 'Responder con base en la documentación y escalar lo que no esté documentado.',
  instructions: ['No inventar políticas, precios ni datos de clientes.'],
  tools: ['knowledge.read', 'notifications.write'],
  forbidden: ['inventar políticas o precios'],
  limits: LIMITS,
  handlers: {
    'support.answer': {
      description: 'Preparar respuesta a una pregunta usando la base de conocimiento',
      risk: 'internal_low',
      idempotent: true,
      run(ctx) {
        const question = text(ctx.input.question, 'question', 1000);
        const terms = tokenize(question);
        const hits = ctx.knowledge.search(question, ['faq', 'doc']);
        const best = hits[0];
        const overlap = best ? terms.filter((t) => tokenize(`${best.title} ${best.body}`).includes(t)).length / Math.max(terms.length, 1) : 0;
        if (!best || overlap < 0.5) {
          notify(ctx.db, { businessId: ctx.businessId, level: 'warning', title: 'Pregunta escalada a soporte humano', body: question });
          return { answered: false, escalated: true, answer: null, reason: 'No hay documentación suficiente; se escaló a una persona.' };
        }
        return { answered: true, escalated: false, answer: best.body, source: { id: best.id, title: best.title }, confidence: Math.round(overlap * 100) / 100 };
      },
    },
  },
};

// ---------- FINANCIAL ----------
const financial: AgentDefinition = {
  id: 'financial',
  name: 'Financial Agent',
  objective: 'Registrar y analizar finanzas reales; recomendar reinversión sin mover dinero.',
  instructions: ['Ingresos brutos ≠ beneficio.', 'Solo transacciones confirmadas cuentan.'],
  tools: ['finance.read'],
  forbidden: ['mover dinero', 'pagar', 'comprar servicios'],
  limits: LIMITS,
  handlers: {
    'finance.report': {
      description: 'Informe financiero y recomendaciones de reinversión',
      risk: 'internal_low',
      idempotent: true,
      run(ctx) {
        const from = typeof ctx.input.from === 'string' ? ctx.input.from : undefined;
        const to = typeof ctx.input.to === 'string' ? ctx.input.to : undefined;
        const summary = financialSummary(ctx.db, { businessId: ctx.businessId ?? undefined, from, to });
        const paidServices = all<Record<string, unknown>>(ctx.db, 'SELECT name, monthly_cents FROM service_costs WHERE enabled = 1 AND monthly_cents > 0');
        const recommendations: string[] = [];
        if (summary.confirmedIncomeCount === 0) recommendations.push('Aún no hay ventas confirmadas: no hay beneficios que reinvertir. Prioriza validar demanda con costo $0.');
        else if (summary.netProfitCents <= 0) recommendations.push('Beneficio neto ≤ 0: no reinvertir; revisar gastos y precios.');
        else {
          const r = summary.netProfitCents;
          recommendations.push(`Propuesta (requiere tu aprobación): reserva 50% ($${(r * 0.5 / 100).toFixed(2)}), mejora de producto 30% ($${(r * 0.3 / 100).toFixed(2)}), marketing orgánico/herramientas 20% ($${(r * 0.2 / 100).toFixed(2)}).`);
        }
        if (paidServices.length && summary.grossIncomeCents === 0) recommendations.push(`Servicios de pago activos sin ingresos: ${paidServices.map((s) => s.name).join(', ')}. Considera desactivarlos.`);
        return { summary, recommendations, note: 'El agente no ejecuta pagos ni inversiones.' };
      },
    },
  },
};

// ---------- QA & SECURITY ----------
const qaSecurity: AgentDefinition = {
  id: 'qa_security',
  name: 'QA and Security Agent',
  objective: 'Supervisar calidad y seguridad; bloquear tareas riesgosas.',
  instructions: ['Reportar hallazgos con severidad.', 'Puede cancelar tareas en cola por riesgo.'],
  tools: ['db.read', 'tasks.cancel', 'config.read'],
  forbidden: ['exponer secretos en resultados'],
  limits: LIMITS,
  handlers: {
    'qa.audit': {
      description: 'Auditoría de configuración, tareas y productos',
      risk: 'internal_low',
      idempotent: true,
      run(ctx) {
        const findings: { severity: 'alta' | 'media' | 'baja'; message: string }[] = [];
        const env = ctx.env;
        if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) findings.push({ severity: 'alta', message: 'SESSION_SECRET ausente o corto (mínimo 32 caracteres).' });
        const owners = get<{ n: number }>(ctx.db, "SELECT COUNT(*) n FROM users WHERE role = 'owner'")!.n;
        if (owners > 0 && env.OWNER_SETUP_TOKEN) findings.push({ severity: 'media', message: 'OWNER_SETUP_TOKEN sigue configurado tras crear el propietario: elimínalo.' });
        if (owners === 0) findings.push({ severity: 'alta', message: 'No existe cuenta de propietario.' });
        if (!env.PAYMENT_WEBHOOK_SECRET) findings.push({ severity: 'baja', message: 'Sin PAYMENT_WEBHOOK_SECRET: los webhooks de pago se rechazan (modo demo).' });
        const stats = get<{ total: number; failed: number }>(ctx.db, "SELECT COUNT(*) total, SUM(status = 'FAILED') failed FROM tasks")!;
        if (stats.total >= 10 && (stats.failed ?? 0) / stats.total > 0.2) findings.push({ severity: 'media', message: `Tasa de fallos alta: ${stats.failed}/${stats.total}.` });
        const stale = get<{ n: number }>(ctx.db, "SELECT COUNT(*) n FROM tasks WHERE status = 'WAITING_APPROVAL' AND created_at < ?", new Date(ctx.now().getTime() - 72 * 3_600_000).toISOString())!.n;
        if (stale) findings.push({ severity: 'baja', message: `${stale} aprobación(es) pendientes con más de 72 h.` });
        const badPublished = all<Record<string, unknown>>(ctx.db, "SELECT name, qa_report FROM products WHERE status = 'published'").filter((p) => !parseJson<{ passed?: boolean }>(p.qa_report, {}).passed);
        for (const p of badPublished) findings.push({ severity: 'alta', message: `Producto publicado sin QA aprobado: ${p.name}` });
        const demo = get<{ n: number }>(ctx.db, "SELECT COUNT(*) n FROM transactions WHERE source = 'demo'")!.n;
        if (demo) findings.push({ severity: 'baja', message: `${demo} transacción(es) de DEMOSTRACIÓN (excluidas de métricas reales).` });
        return { findings, ok: !findings.some((f) => f.severity === 'alta') };
      },
    },
    'qa.block_task': {
      description: 'Bloquear (cancelar) una tarea que representa riesgo',
      risk: 'internal_low',
      idempotent: true,
      run(ctx) {
        const taskId = text(ctx.input.taskId, 'taskId', 100);
        const reason = text(ctx.input.reason, 'reason', 500);
        const t = get<{ status: string }>(ctx.db, 'SELECT status FROM tasks WHERE id = ?', taskId);
        if (!t) throw new TaskError('tarea no encontrada');
        if (!['PENDING', 'QUEUED', 'WAITING_APPROVAL'].includes(t.status)) throw new TaskError(`no se puede bloquear una tarea en estado ${t.status}`);
        run(ctx.db, "UPDATE tasks SET status = 'CANCELLED', finished_at = ?, error = ? WHERE id = ?", ctx.now().toISOString(), `Bloqueada por QA: ${reason}`, taskId);
        run(ctx.db, 'INSERT INTO task_events (task_id, from_status, to_status, message, actor, created_at) VALUES (?, ?, ?, ?, ?, ?)', taskId, t.status, 'CANCELLED', `Bloqueada por QA: ${reason}`, 'agent:qa_security', ctx.now().toISOString());
        return { blocked: taskId };
      },
    },
  },
};

export const AGENTS: AgentDefinition[] = [ceo, marketResearch, productCreation, softwareEngineering, seo, marketing, sales, support, financial, qaSecurity];

export function publicAgentInfo(a: AgentDefinition) {
  return {
    id: a.id,
    name: a.name,
    objective: a.objective,
    instructions: a.instructions,
    tools: a.tools,
    forbidden: a.forbidden,
    limits: a.limits,
    tasks: Object.entries(a.handlers).map(([type, h]) => ({ type, description: h.description, risk: h.risk, idempotent: h.idempotent })),
  };
}
