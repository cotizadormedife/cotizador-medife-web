import type { ActivePolicySummary, Miembro } from "@/lib/pricing/types";

const fmtPctAbs = (n: number) => `${Math.round(Math.abs(n) * 100)}%`;

// RF-M11: texto de composición del grupo familiar para la fila "Grupo
// Familiar" del PDF de cotización (ej. "Matrimonio (36−40) + 1 Hijo/a").
export function composicionLabel(miembros: Miembro[]): string {
  const titular = miembros.find((m) => m.tipo === "Titular");
  const esposos = miembros.filter((m) => m.tipo === "Esposo/a");
  const hijos = miembros.filter((m) => m.tipo === "Hijo/a");
  const familiares = miembros.filter((m) => m.tipo === "Familiar a cargo");

  if (!titular) return "Grupo Familiar";

  const parts: string[] = [];
  parts.push(esposos.length > 0 ? `Matrimonio (${titular.rango})` : `Titular (${titular.rango})`);
  if (hijos.length > 0) parts.push(hijos.length === 1 ? "1 Hijo/a" : `${hijos.length} Hijos/as`);
  if (familiares.length > 0) parts.push(familiares.length === 1 ? "1 Familiar a cargo" : `${familiares.length} Familiares a cargo`);

  return parts.join(" + ");
}

// Cronograma legible de una política — "(permanente)", "10% × 6 meses" o el
// detalle escalonado completo ("30% × 3 meses · 20% × 2 meses · ...").
export function cronogramaLabel(p: ActivePolicySummary): string {
  if (p.permanente) return "(permanente)";
  if (p.schedule.length > 1) {
    return p.schedule.map((s) => `${fmtPctAbs(s.valorPct)} × ${s.months} meses`).join(" · ");
  }
  if (p.plazoMeses != null) return `${fmtPctAbs(p.valorPct)} × ${p.plazoMeses} meses`;
  return fmtPctAbs(p.valorPct);
}

// Condición legible: el texto de "Detalle" cuando NO es el cronograma
// escalonado (para tácticos, "Detalle" trae la descripción de alcance —
// ej. "Oro 36 a 65 años" — en vez de un "X% x N"; ya se usa así en el
// checkbox de selección de descuentos) + el texto crudo de "Comentarios".
export function condicionLabel(p: ActivePolicySummary): string {
  const esCronograma = p.schedule.length > 0 || (p.detalle != null && /\d+%/.test(p.detalle));
  const scopeFragment = !esCronograma ? p.detalle : null;
  const fragments = [scopeFragment, p.fuenteComentario].filter((s): s is string => Boolean(s && s.trim()));
  return fragments.length > 0 ? fragments.join(" · ") : "—";
}

export function cambioLabel(cambio: { nombre: string; valorPct: number; permanente: boolean; plazoMeses: number | null }, month: number): string {
  const plazo = cambio.permanente ? "permanente" : cambio.plazoMeses != null ? `${cambio.plazoMeses} meses` : "temporal";
  return `A partir de cuota ${month}: ${cambio.nombre} ${fmtPctAbs(cambio.valorPct)} sobre valor final (${plazo})`;
}

// Origen del aporte de un integrante, para el detalle del grupo familiar del
// PDF (solo aplica a Obligatorio — en Voluntario no se pide sueldo). El
// combo del formulario (QuoteForm.tsx) muestra "Medifé" seleccionado por
// default sin que el usuario lo toque (value={m.obraSocial ?? "Medife"}),
// así que acá hay que tratar el campo vacío igual — si no, se mostraba "—"
// aunque el formulario ya mostraba "Medifé" elegido.
export function origenLabel(m: Miembro): string {
  if (m.obraSocial === "MONOTRIBUTO") return `Monotributo (Cat. ${m.monotributoCat ?? "—"})`;
  if (m.obraSocial === "OBRAS SOCIALES") return "Obra Social";
  return "Medifé";
}

export { fmtPctAbs };
