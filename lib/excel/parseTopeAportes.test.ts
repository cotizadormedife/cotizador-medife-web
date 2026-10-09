import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseTopeAportes } from "./parseTopeAportes";

async function buildWorkbook(opts: { hoja?: string | null; filas?: Array<[unknown, unknown]> }): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  if (opts.hoja !== null) {
    const sheet = wb.addWorksheet(opts.hoja ?? "C aux");
    for (const [a, b] of opts.filas ?? []) sheet.addRow([a, b]);
  } else {
    wb.addWorksheet("Otra hoja");
  }
  return (await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer;
}

describe("parseTopeAportes", () => {
  it("lee el tope de la fila 'Tope de remuneración para aportes' (columna B)", async () => {
    const buf = await buildWorkbook({
      filas: [
        ["REGIONES", "LISTA"],
        ["Fecha de Ultima actualizacion", "2026-07-01"],
        ["Tope de remuneración para aportes", 4691748.47],
      ],
    });
    const r = await parseTopeAportes(buf);
    expect(r.tope).toBe(4691748.47);
    expect(r.warnings).toEqual([]);
  });

  it("reconoce la etiqueta sin tilde y con otras mayúsculas", async () => {
    const buf = await buildWorkbook({ filas: [["TOPE DE REMUNERACION PARA APORTES", 4771508]] });
    expect((await parseTopeAportes(buf)).tope).toBe(4771508);
  });

  it("si el valor es el resultado de una fórmula, usa ese resultado", async () => {
    const buf = await buildWorkbook({ filas: [["Tope de remuneración para aportes", { formula: "4500000*1.06", result: 4770000 }]] });
    expect((await parseTopeAportes(buf)).tope).toBe(4770000);
  });

  it("sin la hoja 'C aux': no inventa un tope y avisa", async () => {
    const r = await parseTopeAportes(await buildWorkbook({ hoja: null }));
    expect(r.tope).toBeNull();
    expect(r.warnings.some((w) => w.includes("C aux"))).toBe(true);
  });

  it("sin la fila del tope: no inventa un tope y avisa", async () => {
    const r = await parseTopeAportes(await buildWorkbook({ filas: [["REGIONES", "LISTA"]] }));
    expect(r.tope).toBeNull();
    expect(r.warnings.some((w) => w.includes("Tope de remuneración para aportes"))).toBe(true);
  });

  it("un valor que no parece un monto (texto, 0 o una fecha corrida) se rechaza con aviso", async () => {
    for (const malo of ["n/d", 0, 25694.55, 4691748470000]) {
      const r = await parseTopeAportes(await buildWorkbook({ filas: [["Tope de remuneración para aportes", malo]] }));
      expect(r.tope).toBeNull();
      expect(r.warnings.length).toBe(1);
    }
  });
});
