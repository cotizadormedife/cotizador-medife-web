import { describe, expect, it } from "vitest";
import { aplicarToggle } from "./policyToggle";
import type { DiscountPolicy } from "./types";
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

describe("aplicarToggle — lista de noviembre: la Opción 6 es 'No acumulable con otros descuentos'", () => {
  const o1 = policy({ id: "o1", slug: "opcion-1-Obl" });
  const o4 = policy({ id: "o4", slug: "opcion-4-Obl" });
  const o6 = policy({ id: "o6", slug: "opcion-6-Obl", excluyeOtros: true }); // sin requisito
  const todas = [o1, o4, o6];

  it("tildar la Opción 6 blanquea las demás y ella QUEDA tildada (bug de producción)", () => {
    expect(aplicarToggle(todas, ["o1"], "o6", true)).toEqual(["o6"]);
    expect(aplicarToggle(todas, [], "o6", true)).toEqual(["o6"]);
  });
  it("tildar otra opción con la 6 elegida deja solo la nueva", () => {
    expect(aplicarToggle(todas, ["o6"], "o1", true)).toEqual(["o1"]);
  });
  it("destildar la Opción 6 la saca", () => {
    expect(aplicarToggle(todas, ["o6"], "o6", false)).toEqual([]);
  });
});

describe("aplicarToggle — listas de septiembre/octubre: la Opción 6 exige la Opción 4", () => {
  const o4 = policy({ id: "o4", slug: "opcion-4-Obl" });
  const o5 = policy({ id: "o5", slug: "opcion-5-Obl" });
  const o6 = policy({ id: "o6", slug: "opcion-6-Obl", requiereSlugPrefix: "opcion-4", concatenable: true });
  const todas = [o4, o5, o6];

  it("sin Opción 4, la Opción 6 no queda tildada", () => {
    expect(aplicarToggle(todas, [], "o6", true)).toEqual([]);
  });
  it("con Opción 4 elegida, la Opción 6 se puede tildar y conviven", () => {
    expect(aplicarToggle(todas, ["o4"], "o6", true)).toEqual(["o4", "o6"]);
  });
  it("destildar la Opción 4 destilda sola la Opción 6", () => {
    expect(aplicarToggle(todas, ["o4", "o6"], "o4", false)).toEqual([]);
  });
  it("tildar la Opción 5 saca la 4 y, con ella, la 6 que la necesitaba", () => {
    expect(aplicarToggle(todas, ["o4", "o6"], "o5", true)).toEqual(["o5"]);
  });
});

describe("aplicarToggle — reglas que no cambian", () => {
  it("Opción 1, 2 y 3 son excluyentes entre sí", () => {
    const o1 = policy({ id: "o1", slug: "opcion-1-Obl" });
    const o2 = policy({ id: "o2", slug: "opcion-2-Obl" });
    expect(aplicarToggle([o1, o2], ["o1"], "o2", true)).toEqual(["o2"]);
  });
  it("un solo GAF a la vez", () => {
    const g1 = policy({ id: "g1", slug: "gaf-1", grupo: "gaf" });
    const g2 = policy({ id: "g2", slug: "gaf-2", grupo: "gaf" });
    expect(aplicarToggle([g1, g2], ["g1"], "g2", true)).toEqual(["g2"]);
  });
});

describe("aplicarToggle — descuentos tácticos que compiten (RF-124)", () => {
  const soloPlata = PLANES.map((p) => ({ planCode: p, aplica: p === "PLATA", valorOverride: null }));
  const soloOro = PLANES.map((p) => ({ planCode: p, aplica: p === "ORO", valorOverride: null }));
  const fuerte = policy({ id: "t-fuerte", slug: "dto-mes-plata-20", grupo: "tactico", valorPct: -0.2, planRules: soloPlata });
  const debil = policy({ id: "t-debil", slug: "dto-mes-plata-10", grupo: "tactico", valorPct: -0.1, planRules: soloPlata });
  const otroPlan = policy({ id: "t-oro", slug: "dto-mes-oro-15", grupo: "tactico", valorPct: -0.15, planRules: soloOro });
  const o1 = policy({ id: "o1", slug: "opcion-1-Obl" });
  const todas = [fuerte, debil, otroPlan, o1];

  it("se puede tildar el menor aunque exista uno mayor: queda tildado", () => {
    expect(aplicarToggle(todas, [], "t-debil", true)).toEqual(["t-debil"]);
  });
  it("tildar uno destilda el que compite con él por el mismo plan (el último elegido manda)", () => {
    expect(aplicarToggle(todas, ["t-fuerte"], "t-debil", true)).toEqual(["t-debil"]);
    expect(aplicarToggle(todas, ["t-debil"], "t-fuerte", true)).toEqual(["t-fuerte"]);
  });
  it("no toca a los que no compiten ni a las Opciones", () => {
    expect(aplicarToggle(todas, ["t-oro", "o1"], "t-debil", true)).toEqual(["t-oro", "o1", "t-debil"]);
  });
});
