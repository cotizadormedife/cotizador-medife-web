export type Categoria = "Vol" | "Obl";
export type Procedencia = "Otros" | "comprobable";
export type TipoMiembro = "Titular" | "Esposo/a" | "Hijo/a" | "Familiar a cargo";

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

export type DiscountPolicy = {
  id: string;
  nombre: string;
  tipo: "dto" | "gaf" | "ucc" | "recargo";
  region: string;
  categoriaScope: Categoria | null;
  procedenciaGate: string;
  zonaFilial: string | null;
  valorPct: number;
  permanente: boolean;
  plazoMeses: number | null;
  concatenable: boolean;
  detalle: string | null;
  planRules: PlanRule[];
  schedule: ScheduleBlock[];
};

export type PricingData = {
  prices: PriceRow[]; // ya filtrados por region+categoria
  policies: DiscountPolicy[]; // todas las políticas activas (sin filtrar por elegibilidad todavía)
  monotributoBrackets: Record<string, number>;
  config: Record<string, number>;
  priceListVersionId: string;
};

export type PlanBreakdown = {
  planCode: string;
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
};

export type QuoteResult = {
  priceListVersionId: string;
  planes: PlanBreakdown[];
  usoInterno: {
    ajusteHijosPct: number;
    segmentoJovenPct: number;
  };
  activePolicies: Array<{ id: string; nombre: string; detalle: string | null }>;
  proyeccionCuotas: CuotaProyeccion[];
  recargoInfo: { activo: boolean; pct: number; detalle: string } | null;
};
