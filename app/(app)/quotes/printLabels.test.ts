import { describe, expect, it } from "vitest";
import { condicionLabel, cronogramaLabel, origenLabel } from "./printLabels";
import type { ActivePolicySummary, Miembro } from "@/lib/pricing/types";

const basePolicy: ActivePolicySummary = {
  id: "p1",
  nombre: "Test",
  detalle: null,
  valorPct: -0.1,
  automatica: false,
  slug: "test",
  grupo: "gaf",
  permanente: false,
  plazoMeses: null,
  concatenable: false,
  schedule: [],
  edadMaxTitularConyuge: null,
  fuenteComentario: null,
  planRules: [],
};

describe("cronogramaLabel", () => {
  it("permanente: incluye el porcentaje (bug real — antes solo decía '(permanente)')", () => {
    expect(cronogramaLabel({ ...basePolicy, permanente: true, valorPct: -0.1 })).toBe("10% (permanente)");
  });

  it("escalonado: une cada tramo con ·", () => {
    const p = { ...basePolicy, schedule: [{ seq: 1, valorPct: -0.3, months: 3 }, { seq: 2, valorPct: -0.2, months: 2 }] };
    expect(cronogramaLabel(p)).toBe("30% × 3 meses · 20% × 2 meses");
  });

  it("plazo fijo sin escalonado: 'X% × N meses'", () => {
    expect(cronogramaLabel({ ...basePolicy, plazoMeses: 6, valorPct: -0.1 })).toBe("10% × 6 meses");
  });

  it("cotización vieja sin 'schedule' guardado (bug real): no rompe, cae al plazo fijo", () => {
    const { schedule, ...rest } = basePolicy;
    const p = { ...rest, plazoMeses: 6, valorPct: -0.1 } as unknown as ActivePolicySummary;
    expect(cronogramaLabel(p)).toBe("10% × 6 meses");
  });
});

describe("condicionLabel", () => {
  it("cotización vieja sin 'schedule' guardado (bug real): no rompe, usa 'detalle'", () => {
    const { schedule, ...rest } = basePolicy;
    const p = { ...rest, detalle: "Oro 36 a 65 años" } as unknown as ActivePolicySummary;
    expect(condicionLabel(p)).toBe("Oro 36 a 65 años");
  });
});

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
