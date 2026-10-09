import ExcelJS from "exceljs";

// RF-103: el tope de remuneración para aportes cambia todos los meses y viene
// en cada Excel, hoja "C aux" (fila "Tope de remuneración para aportes",
// valor en la columna B). Antes quedaba fijo en pricing_config con el valor
// de agosto, así que cualquier sueldo entre ese tope viejo y el vigente
// calculaba el aporte con un tope menor al real.

export type TopeAportesResult = { tope: number | null; warnings: string[] };

const HOJA = "C aux";
const ETIQUETA = /tope de remuneraci[oó]n para aportes/i;
// Rango de cordura: evita guardar un valor claramente erróneo (celda corrida,
// fecha, porcentaje) como tope.
const MIN_RAZONABLE = 1_000_000;
const MAX_RAZONABLE = 100_000_000;

function numeroDeCelda(v: ExcelJS.CellValue): number | null {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "result" in v && typeof (v as { result: unknown }).result === "number") {
    return (v as { result: number }).result;
  }
  return null;
}

function textoDeCelda(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object" && "richText" in v) return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join("");
  return String(v);
}

export async function parseTopeAportes(buffer: ArrayBuffer): Promise<TopeAportesResult> {
  const warnings: string[] = [];
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);
  const sheet = workbook.getWorksheet(HOJA);
  if (!sheet) {
    warnings.push(`No se encontró la hoja "${HOJA}": no se pudo leer el tope de aportes — se usa el tope general guardado en el sistema, revisar que no esté desactualizado.`);
    return { tope: null, warnings };
  }

  for (let r = 1; r <= Math.min(sheet.rowCount, 60); r++) {
    const row = sheet.getRow(r);
    if (!ETIQUETA.test(textoDeCelda(row.getCell(1).value))) continue;
    const valor = numeroDeCelda(row.getCell(2).value);
    if (valor == null || valor < MIN_RAZONABLE || valor > MAX_RAZONABLE) {
      warnings.push(`El tope de aportes de la hoja "${HOJA}" (fila ${r}) no es un monto válido — se usa el tope general guardado en el sistema, revisar que no esté desactualizado.`);
      return { tope: null, warnings };
    }
    return { tope: valor, warnings };
  }

  warnings.push(`No se encontró la fila "Tope de remuneración para aportes" en la hoja "${HOJA}" — se usa el tope general guardado en el sistema, revisar que no esté desactualizado.`);
  return { tope: null, warnings };
}
