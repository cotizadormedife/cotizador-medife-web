import ExcelJS from "exceljs";
import { PLANES } from "@/lib/pricing/types";

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

type Row7 = { obl: number[]; vol: number[] };

function readBlockRows(sheet: ExcelJS.Worksheet, rowStart: number, rowEnd: number): Map<string, Row7> {
  const table = new Map<string, Row7>();
  for (let r = rowStart; r <= rowEnd; r++) {
    const row = sheet.getRow(r);
    const label = normalizeLabel(row.getCell(COL_LABEL).value);
    if (!label) continue;
    const obl: number[] = [];
    const vol: number[] = [];
    for (let i = 0; i < 7; i++) {
      obl.push(cellNumber(row.getCell(COL_OBL_START + i)));
      vol.push(cellNumber(row.getCell(COL_VOL_START + i)));
    }
    table.set(label, { obl, vol });
  }
  return table;
}

function pushPlanRows(
  out: ParsedPriceRow[],
  region: string,
  ageBracketCode: string,
  row: Row7 | undefined,
  warnings: string[],
  sourceLabel: string
) {
  if (!row) {
    warnings.push(`${region}: no se encontró la fila "${sourceLabel}" — se omite ${ageBracketCode}.`);
    return;
  }
  PLANES.forEach((planCode, i) => {
    out.push({ regionCode: region, categoria: "Obl", ageBracketCode, planCode, monto: row.obl[i] });
    out.push({ regionCode: region, categoria: "Vol", ageBracketCode, planCode, monto: row.vol[i] });
  });
}

// Combina una fila base con el valor de MEDIFÉ+ (índice 1) de otra fila —
// espejo exacto del truco "merge" del importador legacy para el interior.
function mergeMedifePlus(base: Row7 | undefined, medifePlusSource: Row7 | undefined | null): Row7 | undefined {
  if (!base) return undefined;
  const obl = base.obl.slice();
  const vol = base.vol.slice();
  obl[1] = medifePlusSource ? medifePlusSource.obl[1] : 0;
  vol[1] = medifePlusSource ? medifePlusSource.vol[1] : 0;
  return { obl, vol };
}

export async function parsePriceList(buffer: ArrayBuffer): Promise<ParseResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const prices: ParsedPriceRow[] = [];
  const regionsParsed: string[] = [];

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.getWorksheet("Resumen LP");
  if (!sheet) {
    return {
      prices: [],
      report: { ok: false, totalCells: 0, warnings, errors: ['No se encontró la hoja "Resumen LP" en el archivo.'], regionsParsed: [] },
    };
  }

  for (const block of REGION_BLOCKS) {
    const table = readBlockRows(sheet, block.rowStart, block.rowEnd);

    Object.entries(TITULAR_MAP).forEach(([label, code]) => {
      pushPlanRows(prices, block.region, code, table.get(label), warnings, label);
    });
    Object.entries(ESPOSO_MAP).forEach(([label, code]) => {
      pushPlanRows(prices, block.region, code, table.get(label), warnings, label);
    });

    if (block.isAMBA) {
      Object.entries(AMBA_HIJO_MAP).forEach(([label, codes]) => {
        const row = table.get(label);
        codes.forEach((code) => pushPlanRows(prices, block.region, code, row, warnings, label));
      });
      pushPlanRows(prices, block.region, "FAM", table.get("FAMILIAR A CARGO"), warnings, "FAMILIAR A CARGO");
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
      pushPlanRows(prices, block.region, "HIJO-0-1", mergeMedifePlus(h1, h03), warnings, "HIJO 1 / HIJO 0 A 3");
      pushPlanRows(prices, block.region, "HIJO-2-20", mergeMedifePlus(h2, h420), warnings, "HIJO 2 / HIJO 4 A 20");
      pushPlanRows(prices, block.region, "HIJO-21-25", mergeMedifePlus(h2, h2125), warnings, "HIJO 2 / HIJO 21 A 25");
      pushPlanRows(prices, block.region, "HIJO-26-29", mergeMedifePlus(hmac, h2629), warnings, "HIJO MAYOR A CARGO / HIJO 26 A 29");
      pushPlanRows(prices, block.region, "HIJO-30-39", mergeMedifePlus(hmac, null), warnings, "HIJO MAYOR A CARGO");
      pushPlanRows(prices, block.region, "HIJO-40-49", mergeMedifePlus(hmac, null), warnings, "HIJO MAYOR A CARGO");
      pushPlanRows(prices, block.region, "FAM", fam, warnings, "FAMILIAR A CARGO");
    }

    regionsParsed.push(block.region);
  }

  // 5 regiones × 2 categorías × 21 tramos × 7 planes = 1470 celdas esperadas
  const expected = REGION_BLOCKS.length * 2 * 21 * 7;
  if (prices.length !== expected) {
    warnings.push(`Se esperaban ${expected} celdas y se generaron ${prices.length}.`);
  }

  return {
    prices,
    report: { ok: errors.length === 0, totalCells: prices.length, warnings, errors, regionsParsed },
  };
}
