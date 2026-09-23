import { describe, expect, it } from "vitest";
import { dedupeTacticosByPlan, isCompatible, isPolicyMemberEligible } from "./policyEligibility";
import type { DiscountPolicy, Miembro } from "./types";
import { PLANES } from "./types";

function policy(overrides: Partial<DiscountPolicy> & Pick<DiscountPolicy, "id">): DiscountPolicy {
  return {
    slug: overrides.id,
    nombre: overrides.id,
    tipo: "dto",
    grupo: "estrategico",
    categoriaEspecial: null,
    region: "Nac",
    categoriaScope: null,
    procedenciaGate: "",
    zonaFilial: null,
    valorPct: -0.1,
    permanente: false,
    plazoMeses: null,
    concatenable: false,
    requiereSlugPrefix: null,
    excluyeOtros: false,
    excluyeGrupo: [],
    edadMaxTitularConyuge: null,
    detalle: null,
    fuenteComentario: null,
    planRules: PLANES.map((planCode) => ({ planCode, aplica: true, valorOverride: null })),
    schedule: [],
    ...overrides,
  };
}

function soloPlan(planCode: string, valorPct: number) {
  return PLANES.map((p) => ({ planCode: p, aplica: p === planCode, valorOverride: null }));
}

describe("isCompatible", () => {
  it("RF-M10 regla 1/4: una política con excluyeOtros no convive con ninguna otra (en cualquier sentido)", () => {
    const opcion7 = policy({ id: "opcion-7", excluyeOtros: true });
    const opcion1 = policy({ id: "opcion-1" });
    expect(isCompatible(opcion7, opcion1)).toBe(false);
    expect(isCompatible(opcion1, opcion7)).toBe(false); // simétrico
  });

  it("excluyeGrupo bloquea solo al grupo indicado, en ambos sentidos", () => {
    const dtoIndie = policy({ id: "dto-indie-18-25", grupo: "tactico", excluyeGrupo: ["estrategico"] });
    const opcion1 = policy({ id: "opcion-1", grupo: "estrategico" });
    const otroTactico = policy({ id: "dto-mes-x", grupo: "tactico" });
    expect(isCompatible(dtoIndie, opcion1)).toBe(false);
    expect(isCompatible(opcion1, dtoIndie)).toBe(false);
    expect(isCompatible(dtoIndie, otroTactico)).toBe(true);
  });

  it("las políticas automáticas nunca se consideran incompatibles con nada", () => {
    const ajusteHijos = policy({ id: "ajuste-lista-hijos", categoriaEspecial: "ajuste_hijos" });
    const opcion7 = policy({ id: "opcion-7", excluyeOtros: true });
    expect(isCompatible(ajusteHijos, opcion7)).toBe(true);
  });

  it("por default (sin reglas) dos políticas son compatibles", () => {
    const a = policy({ id: "a" });
    const b = policy({ id: "b" });
    expect(isCompatible(a, b)).toBe(true);
  });
});

describe("isPolicyMemberEligible", () => {
  it("RF-91: un descuento táctico por rango de edad deja de aplicar si la pareja Titular/Esposo es de rango mayor", () => {
    // Política con rango en el slug (patrón real "dto-mes-NN-MM"), banda 26-35.
    const p = policy({ id: "dto-mes-26-35-plata", grupo: "tactico" });
    const titular: Miembro = { tipo: "Titular", rango: "26-35" }; // dentro de la banda por sí solo
    const esposo: Miembro = { tipo: "Esposo/a", rango: "66+" }; // mucho mayor
    // Antes de RF-91 esto daba elegible (el titular calificaba por su cuenta).
    // Con el pedido de Diego, ambos pasan a considerarse "66+" — ya ninguno
    // cae en la banda 26-35, así que el descuento deja de aplicar.
    expect(isPolicyMemberEligible(p, [titular, esposo], true)).toBe(false);
  });

  it("un Titular sin Esposo/a sigue evaluándose por su propio rango", () => {
    const p = policy({ id: "dto-mes-26-35-plata", grupo: "tactico" });
    const titular: Miembro = { tipo: "Titular", rango: "26-35" };
    expect(isPolicyMemberEligible(p, [titular], true)).toBe(true);
  });
});

describe("dedupeTacticosByPlan", () => {
  it("RF-M10 regla 5: dos tácticos que compiten por el mismo plan — se queda el de mayor descuento", () => {
    const debil = policy({ id: "dto-mes-plata-15", grupo: "tactico", valorPct: -0.15, planRules: soloPlan("PLATA", -0.15) });
    const fuerte = policy({ id: "dto-mes-plata-20", grupo: "tactico", valorPct: -0.2, planRules: soloPlan("PLATA", -0.2) });
    const result = dedupeTacticosByPlan([debil, fuerte]);
    expect(result.map((p) => p.id)).toEqual(["dto-mes-plata-20"]);
  });

  it("tácticos que no comparten ningún plan conviven los dos", () => {
    const plata = policy({ id: "dto-mes-plata", grupo: "tactico", valorPct: -0.15, planRules: soloPlan("PLATA", -0.15) });
    const oro = policy({ id: "dto-mes-oro", grupo: "tactico", valorPct: -0.2, planRules: soloPlan("ORO", -0.2) });
    const result = dedupeTacticosByPlan([plata, oro]);
    expect(result.map((p) => p.id).sort()).toEqual(["dto-mes-oro", "dto-mes-plata"]);
  });

  it("con 3 en cadena, el más débil se descarta aunque no compita directo con el más fuerte", () => {
    // A: PLATA+ORO -30% (el más fuerte)
    // B: ORO -20% (compite con A en ORO)
    // C: PLATA -10% (compite con A en PLATA, no con B)
    const a = policy({
      id: "a",
      grupo: "tactico",
      valorPct: -0.3,
      planRules: PLANES.map((p) => ({ planCode: p, aplica: p === "PLATA" || p === "ORO", valorOverride: null })),
    });
    const b = policy({ id: "b", grupo: "tactico", valorPct: -0.2, planRules: soloPlan("ORO", -0.2) });
    const c = policy({ id: "c", grupo: "tactico", valorPct: -0.1, planRules: soloPlan("PLATA", -0.1) });
    const result = dedupeTacticosByPlan([b, c, a]);
    expect(result.map((p) => p.id)).toEqual(["a"]);
  });
});
