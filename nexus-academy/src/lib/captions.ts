/** Tamaño máximo del archivo de subtítulos (la base de datos aplica el mismo límite). */
export const CAPTIONS_MAX_CHARS = 500_000;
export const CAPTION_LANGS = { es: "Español", en: "English", pt: "Português" } as const;
export type CaptionLang = keyof typeof CAPTION_LANGS;

const SRT_TIME = /^(\d{1,2}:\d{2}:\d{2})[,.](\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2})[,.](\d{3})(.*)$/;
const VTT_TIME = /^(?:\d{1,2}:)?\d{2}:\d{2}\.\d{3}\s+-->\s+(?:\d{1,2}:)?\d{2}:\d{2}\.\d{3}/;

/**
 * Acepta WebVTT o SubRip (.srt) y devuelve WebVTT válido. Quita el BOM, unifica
 * saltos de línea y caracteres nulos. Devuelve un error legible si el archivo no
 * tiene ningún subtítulo reconocible.
 */
export function normalizeCaptions(raw: string): { vtt: string; cues: number } | { error: string } {
  const text = raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n").replace(/\u0000/g, "").trim();
  if (!text) return { error: "El archivo está vacío." };
  if (text.length > CAPTIONS_MAX_CHARS) return { error: "El archivo de subtítulos es demasiado grande (máximo 500 KB)." };

  if (/^WEBVTT(?:[ \t][^\n]*)?(?:\n|$)/.test(text)) {
    const cues = text.split("\n").filter((l) => VTT_TIME.test(l.trim())).length;
    if (cues === 0) return { error: "El archivo WebVTT no contiene ningún subtítulo con tiempos." };
    return { vtt: `${text}\n`, cues };
  }

  // SubRip: «1⏎00:00:01,000 --> 00:00:04,000⏎texto». Se convierte línea a línea.
  let cues = 0;
  const lines = text.split("\n").map((line) => {
    const m = line.trim().match(SRT_TIME);
    if (!m) return line;
    cues++;
    const pad = (t: string) => (t.length === 7 ? `0${t}` : t);
    return `${pad(m[1])}.${m[2]} --> ${pad(m[3])}.${m[4]}${m[5]}`;
  });
  if (cues === 0) return { error: "No es un archivo de subtítulos válido. Sube un .vtt o .srt." };
  return { vtt: `WEBVTT\n\n${lines.join("\n")}\n`, cues };
}
