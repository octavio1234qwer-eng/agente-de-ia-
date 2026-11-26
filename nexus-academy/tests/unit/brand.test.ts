import { describe, expect, it } from "vitest";
import { BRAND, brandWords } from "@/lib/brand";

describe("marca", () => {
  it("valores por omisión", () => {
    expect(BRAND.name).toBe("NEXUS ACADEMY");
    expect(BRAND.aiName).toBe("NEXUS AI");
    expect(BRAND.tagline).toBe("Aprende hoy. Domina el mañana.");
  });
  it("divide el nombre para el logotipo", () => {
    expect(brandWords("NEXUS ACADEMY")).toEqual(["NEXUS", "ACADEMY"]);
    expect(brandWords("Academia Luz de Luna")).toEqual(["Academia", "Luz de Luna"]);
    expect(brandWords("Lumen")).toEqual(["Lumen", ""]);
  });
});
