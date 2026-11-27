import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { writeFileSync } from "node:fs";
import { calculateQuote, lineAmount, nextFolio, parseMoneyToCents, priceForMargin, priceForMarkup, type QuoteLine } from "@/lib/quote/engine";
import { amountInWords, integerToWords } from "@/lib/quote/words";
import { buildQuotePdf } from "@/lib/quote/pdf";
import { quoteSchema, stripInternal, type Quote } from "@/lib/quote/document";

const L = (id: string, quantity: number, price: number, cost?: number): QuoteLine => ({
  id, description: `Concepto ${id}`, unit: "pza", quantity, unitPriceCents: price, unitCostCents: cost,
});
const noTax = { ivaRateBp: null, pricesIncludeIva: false, isrRetentionBp: 0, ivaRetentionBp: 0 };
const iva16 = { ivaRateBp: 1600, pricesIncludeIva: false, isrRetentionBp: 0, ivaRetentionBp: 0 };

describe("motor de cotizaciones", () => {
  it("calcula subtotal, IVA 16 % y total", () => {
    const t = calculateQuote([L("a", 2, 50000), L("b", 1, 25050)], iva16);
    expect(t.subtotalCents).toBe(125050);
    expect(t.ivaCents).toBe(20008); // 1250.50 × 0.16 = 200.08
    expect(t.totalCents).toBe(145058);
  });

  it("cantidades decimales y redondeo comercial", () => {
    expect(lineAmount(2.5, 33333)).toBe(83333); // 833.325 → 833.33
    expect(lineAmount(0.001, 100)).toBe(0);
    expect(lineAmount(1.333, 300)).toBe(400); // 399.9 → 400
  });

  it("descuento porcentual y fijo antes de impuestos", () => {
    const p = calculateQuote([L("a", 1, 100000)], iva16, { type: "percent", value: 1000 });
    expect(p.discountCents).toBe(10000);
    expect(p.baseCents).toBe(90000);
    expect(p.totalCents).toBe(104400);
    const f = calculateQuote([L("a", 1, 100000)], iva16, { type: "amount", value: 999999 });
    expect(f.discountCents).toBe(100000); // nunca mayor al subtotal
    expect(f.totalCents).toBe(0);
  });

  it("precios con IVA incluido no cobran IVA dos veces", () => {
    const t = calculateQuote([L("a", 1, 116000)], { ...iva16, pricesIncludeIva: true });
    expect(t.baseCents).toBe(100000);
    expect(t.ivaCents).toBe(16000);
    expect(t.totalCents).toBe(116000);
  });

  it("retenciones de honorarios: ISR 10 % e IVA 2/3", () => {
    const t = calculateQuote([L("a", 1, 1000000)], { ivaRateBp: 1600, pricesIncludeIva: false, isrRetentionBp: 1000, ivaRetentionBp: 1067 });
    expect(t.ivaCents).toBe(160000);
    expect(t.isrRetentionCents).toBe(100000);
    expect(t.ivaRetentionCents).toBe(106700);
    expect(t.totalCents).toBe(1000000 + 160000 - 100000 - 106700);
  });

  it("la retención de IVA nunca excede el IVA trasladado", () => {
    const t = calculateQuote([L("a", 1, 10000)], { ivaRateBp: 0, pricesIncludeIva: false, isrRetentionBp: 0, ivaRetentionBp: 1067 });
    expect(t.ivaRetentionCents).toBe(0);
  });

  it("margen y recargo con costos internos", () => {
    const t = calculateQuote([L("a", 10, 15000, 10000)], noTax);
    expect(t.costCents).toBe(100000);
    expect(t.profitCents).toBe(50000);
    expect(t.marginBp).toBe(3333);
    expect(t.markupBp).toBe(5000);
    expect(calculateQuote([L("a", 1, 100)], noTax).marginBp).toBeNull();
  });

  it("precio por margen o por recargo", () => {
    expect(priceForMargin(10000, 3000)).toBe(14286);
    expect(priceForMarkup(10000, 3000)).toBe(13000);
    expect(() => priceForMargin(100, 10000)).toThrow();
  });

  it("interpreta importes escritos por personas", () => {
    expect(parseMoneyToCents("1,234.50")).toBe(123450);
    expect(parseMoneyToCents("$ 99")).toBe(9900);
    expect(parseMoneyToCents("12,5")).toBe(1250);
    expect(parseMoneyToCents("abc")).toBeNull();
    expect(parseMoneyToCents("1.234")).toBeNull();
  });

  it("folios consecutivos", () => {
    expect(nextFolio(null)).toBe("COT-0001");
    expect(nextFolio("COT-0099")).toBe("COT-0100");
  });
});

describe("importe con letra", () => {
  it.each([
    [0, "CERO PESOS 00/100 M.N."],
    [100, "UN PESO 00/100 M.N."],
    [2150, "VEINTIÚN PESOS 50/100 M.N."],
    [10000, "CIEN PESOS 00/100 M.N."],
    [150050, "MIL QUINIENTOS PESOS 50/100 M.N."],
    [2100000, "VEINTIÚN MIL PESOS 00/100 M.N."],
    [100000000, "UN MILLÓN DE PESOS 00/100 M.N."],
    [123456789, "UN MILLÓN DOSCIENTOS TREINTA Y CUATRO MIL QUINIENTOS SESENTA Y SIETE PESOS 89/100 M.N."],
  ])("%i centavos", (cents, words) => {
    expect(amountInWords(cents)).toBe(words);
  });
  it("cientos y miles", () => {
    expect(integerToWords(101)).toBe("CIENTO UNO");
    expect(integerToWords(500)).toBe("QUINIENTOS");
    expect(integerToWords(31000)).toBe("TREINTA Y UN MIL");
  });
});

export function sampleQuote(lines = 3): Quote {
  return quoteSchema.parse({
    id: "q1", folio: "COT-0007", status: "borrador", issuedOn: "2026-11-27", validDays: 15,
    client: { id: "c1", name: "Ferretería Juárez", company: "Juárez e Hijos S.A. de C.V.", email: "compras@ejemplo.mx", rfc: "JHI010101AB1" },
    lines: Array.from({ length: lines }, (_, i) => ({
      id: `l${i}`, description: i === 0 ? "Instalación eléctrica completa con cableado calibre 12, apagadores, contactos y pruebas de carga 🔌" : `Material ${i} – ñandú «especial»`,
      unit: "servicio", quantity: i + 1, unitPriceCents: 150000 + i * 1000, unitCostCents: 90000,
    })),
    tax: { ivaRateBp: 1600, pricesIncludeIva: false, isrRetentionBp: 1000, ivaRetentionBp: 1067 },
    discount: { type: "percent", value: 500 },
    notes: "Incluye garantía de 6 meses.", terms: "50 % de anticipo, 50 % al terminar.",
    createdAt: "2026-11-27T10:00:00.000Z", updatedAt: "2026-11-27T10:00:00.000Z",
  });
}

describe("PDF", () => {
  const business = { name: "Electricidad Méndez", owner: "José Méndez", phone: "998 000 0000", email: "jose@ejemplo.mx", accentColor: "#0f766e" };

  it("genera un PDF válido, con metadatos y con caracteres no codificables reemplazados", async () => {
    const bytes = await buildQuotePdf(sampleQuote(), business, { pro: false });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe("Cotización COT-0007 - Electricidad Méndez");
    writeFileSync(`${process.env.TMPDIR ?? "/tmp"}/cotizafacil-test.pdf`, bytes);
  });

  it("pagina automáticamente cotizaciones largas", async () => {
    const doc = await PDFDocument.load(await buildQuotePdf(sampleQuote(60), business, { pro: true }));
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });

  it("el enlace compartido no expone costos internos", () => {
    const snap = stripInternal({ ...business, logoDataUrl: undefined }, sampleQuote());
    expect(JSON.stringify(snap)).not.toContain("unitCostCents");
  });
});
