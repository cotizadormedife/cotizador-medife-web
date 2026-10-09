import { describe, expect, it } from "vitest";
import { fmtFechaAR, fmtFechaHoraAR, inicioDiaAR, inicioDiaSiguienteAR } from "./fechas";

describe("fmtFechaHoraAR / fmtFechaAR", () => {
  it("muestra la hora de Argentina (UTC-3), no la del servidor", () => {
    // 19:30 UTC == 16:30 en Argentina (caso real: última cotización del 07/10).
    expect(fmtFechaHoraAR("2026-10-07T19:30:21.710888+00:00")).toContain("16:30:21");
  });

  it("después de las 21:00 de Argentina la fecha sigue siendo la del día (en UTC ya es el siguiente)", () => {
    // 22:30 del 30/09 en Argentina == 01:30 UTC del 01/10.
    const iso = "2026-10-01T01:30:00+00:00";
    expect(fmtFechaAR(iso)).toBe("30/9/2026");
    expect(fmtFechaHoraAR(iso)).toContain("22:30:00");
  });
});

describe("filtros por día", () => {
  it("'desde' arranca a las 00:00 de Argentina", () => {
    expect(inicioDiaAR("2026-10-07")).toBe("2026-10-07T00:00:00-03:00");
  });

  it("'hasta' inclusivo = inicio del día siguiente (también al cruzar fin de mes y de año)", () => {
    expect(inicioDiaSiguienteAR("2026-10-07")).toBe("2026-10-08T00:00:00-03:00");
    expect(inicioDiaSiguienteAR("2026-09-30")).toBe("2026-10-01T00:00:00-03:00");
    expect(inicioDiaSiguienteAR("2026-12-31")).toBe("2027-01-01T00:00:00-03:00");
  });

  it("una cotización de las 22:00 de Argentina entra en su día, no en el siguiente", () => {
    const cotizacion = new Date("2026-10-08T01:00:00+00:00").getTime(); // 22:00 del 07/10 en Argentina
    const desde = new Date(inicioDiaAR("2026-10-07")!).getTime();
    const hastaExcl = new Date(inicioDiaSiguienteAR("2026-10-07")!).getTime();
    expect(cotizacion >= desde && cotizacion < hastaExcl).toBe(true);
  });

  it("valores vacíos o con formato inválido se ignoran (null)", () => {
    for (const malo of [undefined, "", "07/10/2026", "2026-10-7", "x; drop table"]) {
      expect(inicioDiaAR(malo)).toBeNull();
      expect(inicioDiaSiguienteAR(malo)).toBeNull();
    }
  });
});
