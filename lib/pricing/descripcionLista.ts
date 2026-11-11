// RF-122: descripción opcional de una lista de precios.
export const DESCRIPCION_LISTA_MAX = 50;

// Texto limpio para guardar: sin espacios de más, null si quedó vacío.
// Devuelve { error } si supera el máximo (en caracteres, no en bytes: las tildes cuentan 1).
export function normalizarDescripcionLista(valor: unknown): { valor: string | null } | { error: string } {
  const t = typeof valor === "string" ? valor.replace(/\s+/g, " ").trim() : "";
  if (t === "") return { valor: null };
  if ([...t].length > DESCRIPCION_LISTA_MAX) return { error: `La descripción puede tener hasta ${DESCRIPCION_LISTA_MAX} caracteres.` };
  return { valor: t };
}
