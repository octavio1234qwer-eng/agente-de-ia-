import { describe, expect, it } from "vitest";
import { centsToDecimal, csvCell, csvDate, dateRange, toCsv } from "@/lib/csv";

describe("csv", () => {
  it("escapa comillas, comas y saltos de línea", () => {
    expect(csvCell('Curso "Pro", nivel 2')).toBe('"Curso ""Pro"", nivel 2"');
    expect(csvCell("línea 1\nlínea 2")).toBe('"línea 1\nlínea 2"');
    expect(csvCell(null)).toBe("");
    expect(csvCell("Ñandú")).toBe("Ñandú");
  });

  it("neutraliza fórmulas en texto pero no en números", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(csvCell("+52 55 1234")).toBe("'+52 55 1234");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("-1+1")).toBe("'-1+1");
    expect(csvCell(-12.5)).toBe("-12.5");
  });

  it("arma el archivo con BOM, encabezados y CRLF", () => {
    const csv = toCsv([{ a: "x", b: 1 }, { a: "y,z", b: 2 }], [{ header: "A", value: (r) => r.a }, { header: "B", value: (r) => r.b }]);
    expect(csv).toBe('﻿A,B\r\nx,1\r\n"y,z",2\r\n');
  });

  it("convierte centavos y fechas a la zona de la academia", () => {
    expect(centsToDecimal(89900)).toBe("899.00");
    expect(centsToDecimal(5)).toBe("0.05");
    expect(csvDate("2026-11-23T05:30:00Z")).toBe("2026-11-22 23:30");
    expect(csvDate(null)).toBe("");
  });

  it("interpreta el rango de fechas local e inclusivo", () => {
    expect(dateRange("2026-11-01", "2026-11-30")).toEqual({ from: "2026-11-01T06:00:00.000Z", to: "2026-12-01T06:00:00.000Z" });
    expect(dateRange(null, null)).toEqual({ from: null, to: null });
    expect(dateRange("2026-11-30", "2026-11-01")).toBeNull();
    expect(dateRange("01/11/2026", null)).toBeNull();
  });
});
