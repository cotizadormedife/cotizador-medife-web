import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parsePriceList } from "./parsePriceList";
import type { PlanRef } from "../pricing/types";

// El orden de "planes" (el que viene de "Info"!Producto para esta versión)
// se pasa deliberadamente DISTINTO del orden real de las columnas en
// "Resumen LP" (E=PLATA, F=BRONCE C., G=INDIE) — así el test prueba que el
// importador matchea por nombre de encabezado, no por posición/índice.
const TEST_PLANES: PlanRef[] = [
  { code: "INDIE", nombre: "INDIE", sortOrder: 1 },
  { code: "PLATA", nombre: "PLATA", sortOrder: 2 },
  { code: "BRONCE_C", nombre: "BRONCE C.", sortOrder: 3 },
];

const COL_LABEL = 4; // D
const COL_OBL_START = 5; // E
const COL_VOL_START = 14; // N
const AMBA_ROW_START = 12;

// Encabezados reales: fila de categoría "Obl"/"Vol" y, debajo, la fila con
// el nombre de cada plan — en el orden real de las columnas, NO el de
// TEST_PLANES.
function writeHeaders(sheet: ExcelJS.Worksheet, planNamesInColumnOrder: string[]) {
  const catRow = sheet.getRow(3);
  const nameRow = sheet.getRow(4);
  planNamesInColumnOrder.forEach((name, i) => {
    catRow.getCell(COL_OBL_START + i).value = "Obl";
    catRow.getCell(COL_VOL_START + i).value = "Vol";
    nameRow.getCell(COL_OBL_START + i).value = name;
    nameRow.getCell(COL_VOL_START + i).value = name;
  });
}

function writeAmbaRow(sheet: ExcelJS.Worksheet, rowOffset: number, label: string, oblValues: number[], volValues: number[]) {
  const row = sheet.getRow(AMBA_ROW_START + rowOffset);
  row.getCell(COL_LABEL).value = label;
  oblValues.forEach((v, i) => (row.getCell(COL_OBL_START + i).value = v));
  volValues.forEach((v, i) => (row.getCell(COL_VOL_START + i).value = v));
}

async function buildWorkbook(planNamesInColumnOrder: string[], rows: Array<{ label: string; obl: number[]; vol: number[] }>): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Resumen LP");
  writeHeaders(sheet, planNamesInColumnOrder);
  rows.forEach((r, i) => writeAmbaRow(sheet, i, r.label, r.obl, r.vol));
  const buf = await wb.xlsx.writeBuffer();
  return buf as unknown as ArrayBuffer;
}

describe("parsePriceList", () => {
  it("matchea las columnas por el nombre del plan en el encabezado, no por posición — aunque el orden de planes difiera del de las columnas", async () => {
    // Columnas reales: E=PLATA, F=BRONCE C., G=INDIE.
    const buf = await buildWorkbook(
      ["PLATA", "BRONCE C.", "INDIE"],
      [{ label: "TITULAR 00-25", obl: [100, 200, 300], vol: [1000, 2000, 3000] }]
    );
    const { prices, report } = await parsePriceList(buf, TEST_PLANES);
    expect(report.errors).toEqual([]);

    const row = (planCode: string, categoria: "Obl" | "Vol") => prices.find((p) => p.regionCode === "AMBA" && p.ageBracketCode === "0-25" && p.planCode === planCode && p.categoria === categoria);

    expect(row("PLATA", "Obl")?.monto).toBe(100);
    expect(row("BRONCE_C", "Obl")?.monto).toBe(200);
    expect(row("INDIE", "Obl")?.monto).toBe(300);
    expect(row("PLATA", "Vol")?.monto).toBe(1000);
    expect(row("BRONCE_C", "Vol")?.monto).toBe(2000);
    expect(row("INDIE", "Vol")?.monto).toBe(3000);
  });

  it("un plan sin columna en el Excel completa con $0 y avisa, sin bloquear el resto", async () => {
    const planesConUnoFaltante: PlanRef[] = [...TEST_PLANES, { code: "ORO", nombre: "ORO", sortOrder: 4 }];
    const buf = await buildWorkbook(
      ["PLATA", "BRONCE C.", "INDIE"],
      [{ label: "TITULAR 00-25", obl: [100, 200, 300], vol: [1000, 2000, 3000] }]
    );
    const { prices, report } = await parsePriceList(buf, planesConUnoFaltante);
    expect(report.errors).toEqual([]);
    expect(report.warnings.some((w) => w.includes('no se encontró la columna del plan "ORO"'))).toBe(true);

    const oro = prices.find((p) => p.regionCode === "AMBA" && p.ageBracketCode === "0-25" && p.planCode === "ORO" && p.categoria === "Obl");
    expect(oro?.monto).toBe(0);
    // Los planes que sí matchean no se ven afectados por el plan faltante.
    const plata = prices.find((p) => p.regionCode === "AMBA" && p.ageBracketCode === "0-25" && p.planCode === "PLATA" && p.categoria === "Obl");
    expect(plata?.monto).toBe(100);
  });

  it("sin planes (columna Producto vacía en Info) devuelve error controlado sin intentar leer el Excel", async () => {
    const buf = await buildWorkbook(["PLATA"], []);
    const { prices, report } = await parsePriceList(buf, []);
    expect(prices).toEqual([]);
    expect(report.ok).toBe(false);
    expect(report.errors[0]).toContain("planes");
  });

  it('hoja "Resumen LP" faltante produce error controlado', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Otra hoja");
    const buf = (await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer;
    const { prices, report } = await parsePriceList(buf, TEST_PLANES);
    expect(prices).toEqual([]);
    expect(report.errors[0]).toContain("Resumen LP");
  });

  it('sin encabezados "Obl"/"Vol" reconocibles produce error controlado', async () => {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("Resumen LP");
    sheet.getRow(3).getCell(COL_LABEL).value = "nada relevante";
    const buf = (await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer;
    const { prices, report } = await parsePriceList(buf, TEST_PLANES);
    expect(prices).toEqual([]);
    expect(report.errors[0]).toContain("Obl");
  });
});
