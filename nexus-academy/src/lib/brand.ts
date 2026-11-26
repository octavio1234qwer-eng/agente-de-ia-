/**
 * Marca de la academia. Cámbiala con variables de entorno (sin tocar código):
 *   NEXT_PUBLIC_SITE_NAME="Mi Academia"
 *   NEXT_PUBLIC_AI_NAME="Tutor IA"
 *   NEXT_PUBLIC_SITE_TAGLINE="Aprende a tu ritmo."
 * Los colores viven en src/app/globals.css (bloque @theme).
 */
const env = (v: string | undefined, fallback: string) => (v && v.trim() ? v.trim() : fallback);

export const BRAND = {
  name: env(process.env.NEXT_PUBLIC_SITE_NAME, "NEXUS ACADEMY"),
  aiName: env(process.env.NEXT_PUBLIC_AI_NAME, "NEXUS AI"),
  tagline: env(process.env.NEXT_PUBLIC_SITE_TAGLINE, "Aprende hoy. Domina el mañana."),
} as const;

/** Divide el nombre para el logotipo: primera palabra destacada y el resto en tono suave. */
export function brandWords(name: string = BRAND.name): [string, string] {
  const i = name.indexOf(" ");
  return i === -1 ? [name, ""] : [name.slice(0, i), name.slice(i + 1)];
}
