import ExcelJS from "exceljs";
import { matchesPlanName } from "../pricing/planMatch";
import type { PlanRef } from "../pricing/types";

export type ParsedPriceRow = {
  regionCode: string;
  categoria: "Obl" | "Vol";
  ageBracketCode: string;
  planCode: string;
  monto: number;
};

export type ParseReport = {
  ok: boolean;
  totalCells: number;
  warnings: string[];
  errors: string[];
  regionsParsed: string[];
};

export type ParseResult = {
  prices: ParsedPriceRow[];
  report: ParseReport;
};

const REGION_BLOCKS: Array<{ region: string; rowStart: number; rowEnd: number; isAMBA: boolean }> = [
  { region: "AMBA", rowStart: 12, rowEnd: 31, isAMBA: true },
  { region: "Norte", rowStart: 38, rowEnd: 59, isAMBA: false },
  { region: "Sur", rowStart: 66, rowEnd: 87, isAMBA: false },
  { region: "Patagonia", rowStart: 94, rowEnd: 115, isAMBA: false },
  { region: "Bahía/MDQ", rowStart: 122, rowEnd: 143, isAMBA: false },
];

const COL_LABEL = 4; // D
const COL_OBL_START = 5; // E..K (7 cols)
const COL_VOL_START = 14; // N..T (7 cols)

const TITULAR_MAP: Record<string, string> = {
  "TITULAR 00-25": "0-25",
  "TITULAR 26-35": "26-35",
  "TITULAR 36-40": "36-40",
  "TITULAR 41-50": "41-50",
  "TITULAR 51-60": "51-60",
  "TITULAR L 61-65": "61-65",
  "TITULAR 66-00": "66-00",
};
const ESPOSO_MAP: Record<string, string> = {
  "ESPOSO (A) 00-25": "MAT-0-25",
  "ESPOSO (A) 26-35": "MAT-26-35",
  "ESPOSO (A) 36-40": "MAT-36-40",
  "ESPOSO (A) 41-50": "MAT-41-50",
  "ESPOSO (A) 51-60": "MAT-51-60",
  "ESPOSO (A) 61-65": "MAT-61-65",
  "ESPOSO (A) 66-00": "MAT-66-00",
};
// AMBA: una sola fila combinada "21 a 29" que se duplica en dos tramos DB.
const AMBA_HIJO_MAP: Record<string, string[]> = {
  "HIJO (0 A 1)": ["HIJO-0-1"],
  "HIJO (2 A 20)": ["HIJO-2-20"],
  "HIJO AD. (21 A 29)": ["HIJO-21-25", "HIJO-26-29"],
  "HIJO AD. (30 A 39)": ["HIJO-30-39"],
  "HIJO AD. (40 A 49)": ["HIJO-40-49"],
};

function normalizeLabel(raw: unknown): string {
  return String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function cellNumber(cell: ExcelJS.Cell): number {
  const v: any = cell.value;
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Math.round(v);
  if (typeof v === "object" && "result" in v) {
    const r = v.result;
    return typeof r === "number" ? Math.round(r) : 0;
  }
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : Math.round(n);
}

type RowN = { obl: number[]; vol: number[] };

// M13: hasta ahora las columnas de precio por plan eran 7, en posición fija
// (E-K Obligatorio, N-T Voluntario) y se les asignaba el plan por índice de
// un array hardcodeado — a pedido de Diego, la cantidad y el orden de los
// planes puede cambiar de una lista a otra, y "Resumen LP" ya trae, en la
// fila justo arriba de la categoría "Obl"/"Vol" (fila 4 hoy), el nombre de
// cada plan como encabezado — se busca esa fila por contenido, no por
// posición fija (la hoja ya movió columnas una vez, con Región en M9).
function findPlanColumnBlocks(
  sheet: ExcelJS.Worksheet,
  searchUpToRow: number
): { headerRow: number; oblCols: number[]; volCols: number[] } | null {
  for (let r = 1; r <= searchUpToRow; r++) {
    const row = sheet.getRow(r);
    if (normalizeLabel(row.getCell(COL_OBL_START).value) !== "OBL") continue;

    const oblCols: number[] = [];
    let c = COL_OBL_START;
    while (normalizeLabel(row.getCell(c).value) === "OBL") {
      oblCols.push(c);
      c++;
    }
    const maxGap = c + 10;
    while (c < maxGap && !normalizeLabel(row.getCell(c).value)) c++;
    const volCols: number[] = [];
    while (normalizeLabel(row.getCell(c).value) === "VOL") {
      volCols.push(c);
      c++;
    }
    if (oblCols.length > 0 && volCols.length > 0) return { headerRow: r + 1, oblCols, volCols };
  }
  return null;
}

// Para cada plan de la lista (en el orden real de "Info"!Producto), ubica
// su columna dentro del bloque Obl/Vol matcheando el nombre del plan contra
// el texto del encabezado — no por posición.
function mapPlanesToColumns(
  sheet: ExcelJS.Worksheet,
  headerRow: number,
  cols: number[],
  planes: PlanRef[],
  warnings: string[],
  blockLabel: string
): number[] {
  const header = sheet.getRow(headerRow);
  return planes.map((plan) => {
    const col = cols.find((c) => matchesPlanName(String(header.getCell(c).value ?? ""), plan.nombre));
    if (col == null) {
      warnings.push(`"Resumen LP" (${blockLabel}): no se encontró la columna del plan "${plan.nombre}" — se completó con $0 para ese plan.`);
    }
    return col ?? -1;
  });
}

function readBlockRows(
  sheet: ExcelJS.Worksheet,
  rowStart: number,
  rowEnd: number,
  oblColByPlan: number[],
  volColByPlan: number[]
): Map<string, RowN> {
  const table = new Map<string, RowN>();
  for (let r = rowStart; r <= rowEnd; r++) {
    const row = sheet.getRow(r);
    const label = normalizeLabel(row.getCell(COL_LABEL).value);
    if (!label) continue;
    const obl = oblColByPlan.map((c) => (c < 0 ? 0 : cellNumber(row.getCell(c))));
    const vol = volColByPlan.map((c) => (c < 0 ? 0 : cellNumber(row.getCell(c))));
    table.set(label, { obl, vol });
  }
  return table;
}

function pushPlanRows(
  out: ParsedPriceRow[],
  region: string,
  ageBracketCode: string,
  row: RowN | undefined,
  warnings: string[],
  sourceLabel: string,
  planes: PlanRef[]
) {
  if (!row) {
    warnings.push(`${region}: no se encontró la fila "${sourceLabel}" — se omite ${ageBracketCode}.`);
    return;
  }
  planes.forEach((plan, i) => {
    out.push({ regionCode: region, categoria: "Obl", ageBracketCode, planCode: plan.code, monto: row.obl[i] });
    out.push({ regionCode: region, categoria: "Vol", ageBracketCode, planCode: plan.code, monto: row.vol[i] });
  });
}

// Combina una fila base con el valor de MEDIFÉ+ de otra fila — espejo exacto
// del truco "merge" del importador legacy para el interior. El índice de
// MEDIFÉ+ ya no es fijo (era el 1 en el array de 7 planes) — se ubica por
// nombre dentro de la lista de planes de esta versión.
function mergeMedifePlus(base: RowN | undefined, medifePlusSource: RowN | undefined | null, medifePlusIdx: number): RowN | undefined {
  if (!base) return undefined;
  const obl = base.obl.slice();
  const vol = base.vol.slice();
  if (medifePlusIdx >= 0) {
    obl[medifePlusIdx] = medifePlusSource ? medifePlusSource.obl[medifePlusIdx] : 0;
    vol[medifePlusIdx] = medifePlusSource ? medifePlusSource.vol[medifePlusIdx] : 0;
  }
  return { obl, vol };
}

export async function parsePriceList(buffer: ArrayBuffer, planes: PlanRef[]): Promise<ParseResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const prices: ParsedPriceRow[] = [];
  const regionsParsed: string[] = [];

  if (planes.length === 0) {
    return {
      prices: [],
      report: { ok: false, totalCells: 0, warnings, errors: ["No hay planes para cargar precios — revisar la columna \"Producto\" de la hoja \"Info\"."], regionsParsed: [] },
    };
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.getWorksheet("Resumen LP");
  if (!sheet) {
    return {
      prices: [],
      report: { ok: false, totalCells: 0, warnings, errors: ['No se encontró la hoja "Resumen LP" en el archivo.'], regionsParsed: [] },
    };
  }

  const blocks = findPlanColumnBlocks(sheet, REGION_BLOCKS[0].rowStart - 1);
  if (!blocks) {
    return {
      prices: [],
      report: {
        ok: false,
        totalCells: 0,
        warnings,
        errors: ['No se encontraron en "Resumen LP" las columnas "Obl"/"Vol" con los encabezados de plan arriba de la primera región — revisar el layout de la hoja.'],
        regionsParsed: [],
      },
    };
  }
  const oblColByPlan = mapPlanesToColumns(sheet, blocks.headerRow, blocks.oblCols, planes, warnings, "Obligatorio");
  const volColByPlan = mapPlanesToColumns(sheet, blocks.headerRow, blocks.volCols, planes, warnings, "Voluntario");
  const medifePlusIdx = planes.findIndex((p) => matchesPlanName(p.nombre, "MEDIFÉ+"));

  for (const block of REGION_BLOCKS) {
    const table = readBlockRows(sheet, block.rowStart, block.rowEnd, oblColByPlan, volColByPlan);

    Object.entries(TITULAR_MAP).forEach(([label, code]) => {
      pushPlanRows(prices, block.region, code, table.get(label), warnings, label, planes);
    });
    Object.entries(ESPOSO_MAP).forEach(([label, code]) => {
      pushPlanRows(prices, block.region, code, table.get(label), warnings, label, planes);
    });

    if (block.isAMBA) {
      Object.entries(AMBA_HIJO_MAP).forEach(([label, codes]) => {
        const row = table.get(label);
        codes.forEach((code) => pushPlanRows(prices, block.region, code, row, warnings, label, planes));
      });
      pushPlanRows(prices, block.region, "FAM", table.get("FAMILIAR A CARGO"), warnings, "FAMILIAR A CARGO", planes);
    } else {
      const h1 = table.get("HIJO 1");
      const h2 = table.get("HIJO 2");
      const hmac = table.get("HIJO MAYOR A CARGO");
      const h03 = table.get("HIJO 0 A 3");
      const h420 = table.get("HIJO 4 A 20");
      const h2125 = table.get("HIJO 21 A 25");
      const h2629 = table.get("HIJO 26 A 29");
      const fam = table.get("FAMILIAR A CARGO");

      // Las filas "HIJO 21 A 25" / "HIJO 26 A 29" del Excel fuente solo traen
      // un valor real en la columna MEDIFÉ+ (el resto está en blanco) — el
      // resto de los planes toma como base otra fila (HIJO 2 / HIJO MAYOR A
      // CARGO), igual que el resto de las columnas "AD." de esta hoja.
      pushPlanRows(prices, block.region, "HIJO-0-1", mergeMedifePlus(h1, h03, medifePlusIdx), warnings, "HIJO 1 / HIJO 0 A 3", planes);
      pushPlanRows(prices, block.region, "HIJO-2-20", mergeMedifePlus(h2, h420, medifePlusIdx), warnings, "HIJO 2 / HIJO 4 A 20", planes);
      pushPlanRows(prices, block.region, "HIJO-21-25", mergeMedifePlus(h2, h2125, medifePlusIdx), warnings, "HIJO 2 / HIJO 21 A 25", planes);
      pushPlanRows(prices, block.region, "HIJO-26-29", mergeMedifePlus(hmac, h2629, medifePlusIdx), warnings, "HIJO MAYOR A CARGO / HIJO 26 A 29", planes);
      pushPlanRows(prices, block.region, "HIJO-30-39", mergeMedifePlus(hmac, null, medifePlusIdx), warnings, "HIJO MAYOR A CARGO", planes);
      pushPlanRows(prices, block.region, "HIJO-40-49", mergeMedifePlus(hmac, null, medifePlusIdx), warnings, "HIJO MAYOR A CARGO", planes);
      pushPlanRows(prices, block.region, "FAM", fam, warnings, "FAMILIAR A CARGO", planes);
    }

    regionsParsed.push(block.region);
  }

  // 5 regiones × 2 categorías × 21 tramos × N planes celdas esperadas
  const expected = REGION_BLOCKS.length * 2 * 21 * planes.length;
  if (prices.length !== expected) {
    warnings.push(`Se esperaban ${expected} celdas y se generaron ${prices.length}.`);
  }

  return {
    prices,
    report: { ok: errors.length === 0, totalCells: prices.length, warnings, errors, regionsParsed },
  };
}
