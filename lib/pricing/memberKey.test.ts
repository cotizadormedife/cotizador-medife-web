import { describe, expect, it } from "vitest";
import { rangoEfectivoPareja } from "./memberKey";
import type { Miembro } from "./types";

describe("rangoEfectivoPareja", () => {
  // RF-91: pedido de Diego — "si se elige un titular y un esposo de diferente
  // rango de edad, la cotizacion debera interpretar que ambos tienen el
  // rango de edad mas alto entre ellos" (ejemplo exacto: titular 0-25, esposo
  // 51-60 → ambos se cotizan como 51-60).
  it("Titular con rango menor que su Esposo/a toma el rango más alto de los dos", () => {
    const titular: Miembro = { tipo: "Titular", rango: "0-25" };
    const esposo: Miembro = { tipo: "Esposo/a", rango: "51-60" };
    const miembros = [titular, esposo];
    expect(rangoEfectivoPareja(titular, miembros)).toBe("51-60");
    expect(rangoEfectivoPareja(esposo, miembros)).toBe("51-60");
  });

  it("Esposo/a con rango mayor que el Titular también queda en el más alto (simétrico)", () => {
    const titular: Miembro = { tipo: "Titular", rango: "66+" };
    const esposo: Miembro = { tipo: "Esposo/a", rango: "36-40" };
    const miembros = [titular, esposo];
    expect(rangoEfectivoPareja(titular, miembros)).toBe("66+");
    expect(rangoEfectivoPareja(esposo, miembros)).toBe("66+");
  });

  it("mismo rango en ambos: no cambia nada", () => {
    const titular: Miembro = { tipo: "Titular", rango: "41-50" };
    const esposo: Miembro = { tipo: "Esposo/a", rango: "41-50" };
    const miembros = [titular, esposo];
    expect(rangoEfectivoPareja(titular, miembros)).toBe("41-50");
    expect(rangoEfectivoPareja(esposo, miembros)).toBe("41-50");
  });

  it("Titular sin Esposo/a en el grupo: no se ve afectado", () => {
    const titular: Miembro = { tipo: "Titular", rango: "0-25" };
    const miembros = [titular, { tipo: "Hijo/a", rango: "0-1" } as Miembro];
    expect(rangoEfectivoPareja(titular, miembros)).toBe("0-25");
  });

  it("Hijo/a y Familiar a cargo nunca se ven afectados por la pareja Titular/Esposo", () => {
    const titular: Miembro = { tipo: "Titular", rango: "51-60" };
    const hijo: Miembro = { tipo: "Hijo/a", rango: "0-1" };
    const familiar: Miembro = { tipo: "Familiar a cargo", rango: "Familiar a cargo" };
    const miembros = [titular, hijo, familiar];
    expect(rangoEfectivoPareja(hijo, miembros)).toBe("0-1");
    expect(rangoEfectivoPareja(familiar, miembros)).toBe("Familiar a cargo");
  });
});
