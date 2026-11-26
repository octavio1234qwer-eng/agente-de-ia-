import { describe, expect, it } from "vitest";
import { parseEmailList, summarize } from "@/lib/bulk-enroll";

describe("inscripción masiva", () => {
  it("acepta líneas, comas, punto y coma, tabuladores y «Nombre <correo>»", () => {
    const list = parseEmailList("Ana@Empresa.com\nbeto@empresa.com, carla@empresa.com;dani@empresa.com\tEva Ruiz <eva@empresa.com>\nmailto:fer@empresa.com");
    expect(list).toEqual(["ana@empresa.com", "beto@empresa.com", "carla@empresa.com", "dani@empresa.com", "eva@empresa.com", "fer@empresa.com"]);
  });

  it("quita repetidos (sin importar mayúsculas) y vacíos, conservando el orden", () => {
    expect(parseEmailList("b@x.co\n\nA@x.co\nb@X.co\n  \na@x.co")).toEqual(["b@x.co", "a@x.co"]);
    expect(parseEmailList("")).toEqual([]);
  });

  it("deja pasar texto que no es correo para que la base lo marque como inválido", () => {
    expect(parseEmailList("no-es-correo")).toEqual(["no-es-correo"]);
  });

  it("resume el resultado", () => {
    expect(summarize([
      { email: "a@x.co", status: "enrolled" },
      { email: "b@x.co", status: "invited" },
      { email: "c@x.co", status: "already" },
      { email: "d", status: "invalid" },
    ])).toBe("2 con acceso nuevo · 1 ya tenían acceso · 1 invitados por correo · 1 correos inválidos");
    expect(summarize([{ email: "c@x.co", status: "already" }])).toBe("0 con acceso nuevo · 1 ya tenían acceso");
  });
});
