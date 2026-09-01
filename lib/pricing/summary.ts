import type { Miembro } from "./types";

export function summarizeMiembros(miembros: Miembro[]): string {
  if (!miembros?.length) return "—";
  return miembros.map((m) => `${m.tipo} (${m.rango || "s/d"})`).join(", ");
}

// % de descuento comercial ofrecido, tomando el plan PLATA (índice 4) como referencia,
// igual que el resto de la UI usa PLATA como plan destacado.
export function descuentoOfrecidoPct(output: any): number {
  const plata = output?.planes?.[4];
  return plata?.descuentoComercialPct ?? 0;
}
