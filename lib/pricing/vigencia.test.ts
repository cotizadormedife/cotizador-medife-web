import { describe, expect, it } from "vitest";
import { compareVigencia, formatVigencia, nextVigencia } from "./vigencia";

describe("vigencia", () => {
  it("formatea mes/año en español", () => {
    expect(formatVigencia({ anio: 2026, mes: 9 })).toBe("Septiembre 2026");
    expect(formatVigencia({ anio: 2026, mes: 1 })).toBe("Enero 2026");
  });

  it("agrega el número de versión cuando se pasa (RF-67)", () => {
    expect(formatVigencia({ anio: 2026, mes: 9 }, 1)).toBe("Septiembre 2026 Ver.1");
    expect(formatVigencia({ anio: 2026, mes: 9 }, 2)).toBe("Septiembre 2026 Ver.2");
  });

  it("avanza al mes siguiente", () => {
    expect(nextVigencia({ anio: 2026, mes: 9 })).toEqual({ anio: 2026, mes: 10 });
  });

  it("salta de año después de diciembre", () => {
    expect(nextVigencia({ anio: 2026, mes: 12 })).toEqual({ anio: 2027, mes: 1 });
  });

  it("compara vigencias cronológicamente", () => {
    expect(compareVigencia({ anio: 2026, mes: 9 }, { anio: 2026, mes: 10 })).toBeLessThan(0);
    expect(compareVigencia({ anio: 2027, mes: 1 }, { anio: 2026, mes: 12 })).toBeGreaterThan(0);
    expect(compareVigencia({ anio: 2026, mes: 9 }, { anio: 2026, mes: 9 })).toBe(0);
  });
});
