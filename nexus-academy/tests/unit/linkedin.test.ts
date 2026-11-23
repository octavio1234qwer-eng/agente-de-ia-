import { describe, expect, it } from "vitest";
import { linkedInAddToProfileUrl, linkedInShareUrl } from "@/lib/certificates/linkedin";

describe("enlaces de LinkedIn para certificados", () => {
  const certUrl = "https://nexus.example/certificados/NX-ABCDE-FGHJK";

  it("prellena la certificación con datos documentados y codificados", () => {
    const url = new URL(linkedInAddToProfileUrl({ courseTitle: "JavaScript Moderno: de cero a interactivo", issuedAt: "2026-11-20T18:00:00Z", certUrl }));
    expect(url.origin + url.pathname).toBe("https://www.linkedin.com/profile/add");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      startTask: "CERTIFICATION_NAME",
      name: "JavaScript Moderno: de cero a interactivo",
      organizationName: "NEXUS ACADEMY",
      issueYear: "2026",
      issueMonth: "11",
      certUrl,
    });
  });

  it("usa la fecha de la academia (Ciudad de México), no UTC", () => {
    // 1 de diciembre 03:00 UTC = 30 de noviembre 21:00 en CDMX
    const url = new URL(linkedInAddToProfileUrl({ courseTitle: "X", issuedAt: "2026-12-01T03:00:00Z", certUrl }));
    expect(url.searchParams.get("issueMonth")).toBe("11");
  });

  it("comparte la URL de verificación", () => {
    const url = new URL(linkedInShareUrl(certUrl));
    expect(url.origin + url.pathname).toBe("https://www.linkedin.com/sharing/share-offsite/");
    expect(url.searchParams.get("url")).toBe(certUrl);
  });
});
