import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseDiscountPolicies } from "./parseDiscountPolicies";

const HEADER = [
  "",
  "Tipo",
  "Descripción",
  "Zonas",
  "Duración",
  "Categoría",
  "Procedencia",
  "Plazo Max",
  "Valor % 1er mes",
  "Detalle",
  "Comentarios",
  "",
  "INDIE",
  "MEDIFÉ+",
  "BRONCE CLASSIC",
  "BRONCE",
  "PLATA",
  "ORO",
  "PLATINUM",
];

type Row = {
  tipo: string;
  descripcion: string;
  zonas: string;
  duracion: string;
  categoria: string;
  procedencia: string;
  plazoMax: string;
  valor: number;
  detalle: string;
  comentarios: string;
  planes: number[]; // INDIE, MEDIFEPLUS, BRONCE_C, BRONCE, PLATA, ORO, PLATINUM
};

async function buildWorkbook(rows: Row[]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Políticas Comerciales");
  sheet.addRow([]); // fila 1, vacía
  sheet.addRow(HEADER); // fila 2
  for (const r of rows) {
    sheet.addRow([
      "",
      r.tipo,
      r.descripcion,
      r.zonas,
      r.duracion,
      r.categoria,
      r.procedencia,
      r.plazoMax,
      r.valor,
      r.detalle,
      r.comentarios,
      "",
      ...r.planes,
    ]);
  }
  const buf = await wb.xlsx.writeBuffer();
  return buf as unknown as ArrayBuffer;
}

const opcion4: Row = {
  tipo: "Descuento Estratégico",
  descripcion: "Opción 4",
  zonas: "Nac",
  duracion: "Temporales",
  categoria: "Obl",
  procedencia: "Con procedencia comprobable",
  plazoMax: "12 meses",
  valor: -0.2,
  detalle: "20% x 12",
  comentarios: "",
  planes: [0, -0.2, -0.2, -0.2, -0.2, -0.2, -0.2],
};

const opcion5: Row = {
  tipo: "Descuento Estratégico",
  descripcion: "Opción 5",
  zonas: "Nac",
  duracion: "Temporales",
  categoria: "Obl",
  procedencia: "Con procedencia comprobable",
  plazoMax: "6 meses",
  valor: -0.05,
  detalle: "5% x 6",
  comentarios: "Acumulable con opciones 1,2 y 3",
  planes: [0, -0.05, -0.05, -0.05, -0.05, -0.05, -0.05],
};

const opcion6: Row = {
  tipo: "Descuento Estratégico",
  descripcion: "Opción 6",
  zonas: "Nac",
  duracion: "Temporales",
  categoria: "Obl",
  procedencia: "Exclusivo Débito con TC",
  plazoMax: "12 meses",
  valor: -0.2,
  detalle: "20% x 12",
  comentarios: "Concatenable con la opción 4. Aplica solo GF hasta 60 años con débito automático en tarjeta de crédito.",
  planes: [0, 0, 0, 0, 0, 0, 0],
};

const opcion7: Row = {
  tipo: "Descuento Estratégico",
  descripcion: "Opción 7",
  zonas: "Nac",
  duracion: "Temporales",
  categoria: "Obl",
  procedencia: "BASE ex Asociados",
  plazoMax: "24 meses",
  valor: -0.25,
  detalle: "25% x 24",
  comentarios: "No acumulable con otros descuentos",
  planes: [0, -0.25, -0.25, -0.25, -0.25, -0.25, -0.25],
};

const ajusteHijos: Row = {
  tipo: "Ajuste",
  descripcion: "Ajuste lista Hijos",
  zonas: "AMBA",
  duracion: "Permanente",
  categoria: "Obl",
  procedencia: "AMBA",
  plazoMax: "NA",
  valor: -0.45,
  detalle: "Ajuste lista Hijos",
  comentarios: "",
  planes: [0, -0.45, -0.45, -0.45, -0.45, -0.45, -0.45],
};

const descuentoFilial: Row = {
  tipo: "Ajuste",
  descripcion: "Descuento Filial",
  zonas: "",
  duracion: "Permanente",
  categoria: "Obl",
  procedencia: "Córdoba",
  plazoMax: "NA",
  valor: -0.1,
  detalle: "",
  comentarios: "",
  planes: [0, -0.1, -0.1, -0.1, -0.1, -0.1, -0.1],
};

const gaf: Row = {
  tipo: "GAF",
  descripcion: "PRESTADORES MEDIFE AMBA",
  zonas: "AMBA",
  duracion: "GAF",
  categoria: "NA",
  procedencia: "NA",
  plazoMax: "12 meses",
  valor: -0.15,
  detalle: "Val sobre valor final",
  comentarios: "",
  planes: [-0.15, -0.15, -0.15, -0.15, -0.15, -0.15, -0.15],
};

const gafSur: Row = { ...gaf, descripcion: "ACIPAN", zonas: "SUR" };

const dtoIndie: Row = {
  tipo: "Descuento Táctico",
  descripcion: "Dto Indie 18/25",
  zonas: "AMBA",
  duracion: "Temporales",
  categoria: "Obl",
  procedencia: "AMBA",
  plazoMax: "12 meses",
  valor: -0.185,
  detalle: "Indie 18/25",
  comentarios: "No Acumulable con Descuento Estratégico",
  planes: [-0.185, 0, 0, 0, 0, 0, 0],
};

const tipoDesconocido: Row = { ...gaf, tipo: "Bonificación Especial", descripcion: "Cosa Nueva", comentarios: "" };
const comentarioRaro: Row = { ...opcion5, descripcion: "Opción Rara", comentarios: "Habla con Marketing antes de aplicar" };

describe("parseDiscountPolicies", () => {
  it("clasifica Opción 4/5/6/7 correctamente", async () => {
    const buf = await buildWorkbook([opcion4, opcion5, opcion6, opcion7]);
    const { policies, report } = await parseDiscountPolicies(buf);
    expect(report.errors).toEqual([]);
    expect(policies).toHaveLength(4);

    const p4 = policies.find((p) => p.nombre === "Opción 4")!;
    expect(p4.grupo).toBe("estrategico");
    expect(p4.procedenciaGate).toBe("comprobable");
    expect(p4.requiereSlugPrefix).toBeNull();
    expect(p4.schedule).toEqual([{ seq: 1, valorPct: -0.2, months: 12 }]);

    const p5 = policies.find((p) => p.nombre === "Opción 5")!;
    expect(p5.concatenable).toBe(true);
    expect(p5.requiereSlugPrefix).toBeNull();

    const p6 = policies.find((p) => p.nombre === "Opción 6")!;
    expect(p6.requiereSlugPrefix).toBe("opcion-4");
    expect(p6.concatenable).toBe(true); // arranca recién cuando termina el plazo de Opción 4
    expect(p6.edadMaxTitularConyuge).toBe(60);
    // "Exclusivo Débito con TC" no se valida (el formulario no pide método de
    // pago) — se importa sin gate, sin generar warning (comportamiento esperado).
    expect(p6.procedenciaGate).toBe("");
    expect(report.warnings.some((w) => w.includes("Exclusivo Débito con TC"))).toBe(false);
    // Bug real: el Excel trae las 7 columnas de plan en 0 para Opción 6 pese
    // a tener valorPct propio — sin el respaldo, el descuento quedaría
    // seleccionable pero sin efecto. Debe aplicar a todos los planes salvo INDIE.
    expect(p6.planRules.find((r) => r.planCode === "INDIE")?.aplica).toBe(false);
    expect(p6.planRules.filter((r) => r.planCode !== "INDIE").every((r) => r.aplica)).toBe(true);
    expect(report.warnings.some((w) => w.includes("Opción 6") && w.includes("columnas de plan vinieron en 0"))).toBe(true);

    const p7 = policies.find((p) => p.nombre === "Opción 7")!;
    expect(p7.excluyeOtros).toBe(true);
    expect(p7.schedule).toEqual([{ seq: 1, valorPct: -0.25, months: 24 }]);
  });

  it("clasifica las 4 categorías automáticas (grupo='ajuste')", async () => {
    const segJoven29: Row = { ...ajusteHijos, descripcion: "Segmento Joven h/29", valor: -0.13 };
    const buf = await buildWorkbook([ajusteHijos, segJoven29, descuentoFilial]);
    const { policies } = await parseDiscountPolicies(buf);

    const hijos = policies.find((p) => p.nombre === "Ajuste lista Hijos")!;
    expect(hijos.grupo).toBe("ajuste");
    expect(hijos.categoriaEspecial).toBe("ajuste_hijos");

    const joven = policies.find((p) => p.nombre === "Segmento Joven h/29")!;
    expect(joven.categoriaEspecial).toBe("segmento_joven_h29");

    const filial = policies.find((p) => p.nombre === "Descuento Filial")!;
    expect(filial.categoriaEspecial).toBe("descuento_filial");
    // Zonas viene vacía en el Excel real para esta fila — se infiere Norte.
    expect(filial.region).toBe("Norte");
    expect(filial.zonaFilial).toBe("Córdoba");
  });

  it("GAF: procedenciaGate='GAF' y región SUR -> SurExt", async () => {
    const buf = await buildWorkbook([gaf, gafSur]);
    const { policies } = await parseDiscountPolicies(buf);
    expect(policies[0].procedenciaGate).toBe("GAF");
    expect(policies[0].region).toBe("AMBA");
    expect(policies[1].region).toBe("SurExt");
  });

  it("GAF: también respeta las reglas de combinación de Comentarios (no solo Estratégico/Táctico)", async () => {
    const gafNoAcumulable: Row = { ...gaf, descripcion: "GAF EXCLUSIVO", comentarios: "No acumulable con otros descuentos" };
    const gafConcatenable: Row = { ...gafSur, descripcion: "GAF CONCATENABLE", comentarios: "Concatenable con la opción 4" };
    const buf = await buildWorkbook([gafNoAcumulable, gafConcatenable]);
    const { policies } = await parseDiscountPolicies(buf);

    const p1 = policies.find((p) => p.nombre === "GAF EXCLUSIVO")!;
    expect(p1.excluyeOtros).toBe(true);

    const p2 = policies.find((p) => p.nombre === "GAF CONCATENABLE")!;
    expect(p2.requiereSlugPrefix).toBe("opcion-4");
    expect(p2.concatenable).toBe(true);
  });

  it("Dto Táctico con exclusión de grupo Estratégico", async () => {
    const buf = await buildWorkbook([dtoIndie]);
    const { policies } = await parseDiscountPolicies(buf);
    expect(policies[0].grupo).toBe("tactico");
    expect(policies[0].excluyeGrupo).toEqual(["estrategico"]);
    expect(policies[0].planRules.find((r) => r.planCode === "INDIE")?.aplica).toBe(true);
    expect(policies[0].planRules.find((r) => r.planCode === "PLATA")?.aplica).toBe(false);
  });

  it("Tipo desconocido y Comentarios no reconocidos generan warnings, sin bloquear la carga", async () => {
    const buf = await buildWorkbook([tipoDesconocido, comentarioRaro]);
    const { policies, report } = await parseDiscountPolicies(buf);
    expect(report.ok).toBe(true);
    expect(policies.find((p) => p.nombre === "Cosa Nueva")?.grupo).toBe("otro");
    expect(report.warnings.some((w) => w.includes("Tipo") && w.includes("no reconocido"))).toBe(true);
    expect(report.warnings.some((w) => w.includes("Opción Rara") && w.includes("no se pudo interpretar la regla"))).toBe(true);
    const rara = policies.find((p) => p.nombre === "Opción Rara")!;
    expect(rara.excluyeOtros).toBe(false);
    expect(rara.requiereSlugPrefix).toBeNull();
  });

  it("slugs quedan únicos dentro de la misma carga", async () => {
    const buf = await buildWorkbook([opcion4, { ...opcion4, categoria: "Vol", valor: -0.15, planes: [0, -0.15, -0.15, -0.15, -0.15, -0.15, -0.15] }]);
    const { policies } = await parseDiscountPolicies(buf);
    expect(new Set(policies.map((p) => p.slug)).size).toBe(2);
  });

  it("provincias en Descuento Filial se resuelven a la filial real (NOA)", async () => {
    const filialNoa: Row = { ...descuentoFilial, procedencia: "Tucumán, Salta y Jujuy" };
    const buf = await buildWorkbook([filialNoa]);
    const { policies, report } = await parseDiscountPolicies(buf, ["NOA", "Córdoba", "Santa Fe"]);
    expect(policies[0].zonaFilial).toBe("NOA");
    expect(report.warnings).toEqual([]);
  });

  it("CABA y COMAHUE en Zonas se resuelven a AMBA/Patagonia", async () => {
    const caba: Row = { ...gaf, zonas: "CABA" };
    const comahue: Row = { ...gaf, zonas: "COMAHUE", descripcion: "Algo en Comahue" };
    const buf = await buildWorkbook([caba, comahue]);
    const { policies } = await parseDiscountPolicies(buf);
    expect(policies[0].region).toBe("AMBA");
    expect(policies[1].region).toBe("Patagonia");
  });

  it("respeta Plazo Max también para GAF (antes se asumía siempre permanente)", async () => {
    const gafConPlazo: Row = { ...gaf, plazoMax: "12 meses" };
    const gafSinPlazo: Row = { ...gaf, descripcion: "GAF sin plazo", plazoMax: "NA" };
    const buf = await buildWorkbook([gafConPlazo, gafSinPlazo]);
    const { policies } = await parseDiscountPolicies(buf);
    const conPlazo = policies.find((p) => p.nombre === gaf.descripcion)!;
    expect(conPlazo.permanente).toBe(false);
    expect(conPlazo.plazoMeses).toBe(12);
    const sinPlazo = policies.find((p) => p.nombre === "GAF sin plazo")!;
    expect(sinPlazo.permanente).toBe(false);
    expect(sinPlazo.plazoMeses).toBeNull(); // sin plazo = sin fin de duración igual, aunque no sea "permanente"
  });

  it("GBA (sin sub-zona) en Procedencia no restringe la filial (equivale a AMBA)", async () => {
    const dtoGba: Row = { ...dtoIndie, descripcion: "Dto Mes 18/65_Oro", procedencia: "GBA", comentarios: "" };
    const buf = await buildWorkbook([dtoGba]);
    const { policies, report } = await parseDiscountPolicies(buf);
    expect(policies[0].zonaFilial).toBeNull();
    expect(report.warnings).toEqual([]);
  });

  it("CABA en Procedencia sigue siendo una filial puntual (no se pierde por ser también región)", async () => {
    const dtoCaba: Row = { ...dtoIndie, descripcion: "Dto Mes 36/65_Oro", procedencia: "CABA", comentarios: "" };
    const dtoGbaSur: Row = { ...dtoIndie, descripcion: "Dto Mes 36/40_Bronce", procedencia: "GBA Sur", comentarios: "" };
    const buf = await buildWorkbook([dtoCaba, dtoGbaSur]);
    const { policies, report } = await parseDiscountPolicies(buf, ["CABA", "GBA Sur", "GBA Oeste", "GBA Norte"]);
    expect(policies[0].zonaFilial).toBe("CABA");
    expect(policies[1].zonaFilial).toBe("GBA Sur");
    expect(report.warnings).toEqual([]);
  });

  it("hoja faltante produce error controlado", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Otra hoja");
    const buf = (await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer;
    const { policies, report } = await parseDiscountPolicies(buf);
    expect(policies).toEqual([]);
    expect(report.ok).toBe(false);
    expect(report.errors[0]).toContain("Políticas Comerciales");
  });
});
