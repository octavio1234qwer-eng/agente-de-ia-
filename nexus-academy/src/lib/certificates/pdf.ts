import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { BRAND } from "@/lib/brand";

export type CertificateData = {
  code: string;
  studentName: string;
  courseTitle: string;
  instructorName: string | null;
  completedAt: string;
  verifyUrl: string;
};

/** Las fuentes estándar de PDF usan WinAnsi: sustituye lo que no se pueda codificar. */
function safe(text: string) {
  return text
    .normalize("NFC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D«»]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "");
}

function centered(page: PDFPage, text: string, font: PDFFont, size: number, y: number, color = rgb(1, 1, 1)) {
  const t = safe(text);
  const width = font.widthOfTextAtSize(t, size);
  page.drawText(t, { x: (page.getWidth() - width) / 2, y, size, font, color });
}

function fitSize(font: PDFFont, text: string, maxWidth: number, start: number, min: number) {
  let size = start;
  while (size > min && font.widthOfTextAtSize(safe(text), size) > maxWidth) size -= 1;
  return size;
}

export async function renderCertificatePdf(data: CertificateData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Certificado ${data.code} · ${BRAND.name}`);
  pdf.setAuthor(BRAND.name);
  pdf.setSubject(safe(data.courseTitle));
  const page = pdf.addPage([842, 595]); // A4 horizontal
  const W = page.getWidth();
  const H = page.getHeight();

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Fondo y marco
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(0.02, 0.024, 0.047) });
  page.drawRectangle({ x: 24, y: 24, width: W - 48, height: H - 48, borderColor: rgb(0.16, 0.19, 0.33), borderWidth: 1 });
  page.drawRectangle({ x: 24, y: H - 28, width: (W - 48) / 2, height: 4, color: rgb(0.23, 0.51, 0.96) });
  page.drawRectangle({ x: W / 2, y: H - 28, width: (W - 48) / 2, height: 4, color: rgb(0.55, 0.36, 0.96) });
  page.drawCircle({ x: W - 80, y: H - 90, size: 120, color: rgb(0.23, 0.51, 0.96), opacity: 0.06 });
  page.drawCircle({ x: 90, y: 70, size: 140, color: rgb(0.55, 0.36, 0.96), opacity: 0.06 });

  centered(page, "N E X U S   A C A D E M Y", bold, 13, H - 80, rgb(0.6, 0.7, 1));
  centered(page, "CERTIFICADO DE FINALIZACIÓN", bold, 26, H - 130);
  centered(page, "Se otorga el presente certificado a", regular, 13, H - 175, rgb(0.72, 0.75, 0.86));

  const nameSize = fitSize(bold, data.studentName, W - 160, 38, 20);
  centered(page, data.studentName, bold, nameSize, H - 230);
  page.drawRectangle({ x: W / 2 - 160, y: H - 245, width: 320, height: 1, color: rgb(0.3, 0.35, 0.55) });

  centered(page, "por completar satisfactoriamente el curso", regular, 13, H - 280, rgb(0.72, 0.75, 0.86));
  const courseSize = fitSize(bold, data.courseTitle, W - 160, 22, 12);
  centered(page, data.courseTitle, bold, courseSize, H - 315, rgb(0.85, 0.88, 1));

  const date = new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: "America/Mexico_City" }).format(new Date(data.completedAt));
  page.drawText(safe(`Fecha de finalización: ${date}`), { x: 70, y: 130, size: 11, font: regular, color: rgb(0.72, 0.75, 0.86) });
  if (data.instructorName) {
    page.drawText(safe(`Impartido por: ${data.instructorName}`), { x: 70, y: 112, size: 11, font: regular, color: rgb(0.72, 0.75, 0.86) });
  }
  page.drawText(safe(`ID de certificado: ${data.code}`), { x: 70, y: 86, size: 11, font: bold, color: rgb(1, 1, 1) });
  page.drawText(safe(`Verificar: ${data.verifyUrl}`), { x: 70, y: 68, size: 9, font: regular, color: rgb(0.55, 0.6, 0.78) });

  const qrPng = await QRCode.toBuffer(data.verifyUrl, {
    type: "png",
    margin: 1,
    width: 220,
    color: { dark: "#05060bff", light: "#ffffffff" },
  });
  const qr = await pdf.embedPng(qrPng);
  page.drawImage(qr, { x: W - 70 - 110, y: 60, width: 110, height: 110 });
  page.drawText("Escanea para verificar", { x: W - 70 - 104, y: 46, size: 8, font: regular, color: rgb(0.55, 0.6, 0.78) });

  return pdf.save();
}
