import { limitesMesAR, mesAR, type ClaveMes } from "../fechas";

// RF-106: cálculo del Dashboard estadístico. Funciones puras (sin acceso a la
// base) para poder probarlas con datos armados a mano.

export type PersonaDash = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  email: string;
  empresa_id: string | null;
  status: string;
  disabled_at: string | null;
  created_at: string;
};
export type EmpresaDash = { id: string; nombre: string };
export type CotizacionDash = { created_by: string; created_at: string };

export type FilaGrafico = {
  clave: string;
  etiqueta: string;
  porMes: Record<ClaveMes, number>;
  total: number;
};

export type Estadistica = {
  meses: ClaveMes[];
  totalCotizaciones: number;
  totalVendedores: number;
  vendedoresQueCotizaron: number;
  promedio: number;
  filas: FilaGrafico[];
};

// "Vendedor" = usuario aprobado y habilitado (cualquier rol: todos cotizan).
export function esVendedorActivo(p: Pick<PersonaDash, "status" | "disabled_at">): boolean {
  return p.status === "approved" && !p.disabled_at;
}

export function nombrePersona(p: Pick<PersonaDash, "nombre" | "apellido" | "email">): string {
  const n = `${p.nombre ?? ""} ${p.apellido ?? ""}`.trim();
  return n || p.email;
}

function ordenarMeses(meses: ClaveMes[]): ClaveMes[] {
  return [...new Set(meses)].sort();
}

// Un vendedor cuenta para el período si ya existía al terminar el último mes
// elegido (si no, un mes viejo se promediaría contra gente que aún no estaba).
function existiaAlCierre(p: PersonaDash, meses: ClaveMes[]): boolean {
  if (meses.length === 0) return false;
  return new Date(p.created_at) < new Date(limitesMesAR(meses[meses.length - 1]).hasta);
}

function filaVacia(clave: string, etiqueta: string, meses: ClaveMes[]): FilaGrafico {
  return { clave, etiqueta, porMes: Object.fromEntries(meses.map((m) => [m, 0])), total: 0 };
}

function armar(
  meses: ClaveMes[],
  filas: Map<string, FilaGrafico>,
  totalVendedores: number,
  vendedoresQueCotizaron: number
): Estadistica {
  const lista = [...filas.values()].sort((a, b) => b.total - a.total || a.etiqueta.localeCompare(b.etiqueta, "es"));
  const totalCotizaciones = lista.reduce((s, f) => s + f.total, 0);
  return {
    meses,
    totalCotizaciones,
    totalVendedores,
    vendedoresQueCotizaron,
    promedio: totalVendedores > 0 ? totalCotizaciones / totalVendedores : 0,
    filas: lista,
  };
}

// Pestaña "Empresas/Grupos": una fila por empresa elegida.
export function resumirPorEmpresa(args: {
  empresas: EmpresaDash[]; // las elegidas
  personas: PersonaDash[]; // todas (se asigna cada cotización a la empresa de su autor)
  cotizaciones: CotizacionDash[];
  meses: ClaveMes[];
}): Estadistica {
  const meses = ordenarMeses(args.meses);
  const mesesSet = new Set(meses);
  const empresaDe = new Map(args.personas.map((p) => [p.id, p.empresa_id]));
  const filas = new Map(args.empresas.map((e) => [e.id, filaVacia(e.id, e.nombre, meses)]));

  const autores = new Set<string>();
  for (const c of args.cotizaciones) {
    const mes = mesAR(c.created_at);
    if (!mesesSet.has(mes)) continue;
    const empresaId = empresaDe.get(c.created_by);
    const fila = empresaId ? filas.get(empresaId) : undefined;
    if (!fila) continue;
    fila.porMes[mes] += 1;
    fila.total += 1;
    autores.add(c.created_by);
  }

  const vendedores = args.personas.filter(
    (p) => p.empresa_id && filas.has(p.empresa_id) && esVendedorActivo(p) && existiaAlCierre(p, meses)
  ).length;
  return armar(meses, filas, vendedores, autores.size);
}

// Nombre de la persona con su grupo/empresa entre paréntesis (lo ve el super_admin,
// que compara personas de distintos grupos). Sin grupo conocido, solo el nombre.
export function etiquetaConGrupo(p: Pick<PersonaDash, "nombre" | "apellido" | "email">, grupo?: string | null): string {
  return grupo ? `${nombrePersona(p)} (${grupo})` : nombrePersona(p);
}

// Pestaña "Personas": una fila por persona elegida. El promedio es contra la
// cantidad de personas elegidas (el usuario las eligió a propósito).
export function resumirPorPersona(args: {
  personas: PersonaDash[]; // las elegidas
  cotizaciones: CotizacionDash[];
  meses: ClaveMes[];
  empresas?: { id: string; nombre: string }[]; // si viene, cada etiqueta lleva el grupo entre paréntesis
}): Estadistica {
  const meses = ordenarMeses(args.meses);
  const mesesSet = new Set(meses);
  const grupos = new Map((args.empresas ?? []).map((e) => [e.id, e.nombre]));
  const filas = new Map(
    args.personas.map((p) => [p.id, filaVacia(p.id, etiquetaConGrupo(p, p.empresa_id ? grupos.get(p.empresa_id) : null), meses)])
  );

  const autores = new Set<string>();
  for (const c of args.cotizaciones) {
    const mes = mesAR(c.created_at);
    if (!mesesSet.has(mes)) continue;
    const fila = filas.get(c.created_by);
    if (!fila) continue;
    fila.porMes[mes] += 1;
    fila.total += 1;
    autores.add(c.created_by);
  }
  return armar(meses, filas, args.personas.length, autores.size);
}
