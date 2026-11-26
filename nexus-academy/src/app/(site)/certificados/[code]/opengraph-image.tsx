import { ImageResponse } from "next/og";
import { getPublicCertificate } from "@/lib/data/certificates";
import { formatDate } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

export const alt = `Certificado verificable de ${BRAND.name}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Tarjeta que muestran LinkedIn y otras redes al compartir un certificado. */
export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const cert = await getPublicCertificate(code);
  const valid = cert && !cert.revoked_at;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px", background: "linear-gradient(135deg, #05060b 0%, #0b1230 55%, #1d1147 100%)", color: "#fff", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 28, letterSpacing: 10, color: "#8fb0ff", fontWeight: 600 }}>{BRAND.name}</div>
          {valid && <div style={{ display: "flex", fontSize: 24, color: "#6ee7b7", border: "2px solid rgba(110,231,183,0.5)", borderRadius: 999, padding: "8px 22px" }}>Certificado verificable</div>}
        </div>
        {valid ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 30, color: "#aab3d6" }}>Certificado de finalización otorgado a</div>
            <div style={{ display: "flex", fontSize: 76, fontWeight: 700, marginTop: 12, lineHeight: 1.05 }}>{cert.student_name.slice(0, 60)}</div>
            <div style={{ display: "flex", fontSize: 30, color: "#aab3d6", marginTop: 28 }}>por completar el curso</div>
            <div style={{ display: "flex", fontSize: 44, fontWeight: 600, marginTop: 8, color: "#e6e9ff" }}>{cert.course_title.slice(0, 80)}</div>
          </div>
        ) : (
          <div style={{ display: "flex", fontSize: 56, fontWeight: 700 }}>{cert ? "Certificado revocado" : "Certificado no encontrado"}</div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "#8a93b8" }}>
          <div style={{ display: "flex" }}>{valid ? formatDate(cert.completed_at) : ""}</div>
          <div style={{ display: "flex", fontFamily: "monospace" }}>{cert?.code ?? ""}</div>
        </div>
      </div>
    ),
    size,
  );
}
