import { getPublicCertificate } from "@/lib/data/certificates";
import { renderCertificatePdf } from "@/lib/certificates/pdf";
import { siteUrl } from "@/lib/env";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const cert = await getPublicCertificate(code);
  if (!cert || cert.revoked_at) return new Response("Certificado no encontrado", { status: 404 });
  const pdf = await renderCertificatePdf({
    code: cert.code,
    studentName: cert.student_name,
    courseTitle: cert.course_title,
    instructorName: cert.instructor_name,
    completedAt: cert.completed_at,
    verifyUrl: `${siteUrl}/certificados/${cert.code}`,
  });
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="certificado-${cert.code}.pdf"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
