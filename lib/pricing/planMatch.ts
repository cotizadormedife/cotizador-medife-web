// M13: helper compartido para matchear el nombre de un plan tal como
// aparece en distintas hojas del Excel (columna "Producto" de "Info",
// encabezados de "Resumen LP" y de "Políticas Comerciales") contra el
// nombre del plan en el catálogo — no siempre coinciden letra a letra
// (ej. "BRONCE CLASSIC" en el Excel vs "BRONCE C." en el catálogo).

function foldAccents(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Alias conocidos: texto real del Excel -> nombre equivalente en el catálogo.
const PLAN_NOMBRE_ALIASES: Record<string, string> = {
  "bronce classic": "bronce c.",
};

export function normalizePlanName(raw: string): string {
  const folded = foldAccents(raw);
  return PLAN_NOMBRE_ALIASES[folded] ?? folded;
}

export function matchesPlanName(a: string, b: string): boolean {
  if (!a || !b) return false;
  return normalizePlanName(a) === normalizePlanName(b);
}
