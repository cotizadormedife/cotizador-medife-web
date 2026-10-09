// Fija el tope de remuneración para aportes de UNA lista de precios (o el tope
// general de respaldo) en pricing_config, sin tener que volver a subir el Excel.
// Pensado para corregir listas cargadas antes de RF-103; las cargas nuevas lo
// leen solas del Excel (hoja "C aux", fila "Tope de remuneración para aportes").
//
// Uso:  node scripts/fijar-tope-aportes.mjs <lista|general> <valor> [archivo-env]
//   lista = id (uuid) de price_list_versions
//   archivo-env = por defecto .env.nuevo (proyecto de cotizadormedife.com)
// Escribe SOLO la clave aporte_tope@<id> (o aporte_tope si es "general"). No imprime credenciales.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const [lista, valorRaw, envFile = ".env.nuevo"] = process.argv.slice(2);
const valor = Number(valorRaw);
if (!lista || !Number.isFinite(valor) || valor < 1_000_000 || valor > 100_000_000) {
  console.error("Uso: node scripts/fijar-tope-aportes.mjs <lista-uuid|general> <valor entre 1.000.000 y 100.000.000> [archivo-env]");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(new URL(`../${envFile}`, import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
console.log("Proyecto:", new URL(env.NEXT_PUBLIC_SUPABASE_URL).host.split(".")[0]);

let key = "aporte_tope";
let descripcion = "Tope salarial para el cálculo de aportes (respaldo general: se usa si la lista no tiene el suyo)";
if (lista !== "general") {
  const { data, error } = await supabase.from("price_list_versions").select("id, vigencia_anio, vigencia_mes, version_num").eq("id", lista).maybeSingle();
  if (error || !data) {
    console.error("No existe esa lista de precios:", error?.message ?? lista);
    process.exit(1);
  }
  key = `aporte_tope@${data.id}`;
  descripcion = `Tope de remuneración para aportes de la lista ${data.vigencia_anio}-${String(data.vigencia_mes).padStart(2, "0")} Ver.${data.version_num} (leído del Excel, hoja C aux)`;
}

const antes = await supabase.from("pricing_config").select("value").eq("key", key).maybeSingle();
const { error } = await supabase.from("pricing_config").upsert({ key, value: valor, description: descripcion }, { onConflict: "key" });
if (error) {
  console.error("No se pudo guardar:", error.message);
  process.exit(1);
}
const despues = await supabase.from("pricing_config").select("value").eq("key", key).single();
console.log(`${key}\n  antes:   ${antes.data?.value ?? "(no existía)"}\n  después: ${despues.data?.value}`);
