import type { DiscountPolicy, Miembro, Procedencia } from "./types";
import { rangoEfectivo } from "./memberKey";

const SUR_EXT_REGIONS = ["Sur", "Patagonia", "Bahía/MDQ"];

export function isRegionOk(policyRegion: string, region: string): boolean {
  return (
    policyRegion === "Nac" ||
    policyRegion === region ||
    (policyRegion === "Interior" && region !== "AMBA") ||
    (policyRegion === "SurExt" && SUR_EXT_REGIONS.includes(region))
  );
}

export function isCategoriaOk(policy: DiscountPolicy, categoria: string): boolean {
  return policy.categoriaScope === null || policy.categoriaScope === categoria;
}

export function isProcedenciaOk(policy: DiscountPolicy, procedencia: Procedencia): boolean {
  const p = policy.procedenciaGate;
  return !p || p === procedencia || p === "GAF" || (p === "comprobable" && procedencia === "comprobable");
}

export function isZonaOk(policy: DiscountPolicy, filial: string): boolean {
  if (!policy.zonaFilial) return true;
  return policy.zonaFilial
    .split(",")
    .map((s) => s.trim())
    .includes(filial);
}

// Filtro base "es relevante para este contexto" — no mira composición del grupo familiar.
export function isPolicyRelevant(
  policy: DiscountPolicy,
  ctx: { region: string; categoria: string; procedencia: Procedencia; filial: string }
): boolean {
  return (
    isRegionOk(policy.region, ctx.region) &&
    isCategoriaOk(policy, ctx.categoria) &&
    isProcedenciaOk(policy, ctx.procedencia) &&
    isZonaOk(policy, ctx.filial)
  );
}

// Cubre los 7 tramos reales de Titular/Esposo (RANGOS_BY_TIPO en memberKey.ts).
// RF-61/RF-62: antes tenía cortes de 5 años (41-45/46-50/51-55/56-60) que no
// coinciden con ningún valor real del formulario ("41-50"/"51-60"), y usaba
// "66-00" en vez de "66+" — por eso un Titular/Esposo solo en esos tramos no
// activaba correctamente los descuentos tácticos con rango de edad en el id.
const RANGO_STARTS: Record<string, number> = {
  "0-25": 0,
  "26-35": 26,
  "36-40": 36,
  "41-50": 41,
  "51-60": 51,
  "61-65": 61,
  "66+": 66,
};
const RANGO_ENDS: Record<string, number> = {
  "0-25": 25,
  "26-35": 35,
  "36-40": 40,
  "41-50": 50,
  "51-60": 60,
  "61-65": 65,
  "66+": 200,
};

// RF-M8: el rango de edad de los descuentos tácticos (Dto Mes/Dto Indie) se
// lee de la "Descripción" del Excel (ej. "Dto Mes 36/40_Bronce"), que el
// importador copia tal cual al slug (dto-mes-36-40-... / dto-indie-18-25-...)
// — se sigue matcheando por slug acá para no duplicar el parseo de rango.
export function isPolicyMemberEligible(policy: DiscountPolicy, miembros: Miembro[], isAMBA: boolean): boolean {
  const ageMatch = policy.slug.match(/dto-(?:mes|indie)-(\d+)-(\d+)/);
  if (ageMatch) {
    const minAge = parseInt(ageMatch[1], 10);
    const maxAge = parseInt(ageMatch[2], 10);
    const rangeOk = miembros.some((m) => {
      if (m.tipo !== "Titular" && m.tipo !== "Esposo/a") return false;
      if (!m.rango) return false;
      const start = RANGO_STARTS[m.rango] ?? -1;
      const end = RANGO_ENDS[m.rango] ?? -1;
      if (start < 0 || end < 0) return false;
      return end >= minAge && start <= maxAge;
    });
    if (!rangeOk) return false;
  }
  // RF-61/RF-M8: algunas políticas (ej. Opción 6) traen del Excel un tope de
  // edad para Titular/Cónyuge (Hijos y Familiar a cargo no la afectan).
  if (policy.edadMaxTitularConyuge != null) {
    return miembros.every((m) => {
      if (m.tipo !== "Titular" && m.tipo !== "Esposo/a") return true;
      const r = rangoEfectivo(m);
      const end = RANGO_ENDS[r] ?? 0;
      return end <= policy.edadMaxTitularConyuge!;
    });
  }
  return true;
}

// RF-61/RF-M8: algunas políticas (ej. Opción 6) solo son válidas si otra
// también está seleccionada (leído de "Comentarios" del Excel: "Concatenable
// con la opción 4" → requiereSlugPrefix="opcion-4").
export function isRequisitoCumplido(policy: DiscountPolicy, selectedSlugs: string[]): boolean {
  if (!policy.requiereSlugPrefix) return true;
  return selectedSlugs.some((slug) => slug.startsWith(policy.requiereSlugPrefix!));
}

// RF-M8: reglas de exclusión leídas de "Comentarios" del Excel —
// excluyeOtros (ej. Opción 7: "No acumulable con otros descuentos") y
// excluyeGrupo (ej. Dto Indie: "No Acumulable con Descuento Estratégico").
export function isExclusionOk(policy: DiscountPolicy, otrosSeleccionados: DiscountPolicy[]): boolean {
  const otrosNoAutomaticos = otrosSeleccionados.filter((p) => p.id !== policy.id && !isAutoPolicy(p));
  if (policy.excluyeOtros && otrosNoAutomaticos.length > 0) return false;
  if (otrosNoAutomaticos.some((p) => p.excluyeGrupo.includes(policy.grupo))) return false;
  if (policy.excluyeGrupo.length > 0 && otrosNoAutomaticos.some((p) => policy.excluyeGrupo.includes(p.grupo))) return false;
  return true;
}

// RF-M10: versión simétrica de isExclusionOk para un par de políticas —
// usada al tildar un checkbox, para destildar en el momento cualquier otra
// ya seleccionada que sea incompatible (en cualquiera de los dos sentidos:
// "a" excluye a "b", o "b" excluye a "a"), en vez de dejar que el motor la
// ignore en silencio al calcular.
export function isCompatible(a: DiscountPolicy, b: DiscountPolicy): boolean {
  if (a.id === b.id) return true;
  if (isAutoPolicy(a) || isAutoPolicy(b)) return true; // las automáticas no compiten con nada
  if (a.excluyeOtros || b.excluyeOtros) return false;
  if (a.excluyeGrupo.includes(b.grupo)) return false;
  if (b.excluyeGrupo.includes(a.grupo)) return false;
  return true;
}

// RF-M10: dos descuentos tácticos no pueden convivir para el mismo plan —
// si se superponen en al menos un plan, se muestra/aplica solo el de mayor
// magnitud de descuento; el resto se descarta por completo (no solo para
// ese plan puntual, la fila entera queda afuera).
export function magnitudPlan(policy: DiscountPolicy): number {
  let max = 0;
  for (const rule of policy.planRules) {
    if (!rule.aplica) continue;
    const v = Math.abs(rule.valorOverride ?? policy.valorPct);
    if (v > max) max = v;
  }
  return max;
}

export function dedupeTacticosByPlan(tacticos: DiscountPolicy[]): DiscountPolicy[] {
  const sorted = [...tacticos].sort((a, b) => magnitudPlan(b) - magnitudPlan(a));
  const accepted: DiscountPolicy[] = [];
  for (const p of sorted) {
    const pPlanes = new Set(p.planRules.filter((r) => r.aplica).map((r) => r.planCode));
    const colisiona = accepted.some((a) => a.planRules.some((r) => r.aplica && pPlanes.has(r.planCode)));
    if (!colisiona) accepted.push(p);
  }
  return accepted;
}

// Elegibilidad de un usuario individual seleccionable: excluye las 4 categorías
// "automáticas" (ajuste hijos, segmento joven, descuento filial) — esas
// nunca se muestran como checkbox, se aplican solas.
export function isAutoPolicy(policy: DiscountPolicy): boolean {
  return policy.categoriaEspecial != null;
}

export function selectableDiscountPolicies(
  policies: DiscountPolicy[],
  ctx: { region: string; categoria: string; procedencia: Procedencia; filial: string; miembros: Miembro[] }
): DiscountPolicy[] {
  const isAMBA = ctx.region === "AMBA";
  return policies.filter(
    (p) =>
      !isAutoPolicy(p) &&
      p.tipo !== "recargo" &&
      isPolicyRelevant(p, ctx) &&
      isPolicyMemberEligible(p, ctx.miembros, isAMBA)
  );
}

// ── Elegibilidad de las políticas automáticas (ajuste hijos / segmento joven / filial) ──

export function findAjusteHijosPolicy(
  policies: DiscountPolicy[],
  ctx: { region: string; categoria: string; procedencia: Procedencia; filial: string; miembros: Miembro[] }
): DiscountPolicy | null {
  const hayHijo = ctx.miembros.some((m) => m.tipo === "Hijo/a");
  if (!hayHijo) return null;
  return policies.find((p) => p.categoriaEspecial === "ajuste_hijos" && isPolicyRelevant(p, ctx)) ?? null;
}

export function findSegmentoJovenPolicies(
  policies: DiscountPolicy[],
  ctx: { region: string; categoria: string; procedencia: Procedencia; filial: string; miembros: Miembro[] }
): { h25: DiscountPolicy | null; h29: DiscountPolicy | null } {
  const isAMBA = ctx.region === "AMBA";
  const hayEsposo = ctx.miembros.some((m) => m.tipo === "Esposo/a");
  const hayHijo = ctx.miembros.some((m) => m.tipo === "Hijo/a");
  const sinFamiliaAMBA = isAMBA && !hayEsposo && !hayHijo;

  const hayTitJoven25 = ctx.miembros.some((m) => m.tipo === "Titular" && rangoEfectivo(m) === "0-25");
  const espososInterior = !isAMBA ? ctx.miembros.filter((m) => m.tipo === "Esposo/a") : [];
  const hayEspJoven25 = !isAMBA && espososInterior.length > 0 && espososInterior.every((m) => rangoEfectivo(m) === "0-25");
  const hayTitJoven29 = isAMBA && sinFamiliaAMBA && ctx.miembros.some((m) => m.tipo === "Titular" && rangoEfectivo(m) === "26-35");

  const interiorConEsposo = !isAMBA && espososInterior.length > 0;
  const segJovenEligible =
    (isAMBA && sinFamiliaAMBA && hayTitJoven25) || (!isAMBA && hayTitJoven25 && (!interiorConEsposo || hayEspJoven25));

  const h25 = segJovenEligible
    ? policies.find((p) => p.categoriaEspecial === "segmento_joven_h25" && isPolicyRelevant(p, ctx)) ?? null
    : null;
  const h29 = hayTitJoven29
    ? policies.find((p) => p.categoriaEspecial === "segmento_joven_h29" && isPolicyRelevant(p, ctx)) ?? null
    : null;

  return { h25, h29 };
}

export function findDescuentoFilialPolicy(
  policies: DiscountPolicy[],
  ctx: { region: string; categoria: string; procedencia: Procedencia; filial: string }
): DiscountPolicy | null {
  return policies.find((p) => p.categoriaEspecial === "descuento_filial" && isPolicyRelevant(p, ctx)) ?? null;
}
