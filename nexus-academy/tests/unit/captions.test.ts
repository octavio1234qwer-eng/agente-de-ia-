import { describe, expect, it } from "vitest";
import { normalizeCaptions } from "@/lib/captions";

describe("normalizeCaptions", () => {
  it("convierte SubRip (.srt) a WebVTT", () => {
    const srt = "﻿1\r\n00:00:01,000 --> 00:00:04,250\r\nHola, bienvenidos\r\n\r\n2\r\n0:00:05,000 --> 0:00:07,500\r\nHoy vemos ramas\r\n";
    const r = normalizeCaptions(srt);
    expect(r).toEqual({
      vtt: "WEBVTT\n\n1\n00:00:01.000 --> 00:00:04.250\nHola, bienvenidos\n\n2\n00:00:05.000 --> 00:00:07.500\nHoy vemos ramas\n",
      cues: 2,
    });
  });

  it("acepta WebVTT tal cual y cuenta sus subtítulos", () => {
    const vtt = "WEBVTT - curso\n\n00:01.000 --> 00:04.000 align:start\nUno\n\n00:00:05.000 --> 00:00:06.000\nDos";
    const r = normalizeCaptions(vtt);
    expect("vtt" in r && r.cues).toBe(2);
    expect("vtt" in r && r.vtt.startsWith("WEBVTT - curso")).toBe(true);
  });

  it("rechaza archivos sin subtítulos, vacíos o demasiado grandes", () => {
    expect(normalizeCaptions("hola mundo")).toEqual({ error: "No es un archivo de subtítulos válido. Sube un .vtt o .srt." });
    expect(normalizeCaptions("WEBVTT\n\nsin tiempos")).toHaveProperty("error");
    expect(normalizeCaptions("   ")).toEqual({ error: "El archivo está vacío." });
    expect(normalizeCaptions(`WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n${"x".repeat(500_001)}`)).toHaveProperty("error");
  });
});
