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

// RF-M8: grupo/categoriaEspecial/requiereSlugPrefix ya no se adivinan por
// prefijo de id en el motor — pero los tests de acá abajo siguen usando esa
// misma convención de nombres, así que este helper la reproduce una vez acá
// para no tener que anotar los 3 campos a mano en cada caso de test.
function policy(overrides: Partial<DiscountPolicy> & Pick<DiscountPolicy, "id">): DiscountPolicy {
  const merged: DiscountPolicy = {
    slug: overrides.id,
    nombre: overrides.id,
    tipo: "dto",
    grupo: "otro",
    categoriaEspecial: null,
    region: "Nac",
    categoriaScope: null,
    procedenciaGate: "",
    zonaFilial: null,
    valorPct: 0,
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
  const id = merged.slug;
  if (!("grupo" in overrides)) {
    if (merged.procedenciaGate === "GAF") merged.grupo = "gaf";
    else if (id.startsWith("ajuste-lista-hijos") || id.startsWith("segmento-joven") || id.startsWith("descuento-filial")) merged.grupo = "ajuste";
    else if (id.startsWith("opcion-")) merged.grupo = "estrategico";
    else if (id.startsWith("dto-mes") || id.startsWith("dto-indie")) merged.grupo = "tactico";
  }
  if (!("categoriaEspecial" in overrides)) {
    if (id.startsWith("ajuste-lista-hijos")) merged.categoriaEspecial = "ajuste_hijos";
    else if (id.startsWith("segmento-joven-h-25")) merged.categoriaEspecial = "segmento_joven_h25";
    else if (id.startsWith("segmento-joven-h-29")) merged.categoriaEspecial = "segmento_joven_h29";
    else if (id.startsWith("descuento-filial")) merged.categoriaEspecial = "descuento_filial";
  }
  if (!("requiereSlugPrefix" in overrides) && id.startsWith("opcion-6")) {
    merged.requiereSlugPrefix = "opcion-4";
  }
  return merged;
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
  tipo: "ucc",
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

    // En la proyección: el GAF vuelve a activarse solo una vez que Opción 1
    // (7 meses) ya terminó, no antes.
    const porMes = (m: number) => resultConComercial.proyeccionCuotas.find((c) => c.month === m)!;
    expect(porMes(7).gafActivo).toBe(false);
    expect(porMes(8).gafActivo).toBe(true);
    expect(porMes(8).porPlan.PLATA).toBeCloseTo(AMBA_OBL_TITULAR_36_40[pi] * 0.85, 0);
  });

  it("la proyección del GAF interés general usa solo las políticas GAF tildadas, no todas las relevantes al contexto", () => {
    const nacionalNoSeleccionada = policy({
      id: "clientes-tributo-simple",
      nombre: "CLIENTES TRIBUTO SIMPLE",
      region: "Nac", // relevante en cualquier región, aunque no se tilde
      procedenciaGate: "GAF",
      valorPct: -0.1,
      permanente: true,
    });
    const input: QuoteInput = {
      region: "AMBA",
      categoria: "Obl",
      procedencia: "Otros",
      filial: "CABA",
      miembros: [{ tipo: "Titular", rango: "36-40" }],
      selectedPolicyIds: ["prestadores-medife-amba"], // solo esta, no la nacional
    };
    const data = baseData(
      [prestadoresAmbaPolicy, nacionalNoSeleccionada],
      priceRows("36-40", AMBA_OBL_TITULAR_36_40)
    );
    const result = computeQuote(input, data);
    const pi = 4;
    const hoy = result.planes[pi].gafInteresPct;
    const mes1 = result.proyeccionCuotas.find((c) => c.month === 1)!.porPlan.PLATA;
    // El precio de "hoy" y el de la proyección tienen que coincidir: -15%
    // (solo la seleccionada), nunca -25% (sumando también la no tildada).
    expect(hoy).toBeCloseTo(-0.15, 4);
    expect(mes1).toBeCloseTo(result.planes[pi].total, 0);
    expect(mes1).toBeCloseTo(AMBA_OBL_TITULAR_36_40[pi] * 0.85, 0);
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

  it("Opción 6 concatena después de Opción 4 (meses 1-12 Opción 4, meses 13-24 Opción 6) — no se suman", () => {
    const opcion4 = policy({
      id: "opcion-4-nac-Vol",
      nombre: "Opción 4",
      valorPct: -0.15,
      plazoMeses: 12,
      concatenable: false,
    });
    const opcion6 = policy({
      id: "opcion-6-nac-Vol",
      nombre: "Opción 6",
      valorPct: -0.2,
      plazoMeses: 12,
      concatenable: true,
      requiereSlugPrefix: "opcion-4",
    });
    const input: QuoteInput = {
      region: "AMBA",
      categoria: "Vol",
      procedencia: "comprobable",
      filial: "CABA",
      miembros: [{ tipo: "Titular", rango: "36-40" }],
      selectedPolicyIds: ["opcion-4-nac-Vol", "opcion-6-nac-Vol"],
    };
    const precios = [237746, 178824, 210381, 247525, 306521, 430356, 559463];
    const data = baseData([opcion4, opcion6], priceRows("36-40", precios));
    const result = computeQuote(input, data);

    // Precio "hoy" (tarjetas de plan): solo Opción 4, -15% (no se suman).
    expect(result.planes[4].descuentoComercialPct).toBeCloseTo(-0.15, 5);

    const sinDescuento = precios[4] * 1.105;
    const porMes = (m: number) => result.proyeccionCuotas.find((c) => c.month === m)!.porPlan.PLATA;

    // Meses 1-12: Opción 4 sola (-15%).
    expect(porMes(1)).toBeCloseTo(sinDescuento * 0.85, 0);
    expect(porMes(12)).toBeCloseTo(sinDescuento * 0.85, 0);
    // Meses 13-24: Opción 6 arranca sola, con su propio valor (-20%).
    expect(porMes(13)).toBeCloseTo(sinDescuento * 0.8, 0);
    expect(porMes(24)).toBeCloseTo(sinDescuento * 0.8, 0);
    // Mes 25: Opción 6 también venció (12 meses desde el 13, hasta el 24).
    expect(porMes(25)).toBeCloseTo(sinDescuento, 0);
  });

  it("un descuento escalonado (schedule) aplica el tramo correcto en cada mes de la proyección", () => {
    const opcion1Like = policy({
      id: "opcion-1-nac-Vol",
      nombre: "Opción 1",
      valorPct: -0.3, // tramo 1, usado también como precio "de hoy" (mes 1)
      plazoMeses: 7,
      concatenable: false,
      schedule: [
        { seq: 1, valorPct: -0.3, months: 3 },
        { seq: 2, valorPct: -0.2, months: 2 },
        { seq: 3, valorPct: -0.1, months: 2 },
      ],
    });
    const input: QuoteInput = {
      region: "AMBA",
      categoria: "Vol",
      procedencia: "Otros",
      filial: "CABA",
      miembros: [{ tipo: "Titular", rango: "36-40" }],
      selectedPolicyIds: ["opcion-1-nac-Vol"],
    };
    const precios = [237746, 178824, 210381, 247525, 306521, 430356, 559463];
    const data = baseData([opcion1Like], priceRows("36-40", precios));
    const result = computeQuote(input, data);
    const sinDescuento = precios[4] * 1.105;
    const porMes = (m: number) => result.proyeccionCuotas.find((c) => c.month === m)!.porPlan.PLATA;

    expect(porMes(1)).toBeCloseTo(sinDescuento * 0.7, 0);
    expect(porMes(3)).toBeCloseTo(sinDescuento * 0.7, 0);
    expect(porMes(4)).toBeCloseTo(sinDescuento * 0.8, 0);
    expect(porMes(5)).toBeCloseTo(sinDescuento * 0.8, 0);
    expect(porMes(6)).toBeCloseTo(sinDescuento * 0.9, 0);
    expect(porMes(7)).toBeCloseTo(sinDescuento * 0.9, 0);
    expect(porMes(8)).toBeCloseTo(sinDescuento, 0);
  });

  it("una política concatenable (que exige otra, ej. Opción 6→4) arranca recién el mes siguiente a que vence la principal, no en simultáneo", () => {
    const opcion2Like = policy({
      id: "opcion-2-nac-Vol",
      nombre: "Opción 2",
      valorPct: -0.3,
      plazoMeses: 9,
      concatenable: false,
      schedule: [
        { seq: 1, valorPct: -0.3, months: 3 },
        { seq: 2, valorPct: -0.1, months: 6 },
      ],
    });
    const dependienteLike = policy({
      id: "dependiente-nac-Vol",
      nombre: "Dependiente",
      valorPct: -0.05,
      plazoMeses: 6,
      concatenable: true,
      requiereSlugPrefix: "opcion-2",
    });
    const input: QuoteInput = {
      region: "AMBA",
      categoria: "Vol",
      procedencia: "comprobable",
      filial: "CABA",
      miembros: [{ tipo: "Titular", rango: "36-40" }],
      selectedPolicyIds: ["opcion-2-nac-Vol", "dependiente-nac-Vol"],
    };
    const precios = [237746, 178824, 210381, 247525, 306521, 430356, 559463];
    const data = baseData([opcion2Like, dependienteLike], priceRows("36-40", precios));
    const result = computeQuote(input, data);
    const sinDescuento = precios[4] * 1.105;
    const porMes = (m: number) => result.proyeccionCuotas.find((c) => c.month === m)!.porPlan.PLATA;

    expect(porMes(3)).toBeCloseTo(sinDescuento * 0.7, 0);
    expect(porMes(9)).toBeCloseTo(sinDescuento * 0.9, 0);
    // La dependiente no se suma durante Opción 2 — recién arranca en el mes 10.
    expect(porMes(9)).not.toBeCloseTo(sinDescuento * 0.85, 0);
    expect(porMes(10)).toBeCloseTo(sinDescuento * 0.95, 0);
    expect(porMes(13)).toBeCloseTo(sinDescuento * 0.95, 0);
    // Mes 24 (única cuota proyectada después del 13): la dependiente ya venció (6 meses desde el 10).
    expect(porMes(24)).toBeCloseTo(sinDescuento, 0);
  });

  it("Opción 5 ('Acumulable con opciones 1,2 y 3') se suma en simultáneo con Opción 3, no espera a que termine su plazo", () => {
    const opcion3Like = policy({
      id: "opcion-3-nac-Obl",
      nombre: "Opción 3",
      valorPct: -0.2,
      plazoMeses: 11,
      concatenable: false,
    });
    const opcion5Like = policy({
      id: "opcion-5-nac-Obl",
      nombre: "Opción 5",
      valorPct: -0.05,
      plazoMeses: 6,
      concatenable: false,
    });
    const input: QuoteInput = {
      region: "AMBA",
      categoria: "Obl",
      procedencia: "comprobable",
      filial: "CABA",
      miembros: [{ tipo: "Titular", rango: "36-40" }],
      selectedPolicyIds: ["opcion-3-nac-Obl", "opcion-5-nac-Obl"],
    };
    const data = baseData([opcion3Like, opcion5Like], priceRows("36-40", AMBA_OBL_TITULAR_36_40));
    const result = computeQuote(input, data);
    const pi = 4; // PLATA

    // 1ª cuota: se suman ambas (-20% + -5% = -25%), no solo Opción 3.
    expect(result.planes[pi].descuentoComercialPct).toBeCloseTo(-0.25, 5);

    const porMes = (m: number) => result.proyeccionCuotas.find((c) => c.month === m)!.porPlan.PLATA;
    const base = AMBA_OBL_TITULAR_36_40[pi];
    // Meses 1-6: ambas activas (-25%).
    expect(porMes(1)).toBeCloseTo(base * 0.75, 0);
    // Meses 7-11: Opción 5 ya venció (6 meses), sigue solo Opción 3 (-20%).
    expect(porMes(7)).toBeCloseTo(base * 0.8, 0);
    // Mes 12 en adelante: Opción 3 también venció (11 meses) — precio de lista.
    expect(porMes(13)).toBeCloseTo(base, 0);
  });

  it("RF-M12: dos concatenables sin ninguna principal — la de mayor magnitud arranca en la 1ª cuota, la otra recién después", () => {
    const fuerte = policy({
      id: "concat-fuerte",
      nombre: "Concat Fuerte",
      valorPct: -0.3,
      plazoMeses: 3,
      concatenable: true,
    });
    const debil = policy({
      id: "concat-debil",
      nombre: "Concat Débil",
      valorPct: -0.1,
      plazoMeses: 6,
      concatenable: true,
    });
    const input: QuoteInput = {
      region: "AMBA",
      categoria: "Vol",
      procedencia: "Otros",
      filial: "CABA",
      miembros: [{ tipo: "Titular", rango: "36-40" }],
      selectedPolicyIds: ["concat-fuerte", "concat-debil"],
    };
    const precios = [237746, 178824, 210381, 247525, 306521, 430356, 559463];
    const data = baseData([fuerte, debil], priceRows("36-40", precios));
    const result = computeQuote(input, data);
    const sinDescuento = precios[4] * 1.105;
    const porMes = (m: number) => result.proyeccionCuotas.find((c) => c.month === m)!.porPlan.PLATA;

    // 1ª cuota: solo la de mayor magnitud (Fuerte), no la suma de ambas.
    expect(result.planes[4].descuentoComercialPct).toBeCloseTo(-0.3, 5);
    expect(porMes(1)).toBeCloseTo(sinDescuento * 0.7, 0);
    expect(porMes(3)).toBeCloseTo(sinDescuento * 0.7, 0);
    // Meses 4-9: Fuerte ya venció (3 meses), Débil arranca y dura sus 6 meses.
    expect(porMes(4)).toBeCloseTo(sinDescuento * 0.9, 0);
    expect(porMes(9)).toBeCloseTo(sinDescuento * 0.9, 0);
    // Mes 10: Débil también venció (arrancó en el 4, dura 6 → hasta el 9).
    expect(porMes(10)).toBeCloseTo(sinDescuento, 0);
  });

  it("RF-M12: tres concatenables encadenadas en cascada, sin principal", () => {
    const a = policy({ id: "cad-a", nombre: "Cadena A", valorPct: -0.3, plazoMeses: 2, concatenable: true });
    const b = policy({ id: "cad-b", nombre: "Cadena B", valorPct: -0.2, plazoMeses: 3, concatenable: true });
    const c = policy({ id: "cad-c", nombre: "Cadena C", valorPct: -0.1, plazoMeses: 4, concatenable: true });
    const input: QuoteInput = {
      region: "AMBA",
      categoria: "Vol",
      procedencia: "Otros",
      filial: "CABA",
      miembros: [{ tipo: "Titular", rango: "36-40" }],
      selectedPolicyIds: ["cad-a", "cad-b", "cad-c"],
    };
    const precios = [237746, 178824, 210381, 247525, 306521, 430356, 559463];
    const data = baseData([a, b, c], priceRows("36-40", precios));
    const result = computeQuote(input, data);
    const sinDescuento = precios[4] * 1.105;
    const porMes = (m: number) => result.proyeccionCuotas.find((c) => c.month === m)!.porPlan.PLATA;

    // A (mayor magnitud): meses 1-2. B: meses 3-5. C: meses 6-9. Después, sin descuento.
    expect(porMes(1)).toBeCloseTo(sinDescuento * 0.7, 0);
    expect(porMes(3)).toBeCloseTo(sinDescuento * 0.8, 0);
    expect(porMes(5)).toBeCloseTo(sinDescuento * 0.8, 0);
    expect(porMes(6)).toBeCloseTo(sinDescuento * 0.9, 0);
    expect(porMes(9)).toBeCloseTo(sinDescuento * 0.9, 0);
    expect(porMes(10)).toBeCloseTo(sinDescuento, 0);
  });

  it("Por default (sin acumulable/concatenable/exclusión explícita) dos descuentos se suman en la 1ª cuota", () => {
    const uno = policy({ id: "libre-uno", nombre: "Libre Uno", valorPct: -0.1 });
    const dos = policy({ id: "libre-dos", nombre: "Libre Dos", valorPct: -0.15 });
    const input: QuoteInput = {
      region: "AMBA",
      categoria: "Vol",
      procedencia: "Otros",
      filial: "CABA",
      miembros: [{ tipo: "Titular", rango: "36-40" }],
      selectedPolicyIds: ["libre-uno", "libre-dos"],
    };
    const precios = [237746, 178824, 210381, 247525, 306521, 430356, 559463];
    const data = baseData([uno, dos], priceRows("36-40", precios));
    const result = computeQuote(input, data);
    expect(result.planes[4].descuentoComercialPct).toBeCloseTo(-0.25, 5);
  });

  it("RF-M10: dos descuentos tácticos que compiten por el mismo plan — solo aplica el de mayor descuento", () => {
    const debil = policy({
      id: "dto-mes-plata-debil",
      grupo: "tactico",
      valorPct: -0.1,
      planRules: PLANES.map((p) => ({ planCode: p, aplica: p === "PLATA", valorOverride: null })),
    });
    const fuerte = policy({
      id: "dto-mes-plata-fuerte",
      grupo: "tactico",
      valorPct: -0.2,
      planRules: PLANES.map((p) => ({ planCode: p, aplica: p === "PLATA", valorOverride: null })),
    });
    const input: QuoteInput = {
      region: "AMBA",
      categoria: "Vol",
      procedencia: "Otros",
      filial: "CABA",
      miembros: [{ tipo: "Titular", rango: "36-40" }],
      selectedPolicyIds: ["dto-mes-plata-debil", "dto-mes-plata-fuerte"],
    };
    const data = baseData([debil, fuerte], priceRows("36-40", AMBA_OBL_TITULAR_36_40));
    const result = computeQuote(input, data);
    // -20% (el fuerte), no -10% ni -30% (ambos sumados).
    expect(result.planes[4].descuentoComercialPct).toBeCloseTo(-0.2, 5);
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

  it("RF-M13: con data.planes propio (reordenado y con un plan nuevo), el resultado respeta ese orden en vez del set estático", () => {
    const input: QuoteInput = {
      region: "AMBA",
      categoria: "Obl",
      procedencia: "Otros",
      filial: "CABA",
      miembros: [{ tipo: "Titular", rango: "36-40" }],
      selectedPolicyIds: ["oro-plata-only"],
    };
    // Orden real de la lista subida: ORO antes que PLATA (al revés del set
    // estático), más un plan genuinamente nuevo que no existía antes.
    const data: PricingData = {
      prices: [
        { ageBracketCode: "36-40", planCode: "ORO", monto: 377487 },
        { ageBracketCode: "36-40", planCode: "PLATA", monto: 302466 },
        { ageBracketCode: "36-40", planCode: "NUEVO_PLAN", monto: 999999 },
      ],
      policies: [
        policy({
          id: "oro-plata-only",
          categoriaScope: "Obl",
          valorPct: -0.1,
          permanente: true,
          // Esta política viene de una carga vieja: no conoce NUEVO_PLAN, así
          // que no debería aplicarle nada (en vez de romper o aplicar por defecto).
          planRules: [
            { planCode: "ORO", aplica: true, valorOverride: null },
            { planCode: "PLATA", aplica: true, valorOverride: null },
          ],
        }),
      ],
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
      planes: [
        { code: "ORO", nombre: "Oro", sortOrder: 1 },
        { code: "PLATA", nombre: "Plata", sortOrder: 2 },
        { code: "NUEVO_PLAN", nombre: "Nuevo Plan", sortOrder: 3 },
      ],
    };
    const result = computeQuote(input, data);

    expect(result.planes.map((p) => p.planCode)).toEqual(["ORO", "PLATA", "NUEVO_PLAN"]);
    expect(result.planes.map((p) => p.nombre)).toEqual(["Oro", "Plata", "Nuevo Plan"]);
    expect(result.planes[0].total).toBeCloseTo(377487 * 0.9, 2); // ORO con -10%
    expect(result.planes[1].total).toBeCloseTo(302466 * 0.9, 2); // PLATA con -10%
    // El plan nuevo no tiene regla en la política vieja: no se le aplica el
    // descuento, en vez de heredarlo o romper el cálculo.
    expect(result.planes[2].total).toBeCloseTo(999999, 2);
  });

  it("RF-91: Titular y Esposo/a con distinto rango se cotizan ambos al rango más alto entre los dos", () => {
    // Ejemplo exacto de Diego: titular 0-25, esposo 51-60 → ambos se cotizan
    // como si fueran 51-60 (solo aplica a Titular/Esposo, no a Hijo/a).
    const input: QuoteInput = {
      region: "AMBA",
      categoria: "Obl",
      procedencia: "Otros",
      filial: "CABA",
      miembros: [
        { tipo: "Titular", rango: "0-25" },
        { tipo: "Esposo/a", rango: "51-60" },
      ],
      selectedPolicyIds: [],
    };
    const data = baseData(
      [],
      [
        ...priceRows("0-25", PLANES.map(() => 100)), // Titular a su rango propio — no debería usarse
        ...priceRows("MAT-0-25", PLANES.map(() => 110)), // Esposo/a a 0-25 — tampoco debería usarse
        ...priceRows("51-60", PLANES.map(() => 500)), // Titular pareja-ajustado a 51-60
        ...priceRows("MAT-51-60", PLANES.map(() => 510)), // Esposo/a a su propio rango 51-60
      ]
    );
    const result = computeQuote(input, data);
    expect(result.planes[4].total).toBeCloseTo(500 + 510, 2); // PLATA — ambos al rango más alto
  });

  it("RF-99: el % de Uso Interno (Segmento Joven) se calcula sobre el precio SIN el recargo geográfico, no sobre el precio de lista", () => {
    // Caso real de Diego: Patagonia/Comahue, Obligatorio, Segmento Joven
    // h/25 interior (-26%) — el recargo de Comahue en Obligatorio es +16%,
    // ya incorporado en subtotales[]. El % de Uso Interno debe dar 26%×1.16
    // = 30,16% (no 26%), porque el sistema de Medife donde se carga ese %
    // no tiene el recargo en su propia base.
    const input: QuoteInput = {
      region: "Patagonia",
      categoria: "Obl",
      procedencia: "comprobable",
      filial: "Comahue",
      miembros: [{ tipo: "Titular", rango: "0-25" }],
      selectedPolicyIds: [],
    };
    const data = baseData([segJoven25InteriorPolicy], priceRows("0-25", PLANES.map(() => 200000)));
    const result = computeQuote(input, data);
    const pi = 4; // PLATA
    expect(result.recargoInfo?.pct).toBeCloseTo(0.16, 4);
    // -26% sobre 200.000 (con recargo) = -52.000; contra 200.000/1.16 =
    // 172.413,79 (sin recargo) da 30,16%, no 26%.
    expect(result.usoInterno.segmentoJovenPct[pi]).toBeCloseTo(0.3016, 4);
  });

  it("RF-99: el % de Uso Interno (Ajuste Hijos) también se ajusta por el recargo geográfico", () => {
    const input: QuoteInput = {
      region: "Patagonia",
      categoria: "Obl",
      procedencia: "comprobable",
      filial: "Comahue",
      miembros: [
        { tipo: "Titular", rango: "36-40" }, // no elegible para Segmento Joven
        { tipo: "Hijo/a", rango: "0-1" },
      ],
      selectedPolicyIds: [],
    };
    const data = baseData(
      [ajusteHijosInteriorPolicy],
      [...priceRows("36-40", PLANES.map(() => 100000)), ...priceRows("HIJO-0-1", PLANES.map(() => 100000))]
    );
    const result = computeQuote(input, data);
    const pi = 4; // PLATA
    // Ajuste Hijos -55% sobre el hijo ($100.000 con recargo) = -$55.000;
    // el % de Uso Interno se saca contra el subtotal del GRUPO ($200.000)
    // sin recargo ($200.000/1.16): 55.000/172.413,79 = 55×1.16/200 = 31,9%.
    expect(result.usoInterno.ajusteHijosPct[pi]).toBeCloseTo(0.319, 4);
  });

  it("RF-91: un Titular sin Esposo/a sigue cotizando a su propio rango", () => {
    const input: QuoteInput = {
      region: "AMBA",
      categoria: "Obl",
      procedencia: "Otros",
      filial: "CABA",
      miembros: [{ tipo: "Titular", rango: "0-25" }],
      selectedPolicyIds: [],
    };
    const data = baseData([], priceRows("0-25", PLANES.map(() => 100)));
    const result = computeQuote(input, data);
    expect(result.planes[4].total).toBeCloseTo(100, 2);
  });
});
