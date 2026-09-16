import ExcelJS from "exceljs";

// M9 (corregido): la hoja "Info" tiene 3 columnas relacionadas por fila —
// "Región" (repetida tantas veces como filiales tenga), "AMBA Dto del mes"
// e "Interior". Por cada fila con una Región: si es "AMBA", la filial de
// esa fila está en la columna "AMBA Dto del mes"; si es cualquier otra
// región, está en "Interior" — en la misma fila. El Excel da la región de
// cada filial con certeza, no hace falta inferirla del catálogo.
//
// Las columnas se ubican por el texto de su encabezado (fila 1), no por
// posición fija — la hoja real ya cambió de layout una vez (Región pasó de
// la columna C a la J) y una posición hardcodeada se rompe en silencio
// cada vez que eso vuelve a pasar.

export type ParsedRegion = { code: string; nombre: string; sortOrder: number };
export type ParsedFilial = { code: string; regionCode: string; nombre: string; sortOrder: number };

export type GeoParseReport = { warnings: string[]; errors: string[] };
export type GeoParseResult = { regions: ParsedRegion[]; filiales: ParsedFilial[]; report: GeoParseReport };

const HEADER_ROW = 1;
const FIRST_DATA_ROW = 2;

function norm(raw: unknown): string {
  return String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function upper(raw: unknown): string {
  return norm(raw).toUpperCase();
}

function foldAccents(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function sameName(a: string, b: string): boolean {
  return foldAccents(a) === foldAccents(b);
}

function cellText(cell: ExcelJS.Cell): string {
  const v: any = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "richText" in v) return v.richText.map((t: any) => t.text).join("");
  if (typeof v === "object" && "result" in v) return String(v.result ?? "");
  return String(v);
}

function findColumn(sheet: ExcelJS.Worksheet, predicate: (headerUpper: string) => boolean): number | null {
  const header = sheet.getRow(HEADER_ROW);
  for (let c = 1; c <= sheet.columnCount; c++) {
    if (predicate(upper(cellText(header.getCell(c))))) return c;
  }
  return null;
}

export async function parseRegionesFiliales(
  buffer: ArrayBuffer,
  existingRegions: { code: string; nombre: string; sortOrder: number }[] = [],
  existingFiliales: { code: string; regionCode: string; nombre: string; sortOrder: number }[] = []
): Promise<GeoParseResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.getWorksheet("Info");
  if (!sheet) {
    return { regions: [], filiales: [], report: { warnings, errors: ['No se encontró la hoja "Info" en el archivo.'] } };
  }

  const colRegion = findColumn(sheet, (h) => h === "REGIÓN" || h === "REGION");
  const colAmba = findColumn(sheet, (h) => h.includes("AMBA"));
  const colInterior = findColumn(sheet, (h) => h === "INTERIOR");
  if (!colRegion || !colAmba || !colInterior) {
    return {
      regions: [],
      filiales: [],
      report: {
        warnings,
        errors: [
          'No se encontraron en la hoja "Info" las 3 columnas esperadas ("Región", "AMBA Dto del mes", "Interior") — revisar los encabezados de la fila 1.',
        ],
      },
    };
  }

  const regionsByCode = new Map<string, ParsedRegion>();
  const filiales: ParsedFilial[] = [];
  let filialSortOrder = 0;

  for (let r = FIRST_DATA_ROW; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const regionRaw = norm(cellText(row.getCell(colRegion)));
    if (!regionRaw) continue;

    const regionMatch = existingRegions.find((er) => sameName(er.nombre, regionRaw) || sameName(er.code, regionRaw));
    if (!regionMatch) {
      warnings.push(`"Info" fila ${r}: la región "${regionRaw}" no coincide con ninguna región conocida — se dejó afuera de esta carga, revisar.`);
      continue;
    }
    if (!regionsByCode.has(regionMatch.code)) {
      regionsByCode.set(regionMatch.code, { code: regionMatch.code, nombre: regionMatch.nombre, sortOrder: regionsByCode.size + 1 });
    }

    const isAmba = sameName(regionMatch.code, "AMBA");
    const filialRaw = norm(cellText(row.getCell(isAmba ? colAmba : colInterior)));
    if (!filialRaw) continue;

    const filialMatch = existingFiliales.find((ef) => sameName(ef.nombre, filialRaw) || sameName(ef.code, filialRaw));
    filialSortOrder += 1;
    if (filialMatch) {
      filiales.push({ code: filialMatch.code, regionCode: regionMatch.code, nombre: filialMatch.nombre, sortOrder: filialSortOrder });
    } else {
      // Filial nueva: a diferencia de antes, acá la región viene confirmada
      // por el propio Excel (no hay que adivinarla) — se agrega igual, y se
      // avisa para que quede claro que es la primera vez que aparece.
      filiales.push({ code: filialRaw, regionCode: regionMatch.code, nombre: filialRaw, sortOrder: filialSortOrder });
      warnings.push(`"Info" fila ${r}: la filial "${filialRaw}" (región ${regionMatch.code}) es nueva — no estaba en el catálogo, se agregó.`);
    }
  }

  const regions = Array.from(regionsByCode.values());
  if (regions.length === 0) {
    errors.push('No se interpretó ninguna región en la hoja "Info".');
  }
  if (filiales.length === 0) {
    errors.push('No se interpretó ninguna filial en la hoja "Info".');
  }

  return { regions, filiales, report: { warnings, errors } };
}
