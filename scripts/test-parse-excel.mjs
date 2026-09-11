import { readFileSync } from "fs";
import pg from "pg";

// Reimplementación mínima en JS plano del parser TS para probarlo standalone
// (el archivo real vive en lib/excel/parsePriceList.ts; este script replica
// la misma lógica para poder correrlo con node sin compilar TS).
import ExcelJS from "exceljs";

const PLANES = ["INDIE", "MEDIFEPLUS", "BRONCE_C", "BRONCE", "PLATA", "ORO", "PLATINUM"];

const REGION_BLOCKS = [
  { region: "AMBA", rowStart: 12, rowEnd: 31, isAMBA: true },
  { region: "Norte", rowStart: 38, rowEnd: 59, isAMBA: false },
  { region: "Sur", rowStart: 66, rowEnd: 87, isAMBA: false },
  { region: "Patagonia", rowStart: 94, rowEnd: 115, isAMBA: false },
  { region: "Bahía/MDQ", rowStart: 122, rowEnd: 143, isAMBA: false },
];
const COL_LABEL = 4, COL_OBL_START = 5, COL_VOL_START = 14;

const TITULAR_MAP = {
  "TITULAR 00-25": "0-25", "TITULAR 26-35": "26-35", "TITULAR 36-40": "36-40", "TITULAR 41-50": "41-50",
  "TITULAR 51-60": "51-60", "TITULAR L 61-65": "61-65", "TITULAR 66-00": "66-00",
};
const ESPOSO_MAP = {
  "ESPOSO (A) 00-25": "MAT-0-25", "ESPOSO (A) 26-35": "MAT-26-35", "ESPOSO (A) 36-40": "MAT-36-40",
  "ESPOSO (A) 41-50": "MAT-41-50", "ESPOSO (A) 51-60": "MAT-51-60", "ESPOSO (A) 61-65": "MAT-61-65", "ESPOSO (A) 66-00": "MAT-66-00",
};
const AMBA_HIJO_MAP = {
  "HIJO (0 A 1)": ["HIJO-0-1"], "HIJO (2 A 20)": ["HIJO-2-20"],
  "HIJO AD. (21 A 29)": ["HIJO-21-25", "HIJO-26-29"],
  "HIJO AD. (30 A 39)": ["HIJO-30-39"], "HIJO AD. (40 A 49)": ["HIJO-40-49"],
};

function normalizeLabel(raw) { return String(raw ?? "").replace(/\s+/g, " ").trim().toUpperCase(); }
function cellNumber(cell) {
  const v = cell.value;
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Math.round(v);
  if (typeof v === "object" && "result" in v) { const r = v.result; return typeof r === "number" ? Math.round(r) : 0; }
  const n = parseFloat(String(v)); return isNaN(n) ? 0 : Math.round(n);
}
function readBlockRows(sheet, rowStart, rowEnd) {
  const table = new Map();
  for (let r = rowStart; r <= rowEnd; r++) {
    const row = sheet.getRow(r);
    const label = normalizeLabel(row.getCell(COL_LABEL).value);
    if (!label) continue;
    const obl = [], vol = [];
    for (let i = 0; i < 7; i++) { obl.push(cellNumber(row.getCell(COL_OBL_START + i))); vol.push(cellNumber(row.getCell(COL_VOL_START + i))); }
    table.set(label, { obl, vol });
  }
  return table;
}
function pushPlanRows(out, region, ageBracketCode, row, warnings, sourceLabel) {
  if (!row) { warnings.push(`${region}: no se encontró la fila "${sourceLabel}" — se omite ${ageBracketCode}.`); return; }
  PLANES.forEach((planCode, i) => {
    out.push({ regionCode: region, categoria: "Obl", ageBracketCode, planCode, monto: row.obl[i] });
    out.push({ regionCode: region, categoria: "Vol", ageBracketCode, planCode, monto: row.vol[i] });
  });
}
function mergeMedifePlus(base, medifePlusSource) {
  if (!base) return undefined;
  const obl = base.obl.slice(), vol = base.vol.slice();
  obl[1] = medifePlusSource ? medifePlusSource.obl[1] : 0;
  vol[1] = medifePlusSource ? medifePlusSource.vol[1] : 0;
  return { obl, vol };
}

async function parsePriceList(buffer) {
  const warnings = [], errors = [], prices = [], regionsParsed = [];
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("Resumen LP");
  if (!sheet) return { prices: [], report: { ok: false, totalCells: 0, warnings, errors: ['No se encontró la hoja "Resumen LP".'], regionsParsed: [] } };

  for (const block of REGION_BLOCKS) {
    const table = readBlockRows(sheet, block.rowStart, block.rowEnd);
    Object.entries(TITULAR_MAP).forEach(([label, code]) => pushPlanRows(prices, block.region, code, table.get(label), warnings, label));
    Object.entries(ESPOSO_MAP).forEach(([label, code]) => pushPlanRows(prices, block.region, code, table.get(label), warnings, label));
    if (block.isAMBA) {
      Object.entries(AMBA_HIJO_MAP).forEach(([label, codes]) => { const row = table.get(label); codes.forEach((code) => pushPlanRows(prices, block.region, code, row, warnings, label)); });
      pushPlanRows(prices, block.region, "FAM", table.get("FAMILIAR A CARGO"), warnings, "FAMILIAR A CARGO");
    } else {
      const h1 = table.get("HIJO 1"), h2 = table.get("HIJO 2"), hmac = table.get("HIJO MAYOR A CARGO");
      const h03 = table.get("HIJO 0 A 3"), h420 = table.get("HIJO 4 A 20");
      const h2125 = table.get("HIJO 21 A 25"), h2629 = table.get("HIJO 26 A 29"), fam = table.get("FAMILIAR A CARGO");
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
  const expected = REGION_BLOCKS.length * 2 * 21 * 7;
  if (prices.length !== expected) warnings.push(`Se esperaban ${expected} celdas y se generaron ${prices.length}.`);
  return { prices, report: { ok: errors.length === 0, totalCells: prices.length, warnings, errors, regionsParsed } };
}

// ── correr contra el archivo real y comparar contra la base ──
const filePath = process.argv[2];
const buf = readFileSync(filePath);
const { prices, report } = await parsePriceList(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

console.log("Report:", JSON.stringify(report, null, 2));

const client = new pg.Client({ connectionString: process.env.MIGRATION_DATABASE_URL, ssl: { rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0' } });
await client.connect();
const { rows: dbRows } = await client.query(
  `select region_code, categoria, age_bracket_code, plan_code, monto
   from prices p join price_list_versions v on v.id = p.price_list_version_id
   where v.status = 'active'`
);
await client.end();

const dbMap = new Map(dbRows.map((r) => [`${r.region_code}|${r.categoria}|${r.age_bracket_code}|${r.plan_code}`, Number(r.monto)]));
const parsedMap = new Map(prices.map((p) => [`${p.regionCode}|${p.categoria}|${p.ageBracketCode}|${p.planCode}`, p.monto]));

let mismatches = 0, matched = 0, missingInParsed = 0, missingInDb = 0;
for (const [key, dbVal] of dbMap) {
  if (!parsedMap.has(key)) { missingInParsed++; continue; }
  const pVal = parsedMap.get(key);
  if (pVal !== dbVal) { mismatches++; if (mismatches <= 20) console.log(`MISMATCH ${key}: db=${dbVal} parsed=${pVal}`); }
  else matched++;
}
for (const key of parsedMap.keys()) if (!dbMap.has(key)) missingInDb++;

console.log({ matched, mismatches, missingInParsed, missingInDb, dbTotal: dbMap.size, parsedTotal: parsedMap.size });
