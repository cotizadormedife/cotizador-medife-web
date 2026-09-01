import { describe, expect, it } from "vitest";
import { computeQuote } from "./engine";
import type { DiscountPolicy, PricingData, QuoteInput } from "./types";
import { PLANES } from "./types";

// Fila de precios AMBA-Obl transcripta 1:1 del legacy BUILTIN_PRICES.
const AMBA_OBL_TITULAR_36_40 = [168830, 166883, 200947, 230982, 302466, 377487, 527533];
const AMBA_OBL_TITULAR_26_35 = [142594, 160476, 188795, 222112, 286364, 338020, 522672];
const AMBA_OBL_HIJO_0_1 = [222112, 160476, 188795, 222112, 286364, 338020, 522672];
const NORTE_OBL_TITULAR_0_25 = [274592, 167634, 197217, 237611, 274592, 351115, 427214];
const NORTE_OBL_HIJO_0_1 = [274592, 167634, 197217, 237611, 274592, 351115, 427214];

function priceRows(ageBracketCode: string, montos: number[]) {
  return PLANES.map((planCode, i) => ({ ageBracketCode, planCode, monto: montos[i] }));
}

function policy(overrides: Partial<DiscountPolicy> & Pick<DiscountPolicy, "id">): DiscountPolicy {
  return {
    nombre: overrides.id,
    tipo: "dto",
    region: "Nac",
    categoriaScope: null,
    procedenciaGate: "",
    zonaFilial: null,
    valorPct: 0,
    permanente: false,
    plazoMeses: null,
    concatenable: false,
    detalle: null,
    planRules: PLANES.map((planCode) => ({ planCode, aplica: true, valorOverride: null })),
    schedule: [],
    ...overrides,
  };
}

const segJoven25InteriorPolicy = policy({
  id: "segmento-joven-h-25-interior-Obl",
  nombre: "Segmento Joven h/25",
  region: "Interior",
  categoriaScope: "Obl",
  valorPct: -0.26,
  permanente: true,
  planRules: PLANES.map((planCode) => ({
    planCode,
    aplica: planCode !== "INDIE" && planCode !== "MEDIFEPLUS",
    valorOverride: null,
  })),
});

const ajusteHijosInteriorPolicy = policy({
  id: "ajuste-lista-hijos-interior-Obl",
  nombre: "Ajuste lista Hijos",
  region: "Interior",
  categoriaScope: "Obl",
  valorPct: -0.55,
  permanente: true,
  planRules: PLANES.map((planCode) => ({ planCode, aplica: planCode !== "INDIE", valorOverride: null })),
});

const segJoven29Policy = policy({
  id: "segmento-joven-h-29-amba-Obl",
  nombre: "Segmento Joven h/29",
  region: "AMBA",
  categoriaScope: "Obl",
  valorPct: -0.13,
  permanente: true,
  planRules: PLANES.map((planCode) => ({ planCode, aplica: planCode !== "INDIE", valorOverride: null })),
});

const ajusteHijosPolicy = policy({
  id: "ajuste-lista-hijos-amba-Obl",
  nombre: "Ajuste lista Hijos",
  region: "AMBA",
  categoriaScope: "Obl",
  valorPct: -0.45,
  permanente: true,
  planRules: PLANES.map((planCode) => ({ planCode, aplica: planCode !== "INDIE", valorOverride: null })),
});

const uccPolicy = policy({
  id: "ucc",
  nombre: "UCC",
  region: "Norte",
  categoriaScope: null,
  procedenciaGate: "GAF",
  valorPct: -0.15,
  permanente: true,
});

const prestadoresAmbaPolicy = policy({
  id: "prestadores-medife-amba",
  nombre: "PRESTADORES MEDIFE AMBA",
  region: "AMBA",
  categoriaScope: null,
  procedenciaGate: "GAF",
  valorPct: -0.15,
  permanente: true,
});

const opcion1ObPolicy = policy({
  id: "opcion-1-nac-Obl",
  nombre: "Opción 1",
  region: "Nac",
  categoriaScope: "Obl",
  valorPct: -0.45,
  plazoMeses: 7,
  planRules: PLANES.map((planCode) => ({ planCode, aplica: planCode !== "INDIE", valorOverride: null })),
  schedule: [
    { seq: 1, valorPct: -0.45, months: 2 },
    { seq: 2, valorPct: -0.3, months: 3 },
    { seq: 3, valorPct: -0.15, months: 2 },
  ],
});

function baseData(policies: DiscountPolicy[], prices: ReturnType<typeof priceRows>): PricingData {
  return {
    prices,
    policies,
    monotributoBrackets: { A: 25694.55, D: 30535.56 },
    config: {
      aporte_tope: 4509567.41,
      aporte_pct_capado: 0.0255,
      aporte_pct_no_capado: 0.051,
      aporte_factor_obras_sociales: 0.93,
      aporte_factor_medife: 0.97,
      monotributo_factor: 0.93,
      iva_voluntario_pct: 0.105,
    },
    priceListVersionId: "test-version",
  };
}

describe("computeQuote", () => {
  it("sin descuentos aplicables, el total = precio de lista", () => {
    const input: QuoteInput = {
      region: "AMBA",
      categoria: "Obl",
      procedencia: "Otros",
      filial: "CABA",
      miembros: [{ tipo: "Titular", rango: "36-40" }],
      selectedPolicyIds: [],
    };
    const data = baseData([], priceRows("36-40", AMBA_OBL_TITULAR_36_40));
    const result = computeQuote(input, data);
    expect(result.planes[0].total).toBeCloseTo(168830, 2);
    expect(result.planes[4].total).toBeCloseTo(302466, 2); // PLATA
  });

  it("Segmento Joven h/29 se auto-aplica a un titular AMBA 26-35 sin familia (menos en INDIE)", () => {
    const input: QuoteInput = {
      region: "AMBA",
      categoria: "Obl",
      procedencia: "Otros",
      filial: "CABA",
      miembros: [{ tipo: "Titular", rango: "26-35" }],
      selectedPolicyIds: [],
    };
    const data = baseData([segJoven29Policy], priceRows("26-35", AMBA_OBL_TITULAR_26_35));
    const result = computeQuote(input, data);
    expect(result.planes[0].total).toBeCloseTo(142594, 2); // INDIE sin descuento
    expect(result.planes[1].total).toBeCloseTo(160476 * 0.87, 2); // MEDIFÉ+ con -13%
  });

  it("En el interior, Ajuste Lista Hijos y Segmento Joven h/25 son aditivos (integrantes distintos)", () => {
    // En AMBA, Segmento Joven exige "sin familia" (ni cónyuge ni hijos) — no coexiste
    // con Ajuste Hijos. En el interior, en cambio, h/25 solo mira al titular/cónyuge,
    // así que sí puede combinarse con un hijo en el grupo.
    const input: QuoteInput = {
      region: "Norte",
      categoria: "Obl",
      procedencia: "Otros",
      filial: "Rosario",
      miembros: [
        { tipo: "Titular", rango: "0-25" },
        { tipo: "Hijo/a", rango: "0-1" },
      ],
      selectedPolicyIds: [],
    };
    const data = baseData(
      [segJoven25InteriorPolicy, ajusteHijosInteriorPolicy],
      [...priceRows("0-25", NORTE_OBL_TITULAR_0_25), ...priceRows("HIJO-0-1", NORTE_OBL_HIJO_0_1)]
    );
    const result = computeQuote(input, data);
    const pi = 4; // PLATA
    const subtotal = NORTE_OBL_TITULAR_0_25[pi] + NORTE_OBL_HIJO_0_1[pi];
    const ajusteHijos = NORTE_OBL_HIJO_0_1[pi] * -0.55;
    const segJoven = NORTE_OBL_TITULAR_0_25[pi] * -0.26;
    expect(result.planes[pi].subtotal).toBeCloseTo(subtotal, 2);
    expect(result.planes[pi].ajusteHijos).toBeCloseTo(ajusteHijos, 2);
    expect(result.planes[pi].segmentoJoven).toBeCloseTo(segJoven, 2);
    expect(result.planes[pi].total).toBeCloseTo(subtotal + ajusteHijos + segJoven, 2);
  });

  it("UCC se aplica sobre subtotalAjustado y es acumulable", () => {
    const input: QuoteInput = {
      region: "AMBA",
      categoria: "Obl",
      procedencia: "Otros",
      filial: "CABA",
      miembros: [{ tipo: "Titular", rango: "36-40" }],
      selectedPolicyIds: ["ucc"],
    };
    const data = baseData([{ ...uccPolicy, region: "AMBA" }], priceRows("36-40", AMBA_OBL_TITULAR_36_40));
    const result = computeQuote(input, data);
    const pi = 4;
    expect(result.planes[pi].ucc).toBeCloseTo(AMBA_OBL_TITULAR_36_40[pi] * -0.15, 2);
    expect(result.planes[pi].total).toBeCloseTo(AMBA_OBL_TITULAR_36_40[pi] * 0.85, 2);
  });

  it("GAF interés general solo se activa si NO hay descuento comercial activo en ningún plan", () => {
    const input: QuoteInput = {
      region: "AMBA",
      categoria: "Obl",
      procedencia: "Otros",
      filial: "CABA",
      miembros: [{ tipo: "Titular", rango: "36-40" }],
      selectedPolicyIds: ["prestadores-medife-amba"],
    };
    const dataSinComercial = baseData([prestadoresAmbaPolicy], priceRows("36-40", AMBA_OBL_TITULAR_36_40));
    const resultSinComercial = computeQuote(input, dataSinComercial);
    const pi = 4;
    expect(resultSinComercial.planes[pi].gafInteresPct).toBeCloseTo(-0.15, 4);
    expect(resultSinComercial.planes[pi].total).toBeCloseTo(AMBA_OBL_TITULAR_36_40[pi] * 0.85, 2);

    const inputConComercial: QuoteInput = {
      ...input,
      selectedPolicyIds: ["prestadores-medife-amba", "opcion-1-nac-Obl"],
    };
    const dataConComercial = baseData(
      [prestadoresAmbaPolicy, opcion1ObPolicy],
      priceRows("36-40", AMBA_OBL_TITULAR_36_40)
    );
    const resultConComercial = computeQuote(inputConComercial, dataConComercial);
    // Con descuento comercial activo en algún plan, el GAF interés general no se aplica en NINGUNO
    expect(resultConComercial.planes[pi].gafInteresPct).toBe(0);
    expect(resultConComercial.planes[0].gafInteresPct).toBe(0); // ni siquiera en INDIE, donde Opción 1 no aplica
  });

  it("el descuento comercial combinado nunca supera el tope de -70%", () => {
    const bigDiscount1 = policy({
      id: "big-1",
      categoriaScope: "Obl",
      valorPct: -0.5,
      permanente: true,
    });
    const bigDiscount2 = policy({
      id: "big-2",
      categoriaScope: "Obl",
      valorPct: -0.4,
      permanente: true,
    });
    const input: QuoteInput = {
      region: "AMBA",
      categoria: "Obl",
      procedencia: "Otros",
      filial: "CABA",
      miembros: [{ tipo: "Titular", rango: "36-40" }],
      selectedPolicyIds: ["big-1", "big-2"],
    };
    const data = baseData([bigDiscount1, bigDiscount2], priceRows("36-40", AMBA_OBL_TITULAR_36_40));
    const result = computeQuote(input, data);
    expect(result.planes[4].descuentoComercialPct).toBe(-0.7);
  });

  it("IVA 10.5% se aplica en Voluntario", () => {
    const input: QuoteInput = {
      region: "AMBA",
      categoria: "Vol",
      procedencia: "Otros",
      filial: "CABA",
      miembros: [{ tipo: "Titular", rango: "36-40" }],
      selectedPolicyIds: [],
    };
    const precios = [237746, 178824, 210381, 247525, 306521, 430356, 559463];
    const data = baseData([], priceRows("36-40", precios));
    const result = computeQuote(input, data);
    expect(result.planes[4].total).toBeCloseTo(precios[4] * 1.105, 2);
  });

  it("Aporte Monotributo usa la tabla fija por categoría, no el sueldo", () => {
    const input: QuoteInput = {
      region: "AMBA",
      categoria: "Obl",
      procedencia: "Otros",
      filial: "CABA",
      miembros: [{ tipo: "Titular", rango: "36-40", obraSocial: "MONOTRIBUTO", monotributoCat: "D", sueldo: 999999999 }],
      selectedPolicyIds: [],
    };
    const data = baseData([], priceRows("36-40", AMBA_OBL_TITULAR_36_40));
    const result = computeQuote(input, data);
    const aporteEsperado = 30535.56 * 0.93;
    expect(result.planes[4].aportes).toBeCloseTo(-aporteEsperado, 2);
    expect(result.planes[4].total).toBeCloseTo(AMBA_OBL_TITULAR_36_40[4] - aporteEsperado, 2);
  });
});
