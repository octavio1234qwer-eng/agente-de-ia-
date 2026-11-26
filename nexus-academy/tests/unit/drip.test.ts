import { describe, expect, it } from "vitest";
import { isReleased, moduleReleaseAt, parseReleaseDays, releaseAfterLabel } from "@/lib/drip";

describe("liberación programada", () => {
  it("calcula la fecha de liberación desde la inscripción", () => {
    const at = moduleReleaseAt("2026-11-01T10:00:00Z", 7);
    expect(at?.toISOString()).toBe("2026-11-08T10:00:00.000Z");
    expect(isReleased(at, new Date("2026-11-08T09:59:59Z"))).toBe(false);
    expect(isReleased(at, new Date("2026-11-08T10:00:00Z"))).toBe(true);
  });

  it("sin programación, sin inscripción o para el admin, ya está disponible", () => {
    expect(moduleReleaseAt("2026-11-01T10:00:00Z", null)).toBeNull();
    expect(moduleReleaseAt("2026-11-01T10:00:00Z", 0)).toBeNull();
    expect(moduleReleaseAt(null, 7)).toBeNull();
    expect(moduleReleaseAt("2026-11-01T10:00:00Z", 7, true)).toBeNull();
    expect(moduleReleaseAt("no es fecha", 7)).toBeNull();
    expect(isReleased(null)).toBe(true);
  });

  it("describe la liberación en el temario público", () => {
    expect(releaseAfterLabel(null)).toBeNull();
    expect(releaseAfterLabel(0)).toBeNull();
    expect(releaseAfterLabel(1)).toBe("Se libera 1 día después de inscribirte");
    expect(releaseAfterLabel(7)).toBe("Se libera 1 semana después de inscribirte");
    expect(releaseAfterLabel(14)).toBe("Se libera 2 semanas después de inscribirte");
    expect(releaseAfterLabel(10)).toBe("Se libera 10 días después de inscribirte");
    expect(releaseAfterLabel(91)).toBe("Se libera 91 días después de inscribirte");
  });

  it("valida los días que escribe el admin", () => {
    expect(parseReleaseDays("")).toEqual({ ok: true, value: null });
    expect(parseReleaseDays("0")).toEqual({ ok: true, value: null });
    expect(parseReleaseDays(" 14 ")).toEqual({ ok: true, value: 14 });
    expect(parseReleaseDays("730")).toEqual({ ok: true, value: 730 });
    expect(parseReleaseDays("731").ok).toBe(false);
    expect(parseReleaseDays("-3").ok).toBe(false);
    expect(parseReleaseDays("2.5").ok).toBe(false);
    expect(parseReleaseDays("abc").ok).toBe(false);
  });
});
