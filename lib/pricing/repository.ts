import { createServiceClient } from "@/lib/supabase/service";
import type { Categoria, DiscountPolicy, PricingData } from "./types";

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
    const { data: version, error: versionErr } = await supabase
      .from("price_list_versions")
      .select("id")
      .eq("id", versionId)
      .in("status", ["active", "archived"])
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

export type SelectablePriceListVersion = { id: string; sourceFilename: string; uploadedAt: string };

// RF-41 / RF-44: versiones seleccionables en el combo del cotizador — las que
// llegaron a estar activas (activa actual + archivadas) y están habilitadas
// (no los borradores sin revisar, ni las deshabilitadas). De la más nueva a
// la más vieja.
export async function listSelectablePriceListVersions(): Promise<SelectablePriceListVersion[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("price_list_versions")
    .select("id, source_filename, uploaded_at")
    .in("status", ["active", "archived"])
    .eq("habilitada", true)
    .order("uploaded_at", { ascending: false });
  return (data ?? []).map((v) => ({
    id: v.id,
    sourceFilename: v.source_filename ?? "(sin nombre)",
    uploadedAt: v.uploaded_at,
  }));
}

// Usado para el "Re-cotizar": si la cotización original usó una versión que
// después se deshabilitó, igual hay que poder mostrarla en el combo (con su
// nombre real) para no perder el dato original de la cotización.
export async function getPriceListVersionInfo(id: string): Promise<SelectablePriceListVersion | null> {
  const supabase = createServiceClient();
  const { data } = await supabase.from("price_list_versions").select("id, source_filename, uploaded_at").eq("id", id).single();
  if (!data) return null;
  return { id: data.id, sourceFilename: data.source_filename ?? "(sin nombre)", uploadedAt: data.uploaded_at };
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
