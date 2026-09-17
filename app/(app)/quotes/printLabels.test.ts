import { describe, expect, it } from "vitest";
import { origenLabel } from "./printLabels";
import type { Miembro } from "@/lib/pricing/types";

describe("origenLabel", () => {
  it("sin obraSocial elegida, muestra Medifé (default visual del combo en QuoteForm)", () => {
    const m: Miembro = { tipo: "Titular", rango: "36-40" };
    expect(origenLabel(m)).toBe("Medifé");
  });

  it("Obra Social", () => {
    const m: Miembro = { tipo: "Titular", rango: "36-40", obraSocial: "OBRAS SOCIALES" };
    expect(origenLabel(m)).toBe("Obra Social");
  });

  it("Monotributo con categoría", () => {
    const m: Miembro = { tipo: "Titular", rango: "36-40", obraSocial: "MONOTRIBUTO", monotributoCat: "D" };
    expect(origenLabel(m)).toBe("Monotributo (Cat. D)");
  });
});
