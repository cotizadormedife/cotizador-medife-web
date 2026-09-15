import ExcelJS from "exceljs";

// M9: la hoja "Info" es la fuente de qué regiones y filiales trae esta
// carga — columna "Región" para las 5 regiones, columnas "AMBA Dto del
// mes" / "Interior" para las filiales. La hoja no dice a cuál de las 4
// regiones no-AMBA pertenece cada filial del interior (vienen todas
// juntas) — por eso cada nombre se valida contra el catálogo real
// (`existingRegions`/`existingFiliales`, ya correcto y estable) y hereda
// de ahí su región puntual; un nombre nuevo que no matchea se avisa y se
// deja afuera del snapshot de esta carga.

export type ParsedRegion = { code: string; nombre: string; sortOrder: number };
export type ParsedFilial = { code: string; regionCode: string; nombre: string; sortOrder: number };

export type GeoParseReport = { warnings: string[]; errors: string[] };
export type GeoParseResult = { regions: ParsedRegion[]; filiales: ParsedFilial[]; report: GeoParseReport };

const COL_REGION = 3; // C
const COL_AMBA_FILIALES = 11; // K
const COL_INTERIOR_FILIALES = 12; // L
const FIRST_DATA_ROW = 2;
const MAX_SCAN_ROWS = 60;

function norm(raw: unknown): string {
  return String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function foldAccents(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function cellText(cell: ExcelJS.Cell): string {
  const v: any = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "richText" in v) return v.richText.map((t: any) => t.text).join("");
  if (typeof v === "object" && "result" in v) return String(v.result ?? "");
  return String(v);
}

// Lee una columna de arriba hacia abajo, juntando los valores no vacíos —
// no se corta en la primera fila en blanco porque otras columnas de la
// misma hoja siguen mucho más abajo con datos de otras tablas.
function readColumnList(sheet: ExcelJS.Worksheet, col: number): string[] {
  const values: string[] = [];
  for (let r = FIRST_DATA_ROW; r <= FIRST_DATA_ROW + MAX_SCAN_ROWS; r++) {
    const text = norm(cellText(sheet.getRow(r).getCell(col)));
    if (text) values.push(text);
  }
  return values;
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

  const regionNames = readColumnList(sheet, COL_REGION);
  const regions: ParsedRegion[] = [];
  for (const name of regionNames) {
    const match = existingRegions.find((r) => foldAccents(r.nombre) === foldAccents(name) || foldAccents(r.code) === foldAccents(name));
    if (!match) {
      warnings.push(`"Info": la región "${name}" no coincide con ninguna región conocida — se dejó afuera de esta carga, revisar.`);
      continue;
    }
    regions.push({ code: match.code, nombre: match.nombre, sortOrder: match.sortOrder });
  }
  if (regions.length === 0) {
    errors.push('No se interpretó ninguna región en la columna "Región" de la hoja "Info".');
  }

  const filiales: ParsedFilial[] = [];
  const filialSources: Array<{ names: string[]; regionHint: string }> = [
    { names: readColumnList(sheet, COL_AMBA_FILIALES), regionHint: "AMBA" },
    { names: readColumnList(sheet, COL_INTERIOR_FILIALES), regionHint: "Interior" },
  ];
  for (const { names, regionHint } of filialSources) {
    for (const name of names) {
      const match = existingFiliales.find((f) => foldAccents(f.nombre) === foldAccents(name) || foldAccents(f.code) === foldAccents(name));
      if (!match) {
        warnings.push(`"Info" (${regionHint}): la filial "${name}" no coincide con ninguna filial conocida — se dejó afuera de esta carga, revisar a qué región pertenece.`);
        continue;
      }
      filiales.push({ code: match.code, regionCode: match.regionCode, nombre: match.nombre, sortOrder: match.sortOrder });
    }
  }
  if (filiales.length === 0) {
    errors.push('No se interpretó ninguna filial en las columnas "AMBA Dto del mes"/"Interior" de la hoja "Info".');
  }

  return { regions, filiales, report: { warnings, errors } };
}
