import { BRAND } from "@/lib/brand";
/**
 * Enlaces oficiales de LinkedIn para certificados (sin API ni credenciales):
 * - «Agregar al perfil»: abre el formulario de Licencias y certificaciones con
 *   los datos prellenados; el alumno revisa y guarda en su propia cuenta.
 * - «Compartir»: abre el diálogo para publicar la URL de verificación.
 * Solo se usan parámetros documentados (name, organizationName, issueYear,
 * issueMonth, certUrl); el ID del certificado va dentro de certUrl.
 */
const ACADEMY = BRAND.name;

/** Año y mes de emisión en la zona horaria de la academia. */
function issueParts(issuedAt: string | Date): { year: string; month: string } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", year: "numeric", month: "numeric" }).formatToParts(new Date(issuedAt));
  return { year: parts.find((p) => p.type === "year")!.value, month: parts.find((p) => p.type === "month")!.value };
}

export function linkedInAddToProfileUrl({ courseTitle, issuedAt, certUrl }: { courseTitle: string; issuedAt: string | Date; certUrl: string }): string {
  const { year, month } = issueParts(issuedAt);
  const params = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: courseTitle,
    organizationName: ACADEMY,
    issueYear: year,
    issueMonth: month,
    certUrl,
  });
  return `https://www.linkedin.com/profile/add?${params}`;
}

export function linkedInShareUrl(certUrl: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({ url: certUrl })}`;
}
