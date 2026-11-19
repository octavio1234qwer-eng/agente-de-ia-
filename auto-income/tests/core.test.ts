import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  priceFromMarkup, priceFromMargin, marginPct, markupPct, markupToMargin, marginToMarkup,
  profitBreakdown, breakEvenUnits, calculateQuote, quoteToWhatsAppText, whatsAppShareUrl,
  scoreOpportunity, normalizeName, decideAutonomy, type OpportunityScores,
} from '../packages/core/src/index.ts';
import { toCents, formatMoney, roundHalfAwayFromZero, isValidCurrency } from '../packages/shared/src/money.ts';

test('dinero: conversión a centavos sin errores de coma flotante', () => {
  assert.equal(toCents(1.005), 101);
  assert.equal(toCents(0.1 + 0.2), 30);
  assert.equal(toCents(199.99), 19999);
  assert.equal(roundHalfAwayFromZero(-2.5), -3);
  assert.match(formatMoney(123456), /1,234\.56/);
  assert.equal(isValidCurrency('MXN'), true);
  assert.equal(isValidCurrency('mx'), false);
});

test('margen y recargo NO son lo mismo', () => {
  // Costo $100, recargo 50% → $150; margen 50% → $200.
  assert.equal(priceFromMarkup(10000, 50), 15000);
  assert.equal(priceFromMargin(10000, 50), 20000);
  assert.equal(marginPct(15000, 10000)?.toFixed(2), '33.33');
  assert.equal(markupPct(20000, 10000), 100);
  assert.equal(markupToMargin(50).toFixed(2), '33.33');
  assert.equal(marginToMarkup(50), 100);
  assert.throws(() => priceFromMargin(10000, 100), /menor a 100/);
  assert.equal(marginPct(0, 0), null);
  assert.equal(markupPct(500, 0), null);
});

test('calculadora de ganancias y punto de equilibrio', () => {
  const r = profitBreakdown(25000, 18000, 4);
  assert.equal(r.revenueCents, 100000);
  assert.equal(r.totalCostCents, 72000);
  assert.equal(r.profitCents, 28000);
  assert.equal(r.marginPct, 28);
  assert.equal(breakEvenUnits(500000, 25000, 18000), 72); // 5000 / 70 = 71.4 → 72
  assert.equal(breakEvenUnits(500000, 18000, 18000), null);
});

test('cotización con descuentos e IVA 16% sobre precios sin IVA', () => {
  const q = calculateQuote({
    lines: [
      { description: 'Lona impresa', quantity: 3, unitPriceCents: 45000, unitCostCents: 20000, discountPct: 10 },
      { description: 'Instalación', quantity: 1, unitPriceCents: 80000 },
    ],
    globalDiscountPct: 5,
    taxRatePct: 16,
  });
  // 3×450 = 1350 − 10% = 1215; + 800 = 2015; −5% = 100.75 → 1914.25; IVA 306.28; total 2220.53
  assert.equal(q.subtotalCents, 201500);
  assert.equal(q.globalDiscountCents, 10075);
  assert.equal(q.taxableBaseCents, 191425);
  assert.equal(q.taxCents, 30628);
  assert.equal(q.totalCents, 222053);
  assert.equal(q.currency, 'MXN');
  assert.equal(q.knownCostCents, 60000);
  assert.ok(q.estimatedProfitCents !== null && q.estimatedProfitCents > 0);
});

test('cotización con precios que ya incluyen IVA', () => {
  const q = calculateQuote({ lines: [{ description: 'Servicio', quantity: 1, unitPriceCents: 116000 }], pricesIncludeTax: true });
  assert.equal(q.taxableBaseCents, 100000);
  assert.equal(q.taxCents, 16000);
  assert.equal(q.totalCents, 116000);
  assert.equal(q.estimatedProfitCents, null);
});

test('cotización rechaza entradas inválidas', () => {
  assert.throws(() => calculateQuote({ lines: [] }));
  assert.throws(() => calculateQuote({ lines: [{ description: 'x', quantity: 0, unitPriceCents: 1 }] }));
  assert.throws(() => calculateQuote({ lines: [{ description: 'x', quantity: 1, unitPriceCents: 1.5 }] }));
  assert.throws(() => calculateQuote({ lines: [{ description: 'x', quantity: 1, unitPriceCents: 100, discountPct: 120 }] }));
});

test('texto y enlace de WhatsApp', () => {
  const totals = calculateQuote({ lines: [{ description: 'Pastel', quantity: 2, unitPriceCents: 35000 }], taxRatePct: 0 });
  const text = quoteToWhatsAppText({ businessName: 'Pastelería Sol', quoteNumber: 'COT-0001', totals, format: (c) => formatMoney(c) });
  assert.match(text, /COT-0001/);
  assert.match(text, /Total: \$700\.00/);
  assert.doesNotMatch(text, /IVA/);
  const url = whatsAppShareUrl(text, '+52 998 123 4567');
  assert.ok(url.startsWith('https://wa.me/529981234567?text='));
});

test('Business Factory: puntuación y confianza según evidencia', () => {
  const base = (value: number, evidence: 'verified' | 'estimate' | 'hypothesis' = 'estimate') => ({ value, evidence, source: evidence === 'verified' ? 'entrevistas' : undefined });
  const good: OpportunityScores = {
    demand: base(5, 'verified'), competition: base(2, 'verified'), devCost: base(1, 'verified'), opCost: base(1),
    monetization: base(4), complexity: base(2), risk: base(2), timeToValidate: base(1),
  };
  const r = scoreOpportunity(good);
  assert.ok(r.score >= 65, `score ${r.score}`);
  assert.equal(r.recommendation, 'validar');
  assert.equal(r.confidence, 'alta');

  const allHyp = Object.fromEntries(Object.keys(good).map((k) => [k, base(5, 'hypothesis')])) as OpportunityScores;
  // demand 5 hipótesis… pero negativos en 5 son malos
  const r2 = scoreOpportunity({ ...allHyp, competition: base(1, 'hypothesis'), devCost: base(1, 'hypothesis'), opCost: base(1, 'hypothesis'), complexity: base(1, 'hypothesis'), risk: base(1, 'hypothesis'), timeToValidate: base(1, 'hypothesis') });
  assert.equal(r2.score, 100);
  assert.equal(r2.confidence, 'baja');
  assert.equal(r2.recommendation, 'investigar_mas', 'no recomendar validar con solo hipótesis');

  const noSource = scoreOpportunity({ ...good, demand: { value: 5, evidence: 'verified' } });
  assert.ok(noSource.warnings.some((w) => w.includes('sin fuente')));
  assert.equal(normalizeName('  CotizaFácil MX! '), 'cotizafacil mx');
});

test('autonomía: dinero y comunicaciones externas siempre requieren aprobación', () => {
  for (const level of [0, 1, 2, 3, 4] as const) {
    assert.equal(decideAutonomy(level, 'financial'), 'require_approval');
    assert.equal(decideAutonomy(level, 'external_communication'), 'require_approval');
    assert.equal(decideAutonomy(level, 'sensitive_data'), 'require_approval');
    assert.equal(decideAutonomy(level, 'irreversible'), 'require_approval');
  }
  assert.equal(decideAutonomy(0, 'internal_low'), 'require_approval');
  assert.equal(decideAutonomy(1, 'internal_low'), 'require_approval');
  assert.equal(decideAutonomy(2, 'internal_low'), 'execute');
  assert.equal(decideAutonomy(2, 'publish_approved'), 'require_approval');
  assert.equal(decideAutonomy(3, 'publish_approved'), 'execute');
  assert.equal(decideAutonomy(3, 'internal_optimization'), 'require_approval');
  assert.equal(decideAutonomy(4, 'internal_optimization'), 'execute');
});
