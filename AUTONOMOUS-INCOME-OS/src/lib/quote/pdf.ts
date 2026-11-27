// Generación del PDF de la cotización con pdf-lib. Corre en el navegador (sin servidor)
// y también en Node (pruebas). Tamaño carta, que es el más usado en México.

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, type RGB } from "pdf-lib";
import { addDays, formatDateMx, type BusinessProfile, type Quote } from "./document";
import { calculateQuote, formatMXN, formatPercent } from "./engine";
import { amountInWords } from "./words";

export interface PdfOptions {
  /** Pro: logo, color propio y sin pie de marca. */
  pro: boolean;
  brandFooter?: string;
}

const PAGE = { w: 612, h: 792, margin: 48 };
const GRAY = rgb(0.38, 0.4, 0.45);
const DARK = rgb(0.07, 0.09, 0.15);
const LIGHT = rgb(0.95, 0.96, 0.97);
const DEFAULT_ACCENT = "#1d4ed8";

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Las fuentes estándar usan WinAnsi: se reemplaza lo que no se puede codificar (emojis, etc.). */
function makeSanitizer(font: PDFFont) {
  const cache = new Map<string, boolean>();
  return (text: string) =>
    Array.from(text.normalize("NFC").replace(/[\r\t]/g, " "))
      .map((ch) => {
        if (ch === "\n") return ch;
        let ok = cache.get(ch);
        if (ok === undefined) {
          try {
            font.encodeText(ch);
            ok = true;
          } catch {
            ok = false;
          }
          cache.set(ch, ok);
        }
        return ok ? ch : "?";
      })
      .join("");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) out.push(line);
      // Palabra más larga que el ancho: se corta.
      let w = word;
      while (font.widthOfTextAtSize(w, size) > maxWidth && w.length > 1) {
        let cut = w.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > maxWidth) cut--;
        out.push(w.slice(0, cut));
        w = w.slice(cut);
      }
      line = w;
    }
    out.push(line);
  }
  return out;
}

function formatQty(q: number): string {
  return q.toLocaleString("es-MX", { maximumFractionDigits: 3 });
}

export async function buildQuotePdf(quote: Quote, business: BusinessProfile, opts: PdfOptions): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Cotización ${quote.folio} - ${business.name}`);
  pdf.setAuthor(business.name);
  pdf.setSubject(`Cotización para ${quote.client.name}`);
  pdf.setCreator("CotizaFácil MX");
  pdf.setProducer("CotizaFácil MX");
  pdf.setCreationDate(new Date(quote.updatedAt));

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const clean = makeSanitizer(font);
  const accent = hexToRgb(opts.pro && business.accentColor ? business.accentColor : DEFAULT_ACCENT);
  const totals = calculateQuote(quote.lines, quote.tax, quote.discount);
  const contentW = PAGE.w - PAGE.margin * 2;

  let page: PDFPage = pdf.addPage([PAGE.w, PAGE.h]);
  let y = PAGE.h - PAGE.margin;

  const text = (s: string, x: number, yy: number, size = 10, f: PDFFont = font, color: RGB = DARK) =>
    page.drawText(clean(s), { x, y: yy, size, font: f, color });
  const textRight = (s: string, right: number, yy: number, size = 10, f: PDFFont = font, color: RGB = DARK) => {
    const c = clean(s);
    page.drawText(c, { x: right - f.widthOfTextAtSize(c, size), y: yy, size, font: f, color });
  };
  const newPage = () => {
    page = pdf.addPage([PAGE.w, PAGE.h]);
    y = PAGE.h - PAGE.margin;
    text(`${business.name} · Cotización ${quote.folio} (continuación)`, PAGE.margin, y, 9, font, GRAY);
    y -= 24;
  };
  const ensure = (needed: number) => {
    if (y - needed < PAGE.margin + 30) newPage();
  };

  // ── Encabezado ──
  page.drawRectangle({ x: 0, y: PAGE.h - 6, width: PAGE.w, height: 6, color: accent });
  let headerX = PAGE.margin;
  if (opts.pro && business.logoDataUrl) {
    try {
      const bytes = Uint8Array.from(atob(business.logoDataUrl.split(",")[1] ?? ""), (c) => c.charCodeAt(0));
      const img = business.logoDataUrl.startsWith("data:image/png") ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      const scale = Math.min(110 / img.width, 54 / img.height, 1);
      page.drawImage(img, { x: PAGE.margin, y: y - img.height * scale + 8, width: img.width * scale, height: img.height * scale });
      headerX = PAGE.margin + img.width * scale + 12;
    } catch {
      // Un logo dañado no debe impedir generar la cotización.
    }
  }
  text(business.name, headerX, y - 6, 15, bold);
  const bizLines = [business.owner, business.rfc ? `RFC: ${business.rfc}` : undefined, business.address,
    [business.phone, business.email].filter(Boolean).join(" · "), business.website].filter((l): l is string => !!l);
  let by = y - 22;
  for (const l of bizLines) {
    for (const w of wrap(clean(l), font, 8.5, 280)) {
      text(w, headerX, by, 8.5, font, GRAY);
      by -= 11;
    }
  }
  const right = PAGE.w - PAGE.margin;
  textRight("COTIZACIÓN", right, y - 6, 16, bold, accent);
  textRight(`Folio: ${quote.folio}`, right, y - 24, 10, bold);
  textRight(`Fecha: ${formatDateMx(quote.issuedOn)}`, right, y - 38, 9);
  textRight(`Vigencia: hasta el ${formatDateMx(addDays(quote.issuedOn, quote.validDays))}`, right, y - 51, 9);
  y = Math.min(by, y - 62) - 14;

  // ── Cliente ──
  const clientLines = [quote.client.company, quote.client.rfc ? `RFC: ${quote.client.rfc}` : undefined, quote.client.address,
    [quote.client.phone, quote.client.email].filter(Boolean).join(" · ")].filter((l): l is string => !!l);
  const boxH = 30 + clientLines.length * 11;
  page.drawRectangle({ x: PAGE.margin, y: y - boxH, width: contentW, height: boxH, color: LIGHT });
  text("PARA", PAGE.margin + 10, y - 14, 8, bold, GRAY);
  text(quote.client.name, PAGE.margin + 10, y - 27, 11, bold);
  let cy = y - 40;
  for (const l of clientLines) {
    text(l.slice(0, 110), PAGE.margin + 10, cy, 9, font, GRAY);
    cy -= 11;
  }
  y -= boxH + 18;

  // ── Tabla de conceptos ──
  const col = { desc: PAGE.margin + 6, qty: PAGE.margin + 318, unit: PAGE.margin + 330, price: PAGE.margin + 440, total: right - 6 };
  const header = () => {
    page.drawRectangle({ x: PAGE.margin, y: y - 18, width: contentW, height: 18, color: accent });
    const white = rgb(1, 1, 1);
    text("Concepto", col.desc, y - 12.5, 9, bold, white);
    textRight("Cant.", col.qty, y - 12.5, 9, bold, white);
    text("Unidad", col.unit, y - 12.5, 9, bold, white);
    textRight("Precio unit.", col.price, y - 12.5, 9, bold, white);
    textRight("Importe", col.total, y - 12.5, 9, bold, white);
    y -= 32;
  };
  header();
  quote.lines.forEach((line, i) => {
    const descLines = wrap(clean(line.description), font, 9.5, 300);
    const h = descLines.length * 12 + 6;
    if (y - h < PAGE.margin + 30) {
      newPage();
      header();
    }
    if (i % 2 === 1) page.drawRectangle({ x: PAGE.margin, y: y - h + 9, width: contentW, height: h, color: LIGHT });
    descLines.forEach((d, j) => text(d, col.desc, y - j * 12, 9.5));
    textRight(formatQty(line.quantity), col.qty, y, 9.5);
    text(clean(line.unit ?? "").slice(0, 14), col.unit, y, 9.5);
    textRight(formatMXN(line.unitPriceCents), col.price, y, 9.5);
    textRight(formatMXN(totals.lines[i]!.totalCents), col.total, y, 9.5, bold);
    y -= h;
  });

  // ── Totales ──
  const rows: [string, string, boolean?][] = [["Subtotal", formatMXN(totals.subtotalCents)]];
  if (totals.discountCents > 0) {
    const label = quote.discount.type === "percent" ? `Descuento (${formatPercent(quote.discount.value)})` : "Descuento";
    rows.push([label, `-${formatMXN(totals.discountCents)}`]);
  }
  if (quote.tax.pricesIncludeIva && (quote.tax.ivaRateBp ?? 0) > 0) rows.push(["Base sin IVA", formatMXN(totals.baseCents)]);
  rows.push([quote.tax.ivaRateBp === null ? "IVA (exento)" : `IVA ${formatPercent(quote.tax.ivaRateBp)}`, formatMXN(totals.ivaCents)]);
  if (totals.isrRetentionCents > 0) rows.push([`Retención ISR ${formatPercent(quote.tax.isrRetentionBp)}`, `-${formatMXN(totals.isrRetentionCents)}`]);
  if (totals.ivaRetentionCents > 0) rows.push(["Retención IVA", `-${formatMXN(totals.ivaRetentionCents)}`]);
  rows.push(["TOTAL", formatMXN(totals.totalCents), true]);

  ensure(rows.length * 16 + 40);
  y -= 6;
  page.drawLine({ start: { x: right - 220, y: y + 8 }, end: { x: right, y: y + 8 }, thickness: 0.8, color: GRAY });
  for (const [label, value, strong] of rows) {
    if (strong) {
      y -= 8;
      page.drawRectangle({ x: right - 220, y: y - 6, width: 220, height: 20, color: accent });
      text(label, right - 212, y, 11, bold, rgb(1, 1, 1));
      textRight(value, right - 8, y, 11, bold, rgb(1, 1, 1));
      y -= 24;
    } else {
      text(label, right - 212, y, 9.5, font, GRAY);
      textRight(value, right - 8, y, 9.5);
      y -= 15;
    }
  }
  for (const w of wrap(`Importe con letra: ${amountInWords(totals.totalCents)}`, font, 8.5, contentW)) {
    ensure(12);
    text(w, PAGE.margin, y, 8.5, font, GRAY);
    y -= 11;
  }
  y -= 8;

  // ── Notas y condiciones ──
  for (const [title, body] of [["Notas", quote.notes], ["Condiciones", quote.terms]] as const) {
    if (!body) continue;
    ensure(30);
    text(title, PAGE.margin, y, 10, bold);
    y -= 13;
    for (const w of wrap(clean(body), font, 9, contentW)) {
      ensure(12);
      text(w, PAGE.margin, y, 9, font, GRAY);
      y -= 11.5;
    }
    y -= 8;
  }

  // ── Pie de página en todas las hojas ──
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const footer = opts.pro ? "" : clean(opts.brandFooter ?? "Hecho gratis con CotizaFácil MX");
    const pageLabel = `Página ${i + 1} de ${pages.length}`;
    p.drawText(pageLabel, { x: right - font.widthOfTextAtSize(pageLabel, 8), y: 26, size: 8, font, color: GRAY });
    if (footer) p.drawText(footer, { x: PAGE.margin, y: 26, size: 8, font, color: GRAY });
    p.drawText("Este documento es una cotización, no un comprobante fiscal (CFDI).", { x: PAGE.margin, y: 15, size: 7, font, color: GRAY });
  });

  return pdf.save();
}
