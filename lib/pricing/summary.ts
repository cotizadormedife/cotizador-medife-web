import type { Miembro } from "./types";

export function summarizeMiembros(miembros: Miembro[]): string {
  if (!miembros?.length) return "—";
  return miembros.map((m) => `${m.tipo} (${m.rango || "s/d"})`).join(", ");
}

export type AppliedDiscount = { nombre: string; valorPct?: number };

// RF-23: descuentos comerciales efectivamente elegidos por el vendedor (no
// incluye los ajustes automáticos como Ajuste Lista Hijos, Segmento Joven o
// Descuento Filial, que ya se muestran aparte en el detalle de la cotización).
export function appliedDiscounts(input: any, output: any): AppliedDiscount[] {
  const selectedIds: string[] = input?.selectedPolicyIds ?? [];
  const activePolicies: any[] = output?.activePolicies ?? [];
  return activePolicies
    .filter((p) => selectedIds.includes(p.id))
    .map((p) => ({ nombre: p.nombre, valorPct: p.valorPct }));
}

export function fmtDiscountPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${Math.round(n * 100)}%`;
}
