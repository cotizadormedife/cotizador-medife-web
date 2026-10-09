// Reporte de SOLO LECTURA: usuarios dados de alta y cuántos cotizaron al menos una vez.
// Lee las credenciales de .env.nuevo (proyecto de cotizadormedife.com). Nunca las imprime.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envFile = process.argv[2] ?? ".env.nuevo";
const env = Object.fromEntries(
  readFileSync(new URL(`../${envFile}`, import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function fetchAll(table, columns) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

const profiles = await fetchAll("profiles", "id, email, nombre, apellido, role, status, disabled_at, empresa_id, created_at");
const quotes = await fetchAll("quotes", "created_by, created_at");
const empresas = await fetchAll("empresas", "id, nombre");

const empresaNombre = new Map(empresas.map((e) => [e.id, e.nombre]));
const quotesByUser = new Map();
for (const q of quotes) quotesByUser.set(q.created_by, (quotesByUser.get(q.created_by) ?? 0) + 1);

const esPrueba = (p) =>
  /@example\.(com|org)$/i.test(p.email ?? "") ||
  /(^|[._-])(test|prueba)([._-]|@)/i.test(p.email ?? "") ||
  empresaNombre.get(p.empresa_id) === "Usuarios Prueba";

const activo = (p) => p.status === "approved" && !p.disabled_at;
const cot = (p) => (quotesByUser.get(p.id) ?? 0) > 0;
const resumen = (lista) => ({ usuarios: lista.length, con_cotizacion: lista.filter(cot).length, sin_cotizacion: lista.filter((p) => !cot(p)).length });

console.log("=== TOTALES GENERALES ===");
console.log(`Perfiles totales: ${profiles.length} | Cotizaciones totales: ${quotes.length}`);
const fechas = quotes.map((q) => q.created_at).sort();
console.log(`Primera cotización: ${fechas[0]} | Última: ${fechas[fechas.length - 1]}`);

console.log("\n=== POR ROL / ESTADO / HABILITACIÓN ===");
const grupos = new Map();
for (const p of profiles) {
  const k = `${p.role} | ${p.status} | ${p.disabled_at ? "deshabilitado" : "habilitado"}`;
  (grupos.get(k) ?? grupos.set(k, []).get(k)).push(p);
}
console.table(Object.fromEntries([...grupos.entries()].sort().map(([k, l]) => [k, resumen(l)])));

console.log("\n=== DEFINICIONES DE 'VENDEDOR' (habilitados y aprobados) ===");
const vendedores = profiles.filter((p) => p.role === "vendedor");
const vendAdmin = profiles.filter((p) => p.role === "vendedor" || p.role === "admin");
console.table({
  "Solo rol vendedor — todos los dados de alta": resumen(vendedores),
  "Solo rol vendedor — activos (aprobados y habilitados)": resumen(vendedores.filter(activo)),
  "Vendedor + admin — activos": resumen(vendAdmin.filter(activo)),
  "Vendedor + admin — activos, SIN cuentas de prueba": resumen(vendAdmin.filter(activo).filter((p) => !esPrueba(p))),
  "Todos los roles — activos, SIN cuentas de prueba": resumen(profiles.filter(activo).filter((p) => !esPrueba(p))),
});

console.log("\n=== POR EMPRESA / BROKER (vendedor + admin activos, sin cuentas de prueba) ===");
const porEmpresa = new Map();
for (const p of vendAdmin.filter(activo).filter((x) => !esPrueba(x))) {
  const n = empresaNombre.get(p.empresa_id) ?? "(sin empresa)";
  (porEmpresa.get(n) ?? porEmpresa.set(n, []).get(n)).push(p);
}
console.table(Object.fromEntries([...porEmpresa.entries()].sort((a, b) => b[1].length - a[1].length).map(([n, l]) => [n, resumen(l)])));

console.log("\n=== CUENTAS QUE PARECEN DE PRUEBA (para revisar) ===");
for (const p of profiles.filter(esPrueba)) {
  console.log(`- ${p.email} | ${p.role} | ${p.status}${p.disabled_at ? " (deshabilitado)" : ""} | ${empresaNombre.get(p.empresa_id) ?? "-"} | cotizaciones: ${quotesByUser.get(p.id) ?? 0}`);
}

const huerfanas = quotes.filter((q) => !profiles.some((p) => p.id === q.created_by)).length;
console.log(`\nCotizaciones de usuarios que ya no existen en profiles: ${huerfanas}`);
