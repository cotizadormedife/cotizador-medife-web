import { createServiceClient } from "@/lib/supabase/service";
import type { Categoria, DiscountPolicy, PricingData } from "./types";
import { compareVigencia, formatVigencia, nextVigencia, vigenciaDeHoy } from "./vigencia";

// RF-41: por default se usa la lista activa, pero se puede pedir una
// versión puntual (una que llegó a estar activa alguna vez) para cotizar
// contra una lista de precios distinta a la vigente.
export async function loadPricingData(region: string, categoria: Categoria, priceListVersionId?: string): Promise<PricingData> {
  const supabase = createServiceClient();

  let versionId = priceListVersionId;
  if (!versionId) {
    const { data: version, error: versionErr } = await supabase
      .from("price_list_versions")
      .select("id")
      .eq("status", "active")
      .single();
    if (versionErr || !version) throw new Error("No hay una lista de precios activa.");
    versionId = version.id;
  } else {
    // RF-65: "mes siguiente" puede señalar a una versión todavía en borrador
    // (no activada) — por eso "draft" también es válido acá, a diferencia del
    // combo general (listSelectablePriceListVersions), que sigue sin mostrarlas.
    const { data: version, error: versionErr } = await supabase
      .from("price_list_versions")
      .select("id")
      .eq("id", versionId)
      .in("status", ["active", "archived", "draft"])
      .single();
    if (versionErr || !version) throw new Error("La lista de precios elegida no es válida.");
  }
  if (!versionId) throw new Error("No se pudo determinar la lista de precios.");

  const { data: priceRows, error: priceErr } = await supabase
    .from("prices")
    .select("age_bracket_code, plan_code, monto")
    .eq("price_list_version_id", versionId)
    .eq("region_code", region)
    .eq("categoria", categoria);
  if (priceErr) throw priceErr;

  const { data: policyRows, error: policyErr } = await supabase
    .from("discount_policies")
    .select(
      "id, nombre, tipo, region, categoria_scope, procedencia_gate, zona_filial, valor_pct, permanente, plazo_meses, concatenable, detalle, discount_policy_plan_rules(plan_code, aplica), discount_policy_schedule(seq, valor_pct, months)"
    )
    .eq("activo", true);
  if (policyErr) throw policyErr;

  const { data: monotributoRows, error: monoErr } = await supabase
    .from("monotributo_brackets")
    .select("letra, monto");
  if (monoErr) throw monoErr;

  const { data: configRows, error: configErr } = await supabase.from("pricing_config").select("key, value");
  if (configErr) throw configErr;

  const policies: DiscountPolicy[] = (policyRows ?? []).map((p: any) => ({
    id: p.id,
    nombre: p.nombre,
    tipo: p.tipo,
    region: p.region,
    categoriaScope: p.categoria_scope,
    procedenciaGate: p.procedencia_gate ?? "",
    zonaFilial: p.zona_filial,
    valorPct: Number(p.valor_pct),
    permanente: p.permanente,
    plazoMeses: p.plazo_meses,
    concatenable: p.concatenable,
    detalle: p.detalle,
    planRules: (p.discount_policy_plan_rules ?? []).map((r: any) => ({
      planCode: r.plan_code,
      aplica: r.aplica,
      valorOverride: null,
    })),
    schedule: (p.discount_policy_schedule ?? [])
      .map((s: any) => ({ seq: s.seq, valorPct: Number(s.valor_pct), months: s.months }))
      .sort((a: any, b: any) => a.seq - b.seq),
  }));

  return {
    prices: (priceRows ?? []).map((r: any) => ({
      ageBracketCode: r.age_bracket_code,
      planCode: r.plan_code,
      monto: Number(r.monto),
    })),
    policies,
    monotributoBrackets: Object.fromEntries((monotributoRows ?? []).map((r: any) => [r.letra, Number(r.monto)])),
    config: Object.fromEntries((configRows ?? []).map((r: any) => [r.key, Number(r.value)])),
    priceListVersionId: versionId,
  };
}

// El combo y los listados solo muestran fecha y hora de alta (sin nombre de
// archivo) — sourceFilename se conserva en el tipo por si se necesita en
// otro lado, pero ninguna pantalla lo renderiza más.
export type SelectablePriceListVersion = {
  id: string;
  sourceFilename: string;
  uploadedAt: string;
  vigenciaLabel: string;
  disabled?: boolean;
};

// RF-41 / RF-44: versiones seleccionables en el combo del cotizador — las que
// llegaron a estar activas (activa actual + archivadas) y están habilitadas
// (no los borradores sin revisar, ni las deshabilitadas). De la más nueva a
// la más vieja.
export async function listSelectablePriceListVersions(): Promise<SelectablePriceListVersion[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("price_list_versions")
    .select("id, source_filename, uploaded_at, vigencia_anio, vigencia_mes")
    .in("status", ["active", "archived"])
    .eq("habilitada", true)
    .order("uploaded_at", { ascending: false });
  return (data ?? []).map((v) => ({
    id: v.id,
    sourceFilename: v.source_filename ?? "(sin nombre)",
    uploadedAt: v.uploaded_at,
    vigenciaLabel: formatVigencia({ anio: v.vigencia_anio, mes: v.vigencia_mes }),
  }));
}

// Usado para el "Re-cotizar": si la cotización original usó una versión que
// después se deshabilitó, igual hay que poder mostrarla en el combo (con su
// nombre real) para no perder el dato original de la cotización.
export async function getPriceListVersionInfo(id: string): Promise<SelectablePriceListVersion | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("price_list_versions")
    .select("id, source_filename, uploaded_at, vigencia_anio, vigencia_mes")
    .eq("id", id)
    .single();
  if (!data) return null;
  return {
    id: data.id,
    sourceFilename: data.source_filename ?? "(sin nombre)",
    uploadedAt: data.uploaded_at,
    vigenciaLabel: formatVigencia({ anio: data.vigencia_anio, mes: data.vigencia_mes }),
  };
}

export type VigenciaOption = { id: string; label: string };
export type VigenciaSelection = {
  // La lista de "mes actual". Si no hay ninguna con vigencia = hoy, cae a la
  // más reciente anterior (actualEsFallback = true) — RF-65.
  actual: VigenciaOption | null;
  actualEsFallback: boolean;
  // La lista de "mes siguiente", solo si ya existe (puede seguir en borrador,
  // sin activar — ver RF-65 / loadPricingData).
  siguiente: VigenciaOption | null;
};

export async function getVigenciaSelection(): Promise<VigenciaSelection> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("price_list_versions")
    .select("id, vigencia_anio, vigencia_mes")
    .eq("habilitada", true)
    .order("vigencia_anio", { ascending: false })
    .order("vigencia_mes", { ascending: false });
  const versiones = data ?? [];

  const hoy = vigenciaDeHoy();
  const siguienteMes = nextVigencia(hoy);

  const matchHoy = versiones.find((v) => v.vigencia_anio === hoy.anio && v.vigencia_mes === hoy.mes);
  const matchSiguiente = versiones.find((v) => v.vigencia_anio === siguienteMes.anio && v.vigencia_mes === siguienteMes.mes);
  const masRecienteHastaHoy = versiones.find(
    (v) => compareVigencia({ anio: v.vigencia_anio, mes: v.vigencia_mes }, hoy) <= 0
  );

  const actualRow = matchHoy ?? masRecienteHastaHoy ?? null;

  return {
    actual: actualRow
      ? { id: actualRow.id, label: formatVigencia({ anio: actualRow.vigencia_anio, mes: actualRow.vigencia_mes }) }
      : null,
    actualEsFallback: !matchHoy && !!actualRow,
    siguiente: matchSiguiente
      ? { id: matchSiguiente.id, label: formatVigencia({ anio: matchSiguiente.vigencia_anio, mes: matchSiguiente.vigencia_mes }) }
      : null,
  };
}

// RF-64: la próxima versión a cargar siempre es correlativa a la vigencia más
// nueva que ya exista (sin importar su estado) — usado por uploadPriceListAction.
export async function computeNextVigencia(): Promise<{ anio: number; mes: number; label: string }> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("price_list_versions")
    .select("vigencia_anio, vigencia_mes")
    .order("vigencia_anio", { ascending: false })
    .order("vigencia_mes", { ascending: false })
    .limit(1)
    .maybeSingle();

  const base = data ? { anio: data.vigencia_anio, mes: data.vigencia_mes } : vigenciaDeHoy();
  const next = data ? nextVigencia(base) : base;
  return { anio: next.anio, mes: next.mes, label: formatVigencia(next) };
}

export async function loadAllDiscountPolicies(): Promise<DiscountPolicy[]> {
  const data = await loadPricingData("AMBA", "Vol");
  return data.policies;
}

export async function getRegionsAndFiliales() {
  const supabase = createServiceClient();
  const { data: regions } = await supabase.from("regions").select("code, nombre, sort_order").order("sort_order");
  const { data: filiales } = await supabase
    .from("filiales")
    .select("code, region_code, nombre, sort_order")
    .order("sort_order");
  return { regions: regions ?? [], filiales: filiales ?? [] };
}
