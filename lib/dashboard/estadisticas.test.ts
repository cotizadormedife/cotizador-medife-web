import { describe, expect, it } from "vitest";
import { etiquetaMes, hoyAR, limitesMesAR, mesAR, mesesQueCorresponden } from "../fechas";
import { puedeVerDashboard } from "./acceso";
import { resumirPorEmpresa, resumirPorPersona, type CotizacionDash, type PersonaDash } from "./estadisticas";

const persona = (id: string, empresa: string, extra: Partial<PersonaDash> = {}): PersonaDash => ({
  id,
  nombre: id.toUpperCase(),
  apellido: "Test",
  email: `${id}@x.com`,
  empresa_id: empresa,
  status: "approved",
  disabled_at: null,
  created_at: "2026-08-31T12:00:00+00:00",
  ...extra,
});
const cot = (autor: string, iso: string): CotizacionDash => ({ created_by: autor, created_at: iso });

describe("puedeVerDashboard (RF-106: solo el usuario de Diego hasta aprobar el release)", () => {
  it("habilita a Diego (super_admin), sin importar mayúsculas ni espacios", () => {
    expect(puedeVerDashboard({ role: "super_admin", email: "diegoschwartzman@medife.com.ar" })).toBe(true);
    expect(puedeVerDashboard({ role: "super_admin", email: "  DiegoSchwartzman@Medife.com.ar " })).toBe(true);
  });
  it("no habilita a otros super_admin ni admin mientras no se apruebe el release", () => {
    expect(puedeVerDashboard({ role: "super_admin", email: "otro@medife.com.ar" })).toBe(false);
    expect(puedeVerDashboard({ role: "admin", email: "otro@medife.com.ar" })).toBe(false);
  });
  it("un vendedor nunca lo ve, ni siquiera con el mail de Diego", () => {
    expect(puedeVerDashboard({ role: "vendedor", email: "diegoschwartzman@medife.com.ar" })).toBe(false);
  });
});

describe("meses completos en hora de Argentina", () => {
  it("una cotización de las 22:00 del último día del mes cuenta en ese mes, no en el siguiente", () => {
    // 22:00 del 30/09 en Argentina == 01:00 UTC del 01/10.
    expect(mesAR("2026-10-01T01:00:00+00:00")).toBe("2026-09");
    expect(mesAR("2026-10-01T03:00:00+00:00")).toBe("2026-10"); // 00:00 del 01/10 en Argentina
  });
  it("límites del mes: desde las 00:00 de Argentina, hasta el inicio del siguiente (también diciembre)", () => {
    expect(limitesMesAR("2026-10")).toEqual({ desde: "2026-10-01T00:00:00-03:00", hasta: "2026-11-01T00:00:00-03:00" });
    expect(limitesMesAR("2026-12").hasta).toBe("2027-01-01T00:00:00-03:00");
  });
  it("'Todo el año' marca los meses que corresponden", () => {
    const hoy = { anio: 2026, mes: 10 };
    expect(mesesQueCorresponden(2026, hoy)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(mesesQueCorresponden(2025, hoy)).toHaveLength(12);
    expect(mesesQueCorresponden(2027, hoy)).toEqual([]);
  });
  it("hoyAR y etiquetas", () => {
    expect(hoyAR(new Date("2026-10-01T01:00:00+00:00"))).toEqual({ anio: 2026, mes: 9 });
    expect(etiquetaMes("2026-09")).toBe("Sep 2026");
  });
});

describe("resumirPorEmpresa", () => {
  const personas = [
    persona("a1", "A"),
    persona("a2", "A"),
    persona("a3", "A", { disabled_at: "2026-09-10T00:00:00+00:00" }), // deshabilitada: no cuenta como vendedor
    persona("b1", "B"),
    persona("c1", "C"),
  ];
  const cotizaciones = [
    cot("a1", "2026-09-10T15:00:00+00:00"),
    cot("a1", "2026-09-11T15:00:00+00:00"),
    cot("a2", "2026-10-02T15:00:00+00:00"),
    cot("a3", "2026-09-12T15:00:00+00:00"), // de una persona deshabilitada: la cotización sí cuenta
    cot("b1", "2026-09-30T01:30:00+00:00"), // 22:30 del 29/09 en Argentina → septiembre
    cot("b1", "2026-10-01T01:00:00+00:00"), // 22:00 del 30/09 en Argentina → septiembre
    cot("c1", "2026-10-05T15:00:00+00:00"), // empresa C no elegida
    cot("fantasma", "2026-09-10T15:00:00+00:00"), // autor inexistente
  ];
  const empresas = [{ id: "A", nombre: "Empresa A" }, { id: "B", nombre: "Empresa B" }];

  it("septiembre + octubre: totales, vendedores y promedio por vendedor", () => {
    const r = resumirPorEmpresa({ empresas, personas, cotizaciones, meses: ["2026-10", "2026-09"] });
    expect(r.meses).toEqual(["2026-09", "2026-10"]);
    expect(r.totalCotizaciones).toBe(6); // A: 4 (incluye la de a3), B: 2 — C y el fantasma no
    expect(r.totalVendedores).toBe(3); // a1, a2, b1 (a3 deshabilitada y c1 de otra empresa quedan fuera)
    expect(r.vendedoresQueCotizaron).toBe(4); // a1, a2, a3, b1: cotizaron aunque a3 hoy esté deshabilitada
    expect(r.promedio).toBe(2);
    const a = r.filas.find((f) => f.clave === "A")!;
    expect(a.porMes).toEqual({ "2026-09": 3, "2026-10": 1 });
    expect(r.filas.map((f) => f.clave)).toEqual(["A", "B"]); // ordenadas de mayor a menor
  });

  it("un solo mes: solo cuenta lo de ese mes (con la hora de Argentina)", () => {
    const r = resumirPorEmpresa({ empresas, personas, cotizaciones, meses: ["2026-09"] });
    expect(r.totalCotizaciones).toBe(5);
    expect(r.filas.find((f) => f.clave === "B")!.total).toBe(2);
  });

  it("una empresa elegida sin cotizaciones aparece igual, con cero", () => {
    const r = resumirPorEmpresa({ empresas: [{ id: "Z", nombre: "Sin actividad" }], personas, cotizaciones, meses: ["2026-09"] });
    expect(r.filas).toHaveLength(1);
    expect(r.filas[0].total).toBe(0);
    expect(r.promedio).toBe(0); // sin vendedores no divide por cero
  });

  it("no promedia contra gente que todavía no existía al cierre del período", () => {
    const nueva = persona("n1", "A", { created_at: "2026-10-15T12:00:00+00:00" });
    const r = resumirPorEmpresa({ empresas, personas: [...personas, nueva], cotizaciones, meses: ["2026-09"] });
    expect(r.totalVendedores).toBe(3); // n1 se dio de alta en octubre
  });
});

describe("resumirPorPersona", () => {
  const personas = [persona("a1", "A"), persona("a2", "A")];
  const cotizaciones = [cot("a1", "2026-09-10T15:00:00+00:00"), cot("a1", "2026-10-10T15:00:00+00:00"), cot("a2", "2026-09-11T15:00:00+00:00"), cot("otro", "2026-09-11T15:00:00+00:00")];

  it("una fila por persona elegida y promedio contra las personas elegidas", () => {
    const r = resumirPorPersona({ personas, cotizaciones, meses: ["2026-09", "2026-10"] });
    expect(r.totalCotizaciones).toBe(3);
    expect(r.totalVendedores).toBe(2);
    expect(r.promedio).toBeCloseTo(1.5, 5);
    expect(r.filas[0].clave).toBe("a1");
    expect(r.filas[0].porMes).toEqual({ "2026-09": 1, "2026-10": 1 });
  });

  it("para el super_admin la etiqueta lleva el grupo entre paréntesis", () => {
    const sin = resumirPorPersona({ personas, cotizaciones, meses: ["2026-09"] });
    expect(sin.filas[0].etiqueta).not.toContain("(");
    const con = resumirPorPersona({ personas, cotizaciones, meses: ["2026-09"], empresas: [{ id: "A", nombre: "Broker_On Broker" }] });
    expect(con.filas[0].etiqueta).toMatch(/ \(Broker_On Broker\)$/);
  });

  it("si solo se elige a una persona, no se mezclan cotizaciones de otras", () => {
    const r = resumirPorPersona({ personas: [personas[1]], cotizaciones, meses: ["2026-09"] });
    expect(r.totalCotizaciones).toBe(1);
    expect(r.promedio).toBe(1);
  });
});
