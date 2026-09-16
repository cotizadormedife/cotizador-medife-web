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
  { code: "Corrientes", regionCode: "Norte", nombre: "Corrientes", sortOrder: 6 },
  { code: "Misiones", regionCode: "Norte", nombre: "Misiones", sortOrder: 7 },
  { code: "NOA", regionCode: "Norte", nombre: "NOA", sortOrder: 8 },
  { code: "Rosario", regionCode: "Norte", nombre: "Rosario", sortOrder: 9 },
  { code: "Santa Fe", regionCode: "Norte", nombre: "Santa Fe", sortOrder: 10 },
  { code: "Mendoza", regionCode: "Sur", nombre: "Mendoza", sortOrder: 11 },
  { code: "Mercedes", regionCode: "Sur", nombre: "Mercedes", sortOrder: 12 },
  { code: "San Juan", regionCode: "Sur", nombre: "San Juan", sortOrder: 13 },
  { code: "Comahue", regionCode: "Patagonia", nombre: "Comahue", sortOrder: 14 },
  { code: "Patagonia Norte", regionCode: "Patagonia", nombre: "Patagonia Norte", sortOrder: 15 },
  { code: "Patagonia Sur", regionCode: "Patagonia", nombre: "Patagonia Sur", sortOrder: 16 },
  { code: "Mar del Plata", regionCode: "Bahía/MDQ", nombre: "Mar del Plata", sortOrder: 17 },
  { code: "Bahía Blanca", regionCode: "Bahía/MDQ", nombre: "Bahía Blanca", sortOrder: 18 },
];

// Reproduce el layout real de la hoja "Info" que confirmó Diego: Región se
// repite en cada fila, y la filial de esa fila está en la columna "AMBA
// Dto del mes" (si Región="AMBA") o en "Interior" (cualquier otra región).
async function buildWorkbook(rows: Array<{ region: string; filial: string }>, opts?: { sheetName?: string; headerOverride?: string[] }): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet(opts?.sheetName ?? "Info");
  const header =
    opts?.headerOverride ??
    ["Dto", "Mes", "% dtos", "Categoria ", "Procedencia", "", "Gaf", "Producto", "Grupo familiar", "Región", "AMBA Dto del mes", "Interior"];
  sheet.addRow(header);
  for (const { region, filial } of rows) {
    const row = new Array(header.length).fill("");
    const regionCol = header.findIndex((h) => h.toUpperCase() === "REGIÓN" || h.toUpperCase() === "REGION");
    const ambaCol = header.findIndex((h) => h.toUpperCase().includes("AMBA"));
    const interiorCol = header.findIndex((h) => h.toUpperCase() === "INTERIOR");
    row[regionCol] = region;
    if (region.toUpperCase() === "AMBA") row[ambaCol] = filial;
    else row[interiorCol] = filial;
    sheet.addRow(row);
  }
  const buf = await wb.xlsx.writeBuffer();
  return buf as unknown as ArrayBuffer;
}

const DIEGO_EJEMPLO: Array<{ region: string; filial: string }> = [
  { region: "AMBA", filial: "GBA Sur" },
  { region: "AMBA", filial: "GBA Oeste" },
  { region: "AMBA", filial: "GBA Norte" },
  { region: "AMBA", filial: "CABA" },
  { region: "Norte", filial: "Córdoba" },
  { region: "Norte", filial: "Corrientes" },
  { region: "Norte", filial: "Misiones" },
  { region: "Norte", filial: "Noa" },
  { region: "Norte", filial: "Rosario" },
  { region: "Norte", filial: "Santa Fe" },
  { region: "Sur", filial: "Mendoza" },
  { region: "Sur", filial: "Mercedes" },
  { region: "Sur", filial: "San Juan" },
  { region: "Patagonia", filial: "Comahue" },
  { region: "Patagonia", filial: "Patagonia Norte" },
  { region: "Patagonia", filial: "Patagonia Sur" },
  { region: "Bahía/MDQ", filial: "Mar del Plata" },
  { region: "Bahía/MDQ", filial: "Bahía Blanca" },
  { region: "Bahía/MDQ", filial: "Tandil" },
];

describe("parseRegionesFiliales", () => {
  it("interpreta el ejemplo real de Diego: cada fila trae región + filial (AMBA o Interior según corresponda)", async () => {
    const buf = await buildWorkbook(DIEGO_EJEMPLO);
    const { regions, filiales, report } = await parseRegionesFiliales(buf, EXISTING_REGIONS, EXISTING_FILIALES);
    expect(report.errors).toEqual([]);
    expect(regions.map((r) => r.code)).toEqual(["AMBA", "Norte", "Sur", "Patagonia", "Bahía/MDQ"]);
    expect(filiales).toHaveLength(19);
    expect(filiales.find((f) => f.code === "GBA Sur")?.regionCode).toBe("AMBA");
    expect(filiales.find((f) => f.code === "Córdoba")?.regionCode).toBe("Norte");
    expect(filiales.find((f) => f.code === "Comahue")?.regionCode).toBe("Patagonia");
    // Tandil es nueva (no estaba en EXISTING_FILIALES) — se agrega igual, con warning.
    const tandil = filiales.find((f) => f.nombre === "Tandil");
    expect(tandil?.regionCode).toBe("Bahía/MDQ");
    expect(report.warnings.some((w) => w.includes("Tandil") && w.includes("nueva"))).toBe(true);
  });

  it("encuentra las columnas por encabezado aunque cambien de posición (Región movió de C a J en la realidad)", async () => {
    // Layout viejo: Región en la posición 3, no en la 10 — igual debe funcionar.
    const oldHeader = ["Dto", "Mes", "Región", "% dtos", "Categoria ", "Procedencia", "", "Gaf", "Producto", "Grupo familiar", "AMBA Dto del mes", "Interior"];
    const buf = await buildWorkbook([{ region: "AMBA", filial: "CABA" }], { headerOverride: oldHeader });
    const { regions, filiales, report } = await parseRegionesFiliales(buf, EXISTING_REGIONS, EXISTING_FILIALES);
    expect(report.errors).toEqual([]);
    expect(regions.map((r) => r.code)).toEqual(["AMBA"]);
    expect(filiales.map((f) => f.code)).toEqual(["CABA"]);
  });

  it("región no reconocida genera warning y se deja afuera, sin bloquear la carga", async () => {
    const buf = await buildWorkbook([
      { region: "AMBA", filial: "CABA" },
      { region: "Región Fantasma", filial: "Lugar Random" },
    ]);
    const { regions, filiales, report } = await parseRegionesFiliales(buf, EXISTING_REGIONS, EXISTING_FILIALES);
    expect(regions.map((r) => r.code)).toEqual(["AMBA"]);
    expect(filiales.map((f) => f.code)).toEqual(["CABA"]);
    expect(report.warnings.some((w) => w.includes("Región Fantasma"))).toBe(true);
  });

  it("columnas esperadas ausentes produce error controlado", async () => {
    const buf = await buildWorkbook([], { headerOverride: ["Dto", "Mes"] });
    const { regions, filiales, report } = await parseRegionesFiliales(buf, EXISTING_REGIONS, EXISTING_FILIALES);
    expect(regions).toEqual([]);
    expect(filiales).toEqual([]);
    expect(report.errors[0]).toContain("Región");
  });

  it("hoja faltante produce error controlado", async () => {
    const buf = await buildWorkbook([], { sheetName: "Otra hoja" });
    const { regions, filiales, report } = await parseRegionesFiliales(buf, EXISTING_REGIONS, EXISTING_FILIALES);
    expect(regions).toEqual([]);
    expect(filiales).toEqual([]);
    expect(report.errors[0]).toContain("Info");
  });
});
