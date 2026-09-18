import ExcelJS from "exceljs";
import { matchesPlanName } from "../pricing/planMatch";
import type { PlanRef } from "../pricing/types";
import type { PolicyCategoriaEspecial, PolicyGrupo } from "../pricing/types";

// RF-M8: el mismo Excel que trae la lista de precios ("Resumen LP") trae
// también, en la hoja "Políticas Comerciales", el modelo completo de
// descuentos/recargos — este parser lo interpreta para que cada carga
// actualice ambas cosas juntas, versionadas a la misma price_list_version.

export type ParsedPlanRule = { planCode: string; aplica: boolean };
export type ParsedScheduleBlock = { seq: number; valorPct: number; months: number };

export type ParsedPolicy = {
  slug: string;
  nombre: string;
  tipo: "dto" | "gaf" | "ucc" | "recargo";
  grupo: PolicyGrupo;
  categoriaEspecial: PolicyCategoriaEspecial | null;
  region: string;
  categoriaScope: "Obl" | "Vol" | null;
  procedenciaGate: string;
  zonaFilial: string | null;
  valorPct: number;
  permanente: boolean;
  plazoMeses: number | null;
  concatenable: boolean;
  requiereSlugPrefix: string | null;
  excluyeOtros: boolean;
  excluyeGrupo: PolicyGrupo[];
  edadMaxTitularConyuge: number | null;
  detalle: string | null;
  fuenteComentario: string | null;
  planRules: ParsedPlanRule[];
  schedule: ParsedScheduleBlock[];
};

export type PolicyParseReport = {
  ok: boolean;
  totalPolicies: number;
  porGrupo: Record<string, number>;
  warnings: string[];
  errors: string[];
};

export type PolicyParseResult = { policies: ParsedPolicy[]; report: PolicyParseReport };

const HEADER_ROW = 2;
const FIRST_DATA_ROW = 3;
const COL_TIPO = 2;
const COL_DESCRIPCION = 3;
const COL_ZONAS = 4;
const COL_DURACION = 5;
const COL_CATEGORIA = 6;
const COL_PROCEDENCIA = 7;
const COL_PLAZO_MAX = 8;
const COL_VALOR_PCT = 9;
const COL_DETALLE = 10;
const COL_COMENTARIOS = 11;
// L (12) queda en blanco en el Excel fuente antes de los overrides por plan.
// M13: la cantidad de columnas de override por plan ya no es fija en 7 (M..S)
// — se ubican por el nombre de cada plan en el encabezado (fila 2), dentro
// de un rango de búsqueda generoso, en vez de asumir siempre "7 columnas
// arrancando en M".
const COL_PLAN_START = 13;
const COL_PLAN_SEARCH_WIDTH = 20;

function mapPlanColumns(sheet: ExcelJS.Worksheet, planes: PlanRef[], warnings: string[]): number[] {
  const header = sheet.getRow(HEADER_ROW);
  return planes.map((plan) => {
    for (let c = COL_PLAN_START; c < COL_PLAN_START + COL_PLAN_SEARCH_WIDTH; c++) {
      if (matchesPlanName(String(header.getCell(c).value ?? ""), plan.nombre)) return c;
    }
    warnings.push(`"Políticas Comerciales": no se encontró la columna de override del plan "${plan.nombre}" — se tomó como "no aplica" en todas las filas.`);
    return -1;
  });
}

const CATEGORIA_ESPECIAL_POR_DESCRIPCION: Record<string, PolicyCategoriaEspecial> = {
  "AJUSTE LISTA HIJOS": "ajuste_hijos",
  "SEGMENTO JOVEN H/25": "segmento_joven_h25",
  "SEGMENTO JOVEN H/29": "segmento_joven_h29",
  "DESCUENTO FILIAL": "descuento_filial",
};

const REGION_MAP: Record<string, string> = {
  NAC: "Nac",
  NA: "Nac",
  AMBA: "AMBA",
  CABA: "AMBA", // confirmado por Diego: CABA también aplica en AMBA
  GBA: "AMBA", // confirmado por Diego: GBA (sin Sur/Oeste/Norte) es AMBA en general
  NORTE: "Norte",
  SUR: "Sur",
  PATAGONIA: "Patagonia",
  COMAHUE: "Patagonia", // confirmado por Diego: Comahue cae en la región Sur/Patagonia — Patagonia es la que usa la tabla de filiales
  "BAHÍA/MDQ": "Bahía/MDQ",
  INTERIOR: "Interior",
};

// Confirmado por Diego: las provincias que arma el Excel para "Descuento
// Filial" dan la pauta de a qué filial real pertenecen, aunque el texto no
// coincida con el código exacto. Se arranca con los casos ya confirmados —
// extender acá a medida que aparezcan más en cargas reales.
const PROVINCIA_A_FILIAL: Record<string, string> = {
  TUCUMAN: "NOA",
  TUCUMÁN: "NOA",
  SALTA: "NOA",
  JUJUY: "NOA",
};

function norm(raw: unknown): string {
  return String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function upper(raw: unknown): string {
  return norm(raw).toUpperCase();
}

function cellText(cell: ExcelJS.Cell): string {
  const v: any = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "richText" in v) return v.richText.map((t: any) => t.text).join("");
  if (typeof v === "object" && "result" in v) return String(v.result ?? "");
  return String(v);
}

function cellNumber(cell: ExcelJS.Cell): { value: number; isNumeric: boolean } {
  const v: any = cell.value;
  if (typeof v === "number") return { value: v, isNumeric: true };
  if (typeof v === "object" && v !== null && "result" in v && typeof v.result === "number") {
    return { value: v.result, isNumeric: true };
  }
  const text = cellText(cell).trim();
  if (text === "") return { value: 0, isNumeric: true }; // celda vacía: no aplica a ese plan
  const n = parseFloat(text);
  return { value: isNaN(n) ? 0 : n, isNumeric: !isNaN(n) };
}

function mapTipo(grupo: PolicyGrupo): "dto" | "gaf" | "ucc" | "recargo" {
  if (grupo === "gaf") return "gaf";
  if (grupo === "recargo") return "recargo";
  return "dto";
}

function mapCategoriaScope(raw: string): "Obl" | "Vol" | null {
  const u = upper(raw);
  if (u === "OBL") return "Obl";
  if (u === "VOL") return "Vol";
  return null;
}

function mapPlazoMeses(raw: string): number | null {
  const m = raw.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

// Los nombres de filial en el Excel vienen en mayúsculas ("CÓRDOBA", "SAN
// JUAN") pero la tabla `filiales` usa el casing real ("Córdoba", "San
// Juan") — isZonaOk compara texto exacto, así que hay que normalizar
// contra la lista real de códigos para no perder el filtro en silencio.
function foldAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function matchesKnownFilial(token: string, knownCodes: string[]): boolean {
  return knownCodes.some((code) => foldAccents(code) === foldAccents(token));
}

function canonicalizeFilial(token: string, knownCodes: string[], warnings: string[], nombre: string): string {
  if (knownCodes.length === 0) return token; // sin lista de referencia, no se puede verificar
  const direct = knownCodes.find((code) => foldAccents(code) === foldAccents(token));
  if (direct) return direct;
  // Confirmado por Diego: una provincia (ej. "Tucumán") da la pauta de a
  // qué filial pertenece, aunque el Excel no use el código exacto.
  const viaProvincia = PROVINCIA_A_FILIAL[upper(token)];
  if (viaProvincia) {
    const match = knownCodes.find((code) => foldAccents(code) === foldAccents(viaProvincia));
    if (match) return match;
  }
  warnings.push(`"${nombre}": la filial "${token}" no coincide con ningún código conocido — se importó tal cual, revisar.`);
  return token;
}

function mapZonaFilial(raw: string): string | null {
  const t = norm(raw);
  if (!t || upper(t) === "NA") return null;
  return t.replace(/\s*\/\s*/g, ",").replace(/\s+y\s+/gi, ",");
}

// Schedule tipo "30% x 3; 20% x 2; 10% x2" -> bloques secuenciales, con el
// mismo signo que valorPct (los recargos son positivos, los descuentos negativos).
function parseSchedule(detalle: string, valorPct: number): ParsedScheduleBlock[] {
  const sign = valorPct < 0 ? -1 : 1;
  const blocks: ParsedScheduleBlock[] = [];
  const re = /(\d+(?:[.,]\d+)?)\s*%\s*[x×]\s*(\d+)/gi;
  let match: RegExpExecArray | null;
  let seq = 1;
  while ((match = re.exec(detalle))) {
    const pct = parseFloat(match[1].replace(",", ".")) / 100;
    const months = parseInt(match[2], 10);
    blocks.push({ seq: seq++, valorPct: sign * pct, months });
  }
  return blocks;
}

// Reglas de combinación leídas de "Comentarios" (texto libre, en español,
// pero con un vocabulario acotado y consistente en los Excel reales vistos).
function parseComentarios(
  comentarios: string,
  warnings: string[],
  nombre: string
): { requiereSlugPrefix: string | null; excluyeOtros: boolean; excluyeGrupo: PolicyGrupo[]; edadMaxTitularConyuge: number | null } {
  const result = {
    requiereSlugPrefix: null as string | null,
    excluyeOtros: false,
    excluyeGrupo: [] as PolicyGrupo[],
    edadMaxTitularConyuge: null as number | null,
  };
  const text = norm(comentarios);
  if (!text) return result;

  let matchedAlgo = false;

  if (/no acumulable con otros descuentos/i.test(text)) {
    result.excluyeOtros = true;
    matchedAlgo = true;
  }
  if (/no acumulable con descuento estrat[eé]gico/i.test(text)) {
    result.excluyeGrupo.push("estrategico");
    matchedAlgo = true;
  } else if (/acumulable con descuento estrat[eé]gico/i.test(text)) {
    // Confirma el comportamiento por default (se suma con lo Estratégico elegido) — sin flag adicional.
    matchedAlgo = true;
  }
  const requiereMatch = text.match(/concatenable con la opci[oó]n\s*(\d+)|combinable con la opci[oó]n\s*(\d+)/i);
  if (requiereMatch) {
    const n = requiereMatch[1] ?? requiereMatch[2];
    result.requiereSlugPrefix = `opcion-${n}`;
    matchedAlgo = true;
  } else if (/acumulable con opciones?\s*[\d,\sy]+/i.test(text)) {
    matchedAlgo = true; // "Acumulable con opciones 1,2 y 3" (Opción 5): ya concatenable por default, sin requisito.
  }
  const edadMatch = text.match(/hasta\s*(\d+)\s*años/i);
  if (edadMatch && /titular|c[oó]nyuge|\bgf\b|grupo familiar/i.test(text)) {
    result.edadMaxTitularConyuge = parseInt(edadMatch[1], 10);
    matchedAlgo = true;
  }

  if (!matchedAlgo) {
    warnings.push(`"${nombre}": no se pudo interpretar la regla de combinación en Comentarios ("${text}") — se importó sin ninguna regla especial, revisar manualmente.`);
  }
  return result;
}

export async function parseDiscountPolicies(
  buffer: ArrayBuffer,
  knownFilialCodes: string[] = [],
  planes: PlanRef[] = []
): Promise<PolicyParseResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const policies: ParsedPolicy[] = [];

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.getWorksheet("Políticas Comerciales");
  if (!sheet) {
    return {
      policies: [],
      report: { ok: false, totalPolicies: 0, porGrupo: {}, warnings, errors: ['No se encontró la hoja "Políticas Comerciales" en el archivo.'], },
    };
  }
  if (planes.length === 0) {
    return {
      policies: [],
      report: { ok: false, totalPolicies: 0, porGrupo: {}, warnings, errors: ['No hay planes para interpretar los overrides por plan — revisar la columna "Producto" de la hoja "Info".'] },
    };
  }

  const planColumns = mapPlanColumns(sheet, planes, warnings);
  const slugCount: Record<string, number> = {};

  for (let r = FIRST_DATA_ROW; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const tipoRaw = upper(cellText(row.getCell(COL_TIPO)));
    const descripcion = norm(cellText(row.getCell(COL_DESCRIPCION)));
    if (!tipoRaw && !descripcion) continue; // fila vacía

    const descripcionKey = upper(descripcion);
    const categoriaEspecial = CATEGORIA_ESPECIAL_POR_DESCRIPCION[descripcionKey] ?? null;

    let grupo: PolicyGrupo;
    if (categoriaEspecial) {
      grupo = "ajuste";
    } else if (tipoRaw === "GAF") {
      grupo = "gaf";
    } else if (tipoRaw === "RECARGO") {
      grupo = "recargo";
    } else if (tipoRaw === "AJUSTE") {
      grupo = "ajuste";
    } else if (tipoRaw.startsWith("DESCUENTO ESTRAT")) {
      grupo = "estrategico";
    } else if (tipoRaw.startsWith("DESCUENTO T")) {
      grupo = "tactico";
    } else {
      grupo = "otro";
      warnings.push(`"${descripcion || "(sin descripción)"}": Tipo "${tipoRaw}" no reconocido — se importó como "otro", revisar.`);
    }

    const zonasRaw = norm(cellText(row.getCell(COL_ZONAS)));
    const zonaUpper = upper(zonasRaw);
    let region = REGION_MAP[zonaUpper];
    if (!region && !zonasRaw && categoriaEspecial === "descuento_filial") {
      // "Descuento Filial" no trae Zonas — la filial (columna Procedencia) ya
      // acota de sobra a qué región aplica; "Norte" es la única región con
      // filiales de este tipo en los Excel vistos hasta ahora.
      region = "Norte";
    }
    if (!region) {
      region = zonasRaw || "Nac";
      warnings.push(`"${descripcion}": región "${zonasRaw}" no reconocida — se importó tal cual, revisar.`);
    } else if (region === "Sur" && grupo === "gaf") {
      region = "SurExt"; // GAF "SUR" cubre Sur+Patagonia+Bahía/MDQ, igual que hoy.
    }

    // Confirmado por Diego: el "Plazo Max" manda siempre, para cualquier
    // Tipo — incluido GAF (antes se asumía "permanente" para todo GAF sin
    // mirar esta columna). Vacío/"NA" = sin fin de duración.
    const duracion = upper(cellText(row.getCell(COL_DURACION)));
    const permanente = duracion === "PERMANENTE";
    const plazoMeses = mapPlazoMeses(cellText(row.getCell(COL_PLAZO_MAX)));

    const categoriaScope = mapCategoriaScope(cellText(row.getCell(COL_CATEGORIA)));

    const procedenciaRaw = norm(cellText(row.getCell(COL_PROCEDENCIA)));
    let procedenciaGate = "";
    let zonaFilial: string | null = null;
    if (grupo === "gaf") {
      procedenciaGate = "GAF";
    } else if (grupo === "estrategico") {
      const procUpper = upper(procedenciaRaw);
      if (procUpper === "CON PROCEDENCIA COMPROBABLE") {
        procedenciaGate = "comprobable";
      }
      // Confirmado por Diego: otras condiciones de procedencia (ej. "Exclusivo
      // Débito con TC", "BASE ex Asociados") no se validan — el formulario no
      // pide método de pago ni ese tipo de datos, el descuento queda visible
      // y lo aplica el operador a criterio propio. Sin warning: es el
      // comportamiento esperado, no un caso a revisar.
    } else if (REGION_MAP[upper(procedenciaRaw)] && !matchesKnownFilial(procedenciaRaw, knownFilialCodes)) {
      // La columna Procedencia a veces repite el nombre de la región entera
      // (ej. "AMBA", "GBA", "Bahía/MDQ ") en vez de una filial puntual — eso
      // no es una restricción de zona, ya está cubierto por "region". Pero
      // si el texto SÍ coincide con un código de filial real (ej. "CABA",
      // "Comahue"), se respeta como filial puntual — no todo lo que aparece
      // en REGION_MAP deja de ser también una filial concreta.
      zonaFilial = null;
    } else {
      const raw = mapZonaFilial(procedenciaRaw);
      zonaFilial = raw
        ? Array.from(
            new Set(
              raw
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
                .map((t) => canonicalizeFilial(t, knownFilialCodes, warnings, descripcion))
            )
          ).join(",")
        : null;
    }

    const valorPctRaw = cellNumber(row.getCell(COL_VALOR_PCT));
    const valorPct = valorPctRaw.value;

    const detalle = norm(cellText(row.getCell(COL_DETALLE))) || null;
    const comentarios = norm(cellText(row.getCell(COL_COMENTARIOS)));

    // A pedido de Diego: las reglas de combinación de "Comentarios" (RF-75)
    // también se leen para las filas GAF, no solo Estratégico/Táctico — un
    // GAF puede traer la misma directiva ("Concatenable/Combinable con la
    // opción N", "No acumulable con...") y hay que respetarla igual.
    const combinacion =
      grupo === "estrategico" || grupo === "tactico" || grupo === "gaf"
        ? parseComentarios(comentarios, warnings, descripcion)
        : { requiereSlugPrefix: null, excluyeOtros: false, excluyeGrupo: [] as PolicyGrupo[], edadMaxTitularConyuge: null };

    // "concatenable" en el motor significa "se aplica recién después de que
    // termine el plazo de las políticas no concatenables" — tanto una
    // política que EXIGE otra (requiereSlugPrefix, ej. Opción 6→4, texto
    // "Concatenable/Combinable con la opción N") como una que se declara
    // acumulable con un listado de opciones (ej. "Acumulable con opciones
    // 1,2 y 3", Opción 5) arrancan recién cuando termina el plazo de la
    // principal — a pedido de Diego, corrige la interpretación anterior
    // (migración 0016) que hacía sumar Opción 6 en simultáneo con Opción 4.
    const concatenable =
      !!combinacion.requiereSlugPrefix || /acumulable con opciones?\s*[\d,\sy]+/i.test(comentarios);

    const schedule = permanente ? [] : parseSchedule(detalle ?? "", valorPct);
    // Un descuento temporal de tasa plana por N meses no necesita cronograma
    // (alcanza con plazoMeses) — solo avisar cuando "Detalle" sí menciona un
    // "%" pero no se pudo extraer ningún bloque (probable escalonado roto).
    if (!permanente && schedule.length === 0 && detalle && /%/.test(detalle)) {
      warnings.push(`"${descripcion}": no se pudo interpretar el escalonado de "Detalle" ("${detalle}") — se importó sin cronograma, revisar.`);
    }

    let planRules: ParsedPlanRule[] = planes.map((plan, i) => {
      const col = planColumns[i];
      if (col < 0) return { planCode: plan.code, aplica: false };
      const cell = row.getCell(col);
      const { value, isNumeric } = cellNumber(cell);
      if (!isNumeric && cellText(cell).trim() !== "") {
        warnings.push(`"${descripcion}": celda inválida en la columna de plan "${plan.nombre}" — se tomó como "no aplica".`);
      }
      return { planCode: plan.code, aplica: value !== 0 };
    });

    // Bug real detectado: en algunas filas de "Descuento Estratégico" las
    // columnas de plan vienen todas en 0 a pesar de que "Valor % 1er mes" no
    // lo es (ej. Opción 6) — el descuento queda seleccionable pero no aplica
    // nada. Todas las demás filas de este grupo siguen el mismo patrón
    // (aplica a todos los planes salvo INDIE, al valor general) — se usa
    // como respaldo acá en vez de dejar la fila sin efecto en silencio.
    if (grupo === "estrategico" && valorPct !== 0 && planRules.every((r) => !r.aplica)) {
      planRules = planes.map((plan) => ({ planCode: plan.code, aplica: !matchesPlanName(plan.nombre, "INDIE") }));
      warnings.push(`"${descripcion}": las columnas de plan vinieron en 0 pese a que el descuento tiene un valor (${(valorPct * 100).toFixed(1)}%) — se aplicó a todos los planes salvo INDIE (mismo criterio que el resto de "Descuento Estratégico"), revisar si corresponde.`);
    }

    // Slug de clasificación: nombre + zona/región + categoría, legible y
    // único dentro de esta carga (no hace falta que sea global).
    const slugify = (s: string) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    const slugParts = [slugify(descripcion || tipoRaw)];
    if (zonaFilial) slugParts.push(slugify(zonaFilial));
    else if (region && region !== "Nac") slugParts.push(slugify(region));
    if (categoriaScope) slugParts.push(categoriaScope);
    let slug = slugParts.filter(Boolean).join("-");
    if (slugCount[slug] != null) {
      slugCount[slug]++;
      slug = `${slug}-${slugCount[slug]}`;
    } else {
      slugCount[slug] = 0;
    }

    policies.push({
      slug,
      nombre: descripcion || tipoRaw,
      tipo: mapTipo(grupo),
      grupo,
      categoriaEspecial,
      region,
      categoriaScope,
      procedenciaGate,
      zonaFilial,
      valorPct,
      permanente,
      plazoMeses,
      concatenable,
      requiereSlugPrefix: combinacion.requiereSlugPrefix,
      excluyeOtros: combinacion.excluyeOtros,
      excluyeGrupo: combinacion.excluyeGrupo,
      edadMaxTitularConyuge: combinacion.edadMaxTitularConyuge,
      detalle,
      fuenteComentario: comentarios || null,
      planRules,
      schedule,
    });
  }

  const porGrupo: Record<string, number> = {};
  for (const p of policies) porGrupo[p.grupo] = (porGrupo[p.grupo] ?? 0) + 1;

  if (policies.length === 0) {
    errors.push('No se interpretó ninguna política en la hoja "Políticas Comerciales".');
  }

  return {
    policies,
    report: { ok: errors.length === 0, totalPolicies: policies.length, porGrupo, warnings, errors },
  };
}
