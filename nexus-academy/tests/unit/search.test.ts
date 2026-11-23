import { describe, expect, it } from "vitest";
import { normalizeQuery, parseSnippet } from "@/lib/search";

describe("parseSnippet", () => {
  it("separa las coincidencias resaltadas del resto del texto", () => {
    expect(parseSnippet("Usa ⟦promesas⟧ para código ⟦asíncrono⟧.")).toEqual([
      { text: "Usa ", hit: false },
      { text: "promesas", hit: true },
      { text: " para código ", hit: false },
      { text: "asíncrono", hit: true },
      { text: ".", hit: false },
    ]);
  });

  it("quita la sintaxis de Markdown y restaura los separadores de código", () => {
    const parts = parseSnippet("## Seleccionar ```js const boton = documentquerySelector(\"#x\"); boton⟦addEventListener⟧ fetch(\"apicursos\") **importante** [docs](https://x.dev)");
    const text = parts.map((p) => p.text).join("");
    expect(text).toBe('Seleccionar const boton = document.querySelector("#x"); boton.addEventListener fetch("/api/cursos") importante docs');
    expect(parts.filter((p) => p.hit).map((p) => p.text)).toEqual(["addEventListener"]);
  });

  it("une coincidencias contiguas y tolera marcadores sin cerrar", () => {
    expect(parseSnippet("⟦git⟧⟦hub⟧ y ⟦ramas")).toEqual([
      { text: "github", hit: true },
      { text: " y ramas", hit: false },
    ]);
  });

  it("nunca produce HTML: el texto con etiquetas se conserva como texto", () => {
    const parts = parseSnippet("<script>alert(1)</script> ⟦hola⟧");
    expect(parts[0]).toEqual({ text: "<script>alert(1)</script> ", hit: false });
  });
});

describe("normalizeQuery", () => {
  it("recorta, colapsa espacios y limita a 120 caracteres", () => {
    expect(normalizeQuery("  async   await  ")).toBe("async await");
    expect(normalizeQuery("x".repeat(300))).toHaveLength(120);
    expect(normalizeQuery(undefined)).toBe("");
    expect(normalizeQuery(["a"])).toBe("");
  });
});
