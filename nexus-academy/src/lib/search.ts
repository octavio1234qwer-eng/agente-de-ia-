/** Marcadores que usa search_lessons() (ts_headline) para resaltar coincidencias. */
const START = "⟦";
const STOP = "⟧";

export type SnippetPart = { text: string; hit: boolean };

/**
 * Convierte el fragmento que devuelve la base de datos (Markdown con marcadores
 * de coincidencia) en texto plano dividido en partes resaltadas y no
 * resaltadas. No produce HTML: la página lo pinta con <mark> sin
 * dangerouslySetInnerHTML.
 */
export function parseSnippet(raw: string): SnippetPart[] {
  const text = raw
    // Separadores que la base de datos usa para indexar identificadores de código.
    .replace(//g, ".")
    .replace(//g, "/")
    // Markdown → texto plano.
    .replace(/```[\w-]*/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(^|\s)#{1,6}\s+/g, "$1")
    .replace(/(^|\n)\s*>\s?/g, "$1")
    .replace(/\*\*|__|`/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const parts: SnippetPart[] = [];
  let rest = text;
  while (rest.length > 0) {
    const start = rest.indexOf(START);
    if (start === -1) {
      parts.push({ text: rest, hit: false });
      break;
    }
    const stop = rest.indexOf(STOP, start + START.length);
    if (stop === -1) {
      parts.push({ text: rest.replaceAll(START, ""), hit: false });
      break;
    }
    if (start > 0) parts.push({ text: rest.slice(0, start), hit: false });
    const hit = rest.slice(start + START.length, stop);
    if (hit) parts.push({ text: hit, hit: true });
    rest = rest.slice(stop + STOP.length);
  }
  // Une partes contiguas del mismo tipo (p. ej. dos coincidencias seguidas).
  return parts.reduce<SnippetPart[]>((acc, p) => {
    const last = acc.at(-1);
    if (last && last.hit === p.hit) last.text += p.text;
    else acc.push({ ...p });
    return acc;
  }, []);
}

/** Normaliza lo que escribe el alumno: recorta, colapsa espacios y limita la longitud. */
export function normalizeQuery(q: unknown): string {
  return typeof q === "string" ? q.replace(/\s+/g, " ").trim().slice(0, 120) : "";
}

/** Minúsculas y sin acentos (equivale a lower + unaccent de la base de datos). */
export function foldText(s: string): string {
  return s.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase();
}

/**
 * Posiciones [inicio, fin) de las palabras de `text` que empiezan con alguna de
 * las raíces de búsqueda (ya sin acentos y en minúsculas). Las palabras se
 * separan igual que en Postgres: cualquier carácter que no sea letra o número.
 */
export function matchWords(text: string, terms: string[]): Array<[number, number]> {
  const stems = terms.map(foldText).filter((t) => t.length >= 2);
  if (stems.length === 0) return [];
  const out: Array<[number, number]> = [];
  for (const m of text.matchAll(/[\p{L}\p{N}]+/gu)) {
    const word = foldText(m[0]);
    if (stems.some((s) => word.startsWith(s))) out.push([m.index, m.index + m[0].length]);
  }
  return out;
}
