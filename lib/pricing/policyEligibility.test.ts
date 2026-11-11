import { describe, expect, it } from "vitest";
import { isCompatible, isPolicyMemberEligible, resolverTacticosSolapados, tacticosSolapan } from "./policyEligibility";
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

  it("RF-101: Opción 1/2/3 van solo con Opción 5, Opción 4 solo con Opción 6", () => {
    const op = (n: number) => policy({ id: `opcion-${n}-Obl` });
    expect(isCompatible(op(4), op(6))).toBe(true);
    expect(isCompatible(op(3), op(5))).toBe(true);
    for (const n of [1, 2, 3, 5]) {
      expect(isCompatible(op(n), op(4))).toBe(false);
      expect(isCompatible(op(6), op(n))).toBe(false);
    }
    expect(isCompatible(op(1), op(3))).toBe(false); // RF-60
  });

  it("RF-101: las Opciones siguen siendo compatibles con descuentos tácticos y GAF", () => {
    const opcion4 = policy({ id: "opcion-4-Obl" });
    expect(isCompatible(opcion4, policy({ id: "dto-mes-plata", grupo: "tactico" }))).toBe(true);
    expect(isCompatible(opcion4, policy({ id: "ucc-norte", grupo: "gaf", tipo: "ucc" }))).toBe(true);
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

describe("resolverTacticosSolapados (RF-124)", () => {
  const debil = policy({ id: "dto-plata-15", grupo: "tactico", valorPct: -0.15, planRules: soloPlan("PLATA", -0.15) });
  const fuerte = policy({ id: "dto-plata-20", grupo: "tactico", valorPct: -0.2, planRules: soloPlan("PLATA", -0.2) });

  it("dos tácticos que compiten por el mismo plan: queda el ÚLTIMO elegido, aunque sea el menor", () => {
    expect(resolverTacticosSolapados([debil, fuerte], ["dto-plata-20", "dto-plata-15"]).map((p) => p.id)).toEqual(["dto-plata-15"]);
    expect(resolverTacticosSolapados([debil, fuerte], ["dto-plata-15", "dto-plata-20"]).map((p) => p.id)).toEqual(["dto-plata-20"]);
  });
  it("un táctico solo se aplica aunque exista otro mayor disponible", () => {
    expect(resolverTacticosSolapados([debil], ["dto-plata-15"]).map((p) => p.id)).toEqual(["dto-plata-15"]);
  });
  it("tácticos que no comparten ningún plan conviven los dos", () => {
    const oro = policy({ id: "dto-oro", grupo: "tactico", valorPct: -0.2, planRules: soloPlan("ORO", -0.2) });
    expect(resolverTacticosSolapados([debil, oro], ["dto-plata-15", "dto-oro"]).map((p) => p.id).sort()).toEqual(["dto-oro", "dto-plata-15"]);
  });
  it("tacticosSolapan: solo cuenta los planes en los que AMBOS aplican", () => {
    const oro = policy({ id: "dto-oro", grupo: "tactico", planRules: soloPlan("ORO", -0.2) });
    expect(tacticosSolapan(debil, fuerte)).toBe(true);
    expect(tacticosSolapan(debil, oro)).toBe(false);
  });
});
