import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseRegionesFiliales } from "./parseRegionesFiliales";

const EXISTING_REGIONS = [
  { code: "AMBA", nombre: "AMBA", sortOrder: 1 },
  { code: "Norte", nombre: "Norte", sortOrder: 2 },
  { code: "Sur", nombre: "Sur", sortOrder: 3 },
  { code: "Patagonia", nombre: "Patagonia", sortOrder: 4 },
  { code: "Bahía/MDQ", nombre: "Bahía/MDQ", sortOrder: 5 },
];

const EXISTING_FILIALES = [
  { code: "CABA", regionCode: "AMBA", nombre: "CABA", sortOrder: 1 },
  { code: "GBA Sur", regionCode: "AMBA", nombre: "GBA Sur", sortOrder: 2 },
  { code: "GBA Oeste", regionCode: "AMBA", nombre: "GBA Oeste", sortOrder: 3 },
  { code: "GBA Norte", regionCode: "AMBA", nombre: "GBA Norte", sortOrder: 4 },
  { code: "Córdoba", regionCode: "Norte", nombre: "Córdoba", sortOrder: 5 },
  { code: "Comahue", regionCode: "Patagonia", nombre: "Comahue", sortOrder: 6 },
  { code: "Mendoza", regionCode: "Sur", nombre: "Mendoza", sortOrder: 7 },
  { code: "Bahía Blanca", regionCode: "Bahía/MDQ", nombre: "Bahía Blanca", sortOrder: 8 },
];

async function buildWorkbook(opts: {
  regiones?: string[];
  ambaFiliales?: string[];
  interiorFiliales?: string[];
  sheetName?: string;
}): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet(opts.sheetName ?? "Info");
  const header = ["Dto", "Mes", "Región", "% dtos", "Categoria ", "Procedencia", "", "Gaf", "Producto", "Grupo familiar", "AMBA Dto del mes", "Interior"];
  sheet.addRow(header);
  const regiones = opts.regiones ?? [];
  const amba = opts.ambaFiliales ?? [];
  const interior = opts.interiorFiliales ?? [];
  const maxRows = Math.max(regiones.length, amba.length, interior.length);
  for (let i = 0; i < maxRows; i++) {
    const row = new Array(12).fill("");
    row[2] = regiones[i] ?? "";
    row[10] = amba[i] ?? "";
    row[11] = interior[i] ?? "";
    sheet.addRow(row);
  }
  const buf = await wb.xlsx.writeBuffer();
  return buf as unknown as ArrayBuffer;
}

describe("parseRegionesFiliales", () => {
  it("interpreta las 5 regiones y separa filiales AMBA/Interior por el catálogo real", async () => {
    const buf = await buildWorkbook({
      regiones: ["AMBA", "Norte", "Sur", "Patagonia", "Bahía/MDQ "],
      ambaFiliales: ["GBA Sur", "GBA Oeste", "GBA Norte", "CABA"],
      interiorFiliales: ["Comahue", "Córdoba", "Mendoza", "Bahía Blanca"],
    });
    const { regions, filiales, report } = await parseRegionesFiliales(buf, EXISTING_REGIONS, EXISTING_FILIALES);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(regions.map((r) => r.code).sort()).toEqual(["AMBA", "Bahía/MDQ", "Norte", "Patagonia", "Sur"].sort());
    expect(filiales.find((f) => f.code === "GBA Sur")?.regionCode).toBe("AMBA");
    expect(filiales.find((f) => f.code === "Comahue")?.regionCode).toBe("Patagonia");
    expect(filiales.find((f) => f.code === "Mendoza")?.regionCode).toBe("Sur");
    expect(filiales.find((f) => f.code === "Bahía Blanca")?.regionCode).toBe("Bahía/MDQ");
  });

  it("nombres no reconocidos generan warning y quedan afuera, sin bloquear la carga", async () => {
    const buf = await buildWorkbook({
      regiones: ["AMBA", "Región Fantasma"],
      ambaFiliales: ["CABA"],
      interiorFiliales: ["Filial Inventada"],
    });
    const { regions, filiales, report } = await parseRegionesFiliales(buf, EXISTING_REGIONS, EXISTING_FILIALES);
    expect(regions.map((r) => r.code)).toEqual(["AMBA"]);
    expect(filiales.map((f) => f.code)).toEqual(["CABA"]);
    expect(report.warnings.some((w) => w.includes("Región Fantasma"))).toBe(true);
    expect(report.warnings.some((w) => w.includes("Filial Inventada"))).toBe(true);
  });

  it("hoja faltante produce error controlado", async () => {
    const buf = await buildWorkbook({ sheetName: "Otra hoja" });
    const { regions, filiales, report } = await parseRegionesFiliales(buf, EXISTING_REGIONS, EXISTING_FILIALES);
    expect(regions).toEqual([]);
    expect(filiales).toEqual([]);
    expect(report.errors[0]).toContain("Info");
  });
});
