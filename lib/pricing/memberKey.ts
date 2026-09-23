import type { Miembro, TipoMiembro } from "./types";

export const RANGOS_BY_TIPO: Record<TipoMiembro, string[]> = {
  Titular: ["0-25", "26-35", "36-40", "41-50", "51-60", "61-65", "66+"],
  "Esposo/a": ["0-25", "26-35", "36-40", "41-50", "51-60", "61-65", "66+"],
  "Hijo/a": ["0-1", "2-20", "21-25", "26-29", "30-39", "40-49"],
  "Familiar a cargo": ["Familiar a cargo"],
};

// Interior (no-AMBA) usa un selector de rango distinto para Hijo/a en la UI.
export const RANGOS_HIJO_INTERIOR = ["Hijo 1", "Hijo 2", "Hijo Mayor a Cargo"];

export function rangoEfectivo(m: Miembro): string {
  return m.rango || RANGOS_BY_TIPO[m.tipo][0];
}

// RF-91: Titular y Esposo/a con distinto rango de edad se cotizan ambos con
// el rango más alto entre los dos (pedido de Diego) — no aplica a Hijo/a ni
// Familiar a cargo, y un Titular sin Esposo/a (o viceversa) no se ve afectado.
export function rangoEfectivoPareja(m: Miembro, miembros: Miembro[]): string {
  if (m.tipo !== "Titular" && m.tipo !== "Esposo/a") return rangoEfectivo(m);
  const propio = rangoEfectivo(m);
  const pareja = miembros.find((x) => x !== m && (x.tipo === "Titular" || x.tipo === "Esposo/a"));
  if (!pareja) return propio;
  const orden = RANGOS_BY_TIPO.Titular;
  const otro = rangoEfectivo(pareja);
  return orden.indexOf(otro) > orden.indexOf(propio) ? otro : propio;
}

// Traduce (tipo, rango) a la clave usada en la tabla de precios (age_bracket code).
// Espejo exacto de getMiembroKey() del cotizador legacy.
export function getMiembroKey(tipo: TipoMiembro, rango: string): string {
  if (tipo === "Titular") {
    if (rango === "0-25") return "0-25";
    if (rango === "26-35") return "26-35";
    if (rango === "36-40") return "36-40";
    if (rango === "41-50") return "41-50";
    if (rango === "51-60") return "51-60";
    if (rango === "61-65") return "61-65";
    return "66-00";
  }
  if (tipo === "Esposo/a") {
    if (rango === "0-25") return "MAT-0-25";
    if (rango === "26-35") return "MAT-26-35";
    if (rango === "36-40") return "MAT-36-40";
    if (rango === "41-50") return "MAT-41-50";
    if (rango === "51-60") return "MAT-51-60";
    if (rango === "61-65") return "MAT-61-65";
    return "MAT-66-00";
  }
  if (tipo === "Hijo/a") {
    const rr = rango || "0-1";
    if (rr === "0-1" || rr === "Hijo 1") return "HIJO-0-1";
    if (rr === "2-20" || rr === "Hijo 2") return "HIJO-2-20";
    if (rr === "21-25") return "HIJO-21-25";
    if (rr === "26-29") return "HIJO-26-29";
    if (rr === "30-39" || rr === "Hijo Mayor a Cargo") return "HIJO-30-39";
    if (rr === "40-49") return "HIJO-40-49";
    return "HIJO-0-1";
  }
  return "FAM";
}

// Rangos de "Ajuste Lista Hijos": hijos hasta 25 (AMBA) equivalentes en Interior.
export function esHijoElegibleAjuste(rangoEf: string): boolean {
  return (
    rangoEf === "0-1" ||
    rangoEf === "2-20" ||
    rangoEf === "21-25" ||
    rangoEf === "Hijo 1" ||
    rangoEf === "Hijo 2"
  );
}
