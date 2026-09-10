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

// Además de isPolicyRelevant, algunos descuentos tácticos con rango de edad en el id
// (dto-mes-XX-YY / dto-indie-XX-YY) solo aparecen si algún Titular/Esposo cae en ese rango.
export function isPolicyMemberEligible(policy: DiscountPolicy, miembros: Miembro[], isAMBA: boolean): boolean {
  const ageMatch = policy.id.match(/dto-(?:mes|indie)-(\d+)-(\d+)/);
  if (ageMatch) {
    const minAge = parseInt(ageMatch[1], 10);
    const maxAge = parseInt(ageMatch[2], 10);
    return miembros.some((m) => {
      if (m.tipo !== "Titular" && m.tipo !== "Esposo/a") return false;
      if (!m.rango) return false;
      const start = RANGO_STARTS[m.rango] ?? -1;
      const end = RANGO_ENDS[m.rango] ?? -1;
      if (start < 0 || end < 0) return false;
      return end >= minAge && start <= maxAge;
    });
  }
  // RF-61: Opción 6 exige Titular y Cónyuge de hasta 60 años (Hijos y Familiar
  // a cargo no la afectan).
  if (policy.id.startsWith("opcion-6")) {
    return miembros.every((m) => {
      if (m.tipo !== "Titular" && m.tipo !== "Esposo/a") return true;
      const r = rangoEfectivo(m);
      return r !== "61-65" && r !== "66+";
    });
  }
  return true;
}

// Elegibilidad de un usuario individual seleccionable: excluye las 4 categorías
// "automáticas" (ajuste-lista-hijos, segmento-joven-*, descuento-filial-*) — esas
// nunca se muestran como checkbox, se aplican solas.
export function isAutoPolicy(policy: DiscountPolicy): boolean {
  return (
    policy.id.startsWith("ajuste-lista-hijos") ||
    policy.id.startsWith("segmento-joven") ||
    policy.id.startsWith("descuento-filial")
  );
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
  return policies.find((p) => p.id.startsWith("ajuste-lista-hijos") && isPolicyRelevant(p, ctx)) ?? null;
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
    ? policies.find((p) => p.id.startsWith("segmento-joven-h-25") && isPolicyRelevant(p, ctx)) ?? null
    : null;
  const h29 = hayTitJoven29
    ? policies.find((p) => p.id.startsWith("segmento-joven-h-29") && isPolicyRelevant(p, ctx)) ?? null
    : null;

  return { h25, h29 };
}

export function findDescuentoFilialPolicy(
  policies: DiscountPolicy[],
  ctx: { region: string; categoria: string; procedencia: Procedencia; filial: string }
): DiscountPolicy | null {
  return policies.find((p) => p.id.startsWith("descuento-filial") && isPolicyRelevant(p, ctx)) ?? null;
}
