import { createServiceClient } from "@/lib/supabase/service";
import type { Categoria, DiscountPolicy, PricingData } from "./types";
import { compareVigencia, formatVigencia, nextVigencia, vigenciaDeHoy } from "./vigencia";

// RF-68: por default se usa la lista de la vigencia de hoy (o, si todavía no
// se cargó ninguna para el mes actual, la más reciente anterior); también se
// puede pedir una versión puntual para cotizar contra una lista distinta.
// Ya no depende de la columna `status` — esa columna quedó vestigial (ver
// nota en resolveUploadTarget).
export async function loadPricingData(region: string, categoria: Categoria, priceListVersionId?: string): Promise<PricingData> {
  const supabase = createServiceClient();

  let versionId = priceListVersionId;
  if (!versionId) {
    const { data: rows } = await supabase
      .from("price_list_versions")
      .select("id, vigencia_anio, vigencia_mes")
      .order("vigencia_anio", { ascending: false })
      .order("vigencia_mes", { ascending: false });
    const versiones = rows ?? [];
    const hoy = vigenciaDeHoy();
    const match = versiones.find((v) => v.vigencia_anio === hoy.anio && v.vigencia_mes === hoy.mes);
    const fallback = versiones.find((v) => compareVigencia({ anio: v.vigencia_anio, mes: v.vigencia_mes }, hoy) <= 0);
    const chosen = match ?? fallback ?? null;
    if (!chosen) throw new Error("No hay ninguna lista de precios cargada.");
    versionId = chosen.id;
  } else {
    const { data: version, error: versionErr } = await supabase
      .from("price_list_versions")
      .select("id")
      .eq("id", versionId)
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
      "id, slug, nombre, tipo, grupo, categoria_especial, region, categoria_scope, procedencia_gate, zona_filial, valor_pct, permanente, plazo_meses, concatenable, requiere_slug, excluye_otros, excluye_grupo, edad_max_titular_conyuge, detalle, fuente_comentario, discount_policy_plan_rules(plan_code, aplica), discount_policy_schedule(seq, valor_pct, months)"
    )
    .eq("price_list_version_id", versionId)
    .eq("activo", true);
  if (policyErr) throw policyErr;

  const { data: monotributoRows, error: monoErr } = await supabase
    .from("monotributo_brackets")
    .select("letra, monto");
  if (monoErr) throw monoErr;

  const { data: configRows, error: configErr } = await supabase.from("pricing_config").select("key, value");
  if (configErr) throw configErr;

  // M13: los planes también quedan versionados por lista (hoja "Info",
  // columna "Producto") — antes eran un catálogo global estático.
  const { data: planRows, error: planErr } = await supabase
    .from("price_list_version_planes")
    .select("code, nombre, sort_order")
    .eq("price_list_version_id", versionId)
    .order("sort_order");
  if (planErr) throw planErr;

  const policies: DiscountPolicy[] = (policyRows ?? []).map((p: any) => ({
    id: p.id,
    slug: p.slug,
    nombre: p.nombre,
    tipo: p.tipo,
    grupo: p.grupo,
    categoriaEspecial: p.categoria_especial,
    region: p.region,
    categoriaScope: p.categoria_scope,
    procedenciaGate: p.procedencia_gate ?? "",
    zonaFilial: p.zona_filial,
    valorPct: Number(p.valor_pct),
    permanente: p.permanente,
    plazoMeses: p.plazo_meses,
    concatenable: p.concatenable,
    requiereSlugPrefix: p.requiere_slug,
    excluyeOtros: p.excluye_otros,
    excluyeGrupo: p.excluye_grupo ?? [],
    edadMaxTitularConyuge: p.edad_max_titular_conyuge,
    detalle: p.detalle,
    fuenteComentario: p.fuente_comentario,
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
    planes: (planRows ?? []).map((p: any) => ({ code: p.code, nombre: p.nombre, sortOrder: p.sort_order })),
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

// RF-44: versiones seleccionables en el combo del cotizador — todas las
// habilitadas, sin importar su vigencia (para poder re-cotizar contra
// cualquier lista que haya existido). De la más nueva a la más vieja.
export async function listSelectablePriceListVersions(): Promise<SelectablePriceListVersion[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("price_list_versions")
    .select("id, source_filename, uploaded_at, vigencia_anio, vigencia_mes, version_num")
    .eq("habilitada", true)
    .order("uploaded_at", { ascending: false });
  return (data ?? []).map((v) => ({
    id: v.id,
    sourceFilename: v.source_filename ?? "(sin nombre)",
    uploadedAt: v.uploaded_at,
    vigenciaLabel: formatVigencia({ anio: v.vigencia_anio, mes: v.vigencia_mes }, v.version_num),
  }));
}

// Usado para el "Re-cotizar": si la cotización original usó una versión que
// después se deshabilitó, igual hay que poder mostrarla en el combo (con su
// nombre real) para no perder el dato original de la cotización.
export async function getPriceListVersionInfo(id: string): Promise<SelectablePriceListVersion | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("price_list_versions")
    .select("id, source_filename, uploaded_at, vigencia_anio, vigencia_mes, version_num")
    .eq("id", id)
    .single();
  if (!data) return null;
  return {
    id: data.id,
    sourceFilename: data.source_filename ?? "(sin nombre)",
    uploadedAt: data.uploaded_at,
    vigenciaLabel: formatVigencia({ anio: data.vigencia_anio, mes: data.vigencia_mes }, data.version_num),
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
    .select("id, vigencia_anio, vigencia_mes, version_num")
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
      ? { id: actualRow.id, label: formatVigencia({ anio: actualRow.vigencia_anio, mes: actualRow.vigencia_mes }, actualRow.version_num) }
      : null,
    actualEsFallback: !matchHoy && !!actualRow,
    siguiente: matchSiguiente
      ? { id: matchSiguiente.id, label: formatVigencia({ anio: matchSiguiente.vigencia_anio, mes: matchSiguiente.vigencia_mes }, matchSiguiente.version_num) }
      : null,
  };
}

// RF-68: a qué versión apunta una carga según el modo elegido — "pisar"
// apunta siempre a la vigencia del mes calendario de HOY (vigenciaDeHoy());
// "proximo" apunta al mes calendario siguiente. Antes esto se resolvía a
// partir de la fila con status='active' en la base, pero esa columna es
// mutable y quedó vestigial — eso causó que se creara una vigencia de más
// (Noviembre 2026) por un valor de status desactualizado. Ahora depende
// únicamente de la fecha real, nunca de un flag guardado. Si ya existe una
// versión con la vigencia calculada, se sobrescribe (con confirmación
// aparte en el cliente); si no existe ninguna, se crea de cero.
export type UploadTarget = {
  vigencia: { anio: number; mes: number };
  existingId: string | null;
  existingVersionNum: number | null;
};

export async function resolveUploadTarget(modo: "pisar" | "proximo"): Promise<UploadTarget> {
  const supabase = createServiceClient();
  const hoy = vigenciaDeHoy();
  const target = modo === "pisar" ? hoy : nextVigencia(hoy);

  const { data: existing } = await supabase
    .from("price_list_versions")
    .select("id, version_num")
    .eq("vigencia_anio", target.anio)
    .eq("vigencia_mes", target.mes)
    .maybeSingle();

  return { vigencia: target, existingId: existing?.id ?? null, existingVersionNum: existing?.version_num ?? null };
}

// RF-M9: "AMBA"/"Vol" acá son solo para satisfacer la firma de
// loadPricingData — discount_policies no se filtra por región/categoría,
// así que no importa que ese código exista o no en el set de esta versión.
export async function loadAllDiscountPolicies(priceListVersionId: string): Promise<DiscountPolicy[]> {
  const data = await loadPricingData("AMBA", "Vol", priceListVersionId);
  return data.policies;
}

// RF-M9: regiones y filiales pasan a estar versionadas por lista de
// precios (snapshot de la hoja "Info" del Excel de esa carga) — antes eran
// un catálogo global único, sin importar qué lista se estuviera cotizando.
export async function getRegionsAndFiliales(priceListVersionId: string) {
  const supabase = createServiceClient();
  const { data: regions } = await supabase
    .from("price_list_version_regions")
    .select("code, nombre, sort_order")
    .eq("price_list_version_id", priceListVersionId)
    .order("sort_order");
  const { data: filiales } = await supabase
    .from("price_list_version_filiales")
    .select("code, region_code, nombre, sort_order")
    .eq("price_list_version_id", priceListVersionId)
    .order("sort_order");
  return { regions: regions ?? [], filiales: filiales ?? [] };
}
