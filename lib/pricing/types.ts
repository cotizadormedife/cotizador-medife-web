export type Categoria = "Vol" | "Obl";
export type Procedencia = "Otros" | "comprobable";
export type TipoMiembro = "Titular" | "Esposo/a" | "Hijo/a" | "Familiar a cargo";

// M13: los planes/productos ya no son un catálogo fijo — se leen de cada
// Excel (hoja "Info", columna "Producto") y quedan versionados por lista
// (pueden cambiar de cantidad y de orden de una lista a otra). Este array
// queda solo como valor por default para el motor de cálculo cuando no se
// provee `PricingData.planes` (tests existentes, principalmente).
export const PLANES = [
  "INDIE",
  "MEDIFEPLUS",
  "BRONCE_C",
  "BRONCE",
  "PLATA",
  "ORO",
  "PLATINUM",
] as const;
export const PLAN_LABELS: Record<string, string> = {
  INDIE: "INDIE",
  MEDIFEPLUS: "MEDIFÉ+",
  BRONCE_C: "BRONCE C.",
  BRONCE: "BRONCE",
  PLATA: "PLATA",
  ORO: "ORO",
  PLATINUM: "PLATINUM",
};

export type PlanRef = { code: string; nombre: string; sortOrder: number };

export type Miembro = {
  tipo: TipoMiembro;
  rango: string;
  sueldo?: number;
  obraSocial?: "OBRAS SOCIALES" | "Medife" | "MONOTRIBUTO";
  monotributoCat?: string;
};

export type QuoteInput = {
  region: string;
  categoria: Categoria;
  procedencia: Procedencia;
  filial: string;
  miembros: Miembro[];
  // ids de discount_policies elegidos manualmente por el usuario (estratégicos/tácticos/GAF)
  selectedPolicyIds: string[];
};

export type PriceRow = {
  ageBracketCode: string;
  planCode: string;
  monto: number;
};

export type PlanRule = { planCode: string; aplica: boolean; valorOverride: number | null };
export type ScheduleBlock = { seq: number; valorPct: number; months: number };

// RF-M8: "grupo" viene directo de la columna "Tipo" del Excel y reemplaza
// la adivinanza por prefijo de id que usaba el motor antes.
export type PolicyGrupo = "gaf" | "recargo" | "ajuste" | "estrategico" | "tactico" | "otro";
// Las 4 categorías "automáticas": nunca se muestran como checkbox, se
// aplican solas cuando corresponde (reemplaza isAutoPolicy por prefijo de id).
export type PolicyCategoriaEspecial = "ajuste_hijos" | "segmento_joven_h25" | "segmento_joven_h29" | "descuento_filial";

export type DiscountPolicy = {
  id: string;
  slug: string; // clasificación estable dentro de la versión (ej. "opcion-4-nac-Obl") — ya no es globalmente única
  nombre: string;
  tipo: "dto" | "gaf" | "ucc" | "recargo";
  grupo: PolicyGrupo;
  categoriaEspecial: PolicyCategoriaEspecial | null;
  region: string;
  categoriaScope: Categoria | null;
  procedenciaGate: string;
  zonaFilial: string | null;
  valorPct: number;
  permanente: boolean;
  plazoMeses: number | null;
  concatenable: boolean;
  // RF-M8: reglas de combinación leídas de la columna "Comentarios" del Excel.
  requiereSlugPrefix: string | null; // ej. "opcion-4" — exige otra política seleccionada cuyo slug empiece así
  excluyeOtros: boolean; // ej. Opción 7: no puede convivir con ninguna otra política seleccionable
  excluyeGrupo: PolicyGrupo[]; // ej. Dto Indie: no puede convivir con nada de "estrategico"
  edadMaxTitularConyuge: number | null; // ej. Opción 6: solo Titular/Cónyuge hasta esa edad
  detalle: string | null;
  fuenteComentario: string | null; // texto crudo de "Comentarios" del Excel (reglas de combinación)
  planRules: PlanRule[];
  schedule: ScheduleBlock[];
};

export type PricingData = {
  prices: PriceRow[]; // ya filtrados por region+categoria
  policies: DiscountPolicy[]; // todas las políticas activas (sin filtrar por elegibilidad todavía)
  monotributoBrackets: Record<string, number>;
  config: Record<string, number>;
  priceListVersionId: string;
  // M13: planes de esta versión, en el orden real del Excel ("Info" ->
  // "Producto"). Si viene vacío, el motor cae al set estático PLANES.
  planes?: PlanRef[];
};

export type PlanBreakdown = {
  planCode: string;
  nombre: string; // etiqueta para mostrar (viene del Excel, ya no de un mapeo fijo)
  subtotal: number; // precio de lista, suma de integrantes
  ajusteHijos: number; // $ (negativo)
  segmentoJoven: number; // $ (negativo)
  dtoNom: number; // subtotal + ajusteHijos + segmentoJoven
  descuentoFilialPct: number;
  descuentoFilial: number; // $ (negativo)
  descuentoComercialPct: number; // total, ya clampeado a -70%
  descuentoComercial: number; // $ (negativo), sobre dtoNom
  ucc: number; // $ (negativo)
  iva: number; // $ (positivo, solo Vol)
  aportes: number; // $ (negativo, solo Obl)
  gafInteresPct: number;
  gafInteres: number; // $ (puede ser negativo)
  total: number; // 1ª cuota final
};

export type CuotaProyeccion = {
  month: number;
  gafActivo: boolean;
  porPlan: Record<string, number>;
  // Políticas de plazo fijo/escalonado (mainBlanket/concatBlanket) que empiezan
  // a tener efecto recién a partir de este mes (ej. una concatenable que
  // arranca cuando termina el plazo de la principal) — para anotarlo en la
  // proyección de cuotas impresa ("A partir de cuota N: ...").
  cambios: Array<{ nombre: string; valorPct: number; permanente: boolean; plazoMeses: number | null }>;
};

export type ActivePolicySummary = {
  id: string;
  nombre: string;
  detalle: string | null;
  valorPct: number;
  automatica: boolean; // true = Ajuste Hijos/Segmento Joven/Descuento Filial (se aplican solas, no se listan como elegidas)
  slug: string;
  grupo: PolicyGrupo;
  permanente: boolean;
  plazoMeses: number | null;
  concatenable: boolean;
  schedule: ScheduleBlock[];
  edadMaxTitularConyuge: number | null;
  fuenteComentario: string | null;
  planRules: PlanRule[];
};

export type QuoteResult = {
  priceListVersionId: string;
  planes: PlanBreakdown[];
  usoInterno: {
    // % equivalente por plan, para cargar en el sistema. null = no aplica en ese plan.
    ajusteHijosPct: (number | null)[];
    segmentoJovenPct: (number | null)[];
  };
  activePolicies: ActivePolicySummary[];
  proyeccionCuotas: CuotaProyeccion[];
  recargoInfo: { activo: boolean; pct: number; detalle: string } | null;
};
