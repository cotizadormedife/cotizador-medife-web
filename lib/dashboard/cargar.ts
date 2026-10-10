import { createServiceClient } from "@/lib/supabase/service";
import { limitesMesAR, type ClaveMes } from "@/lib/fechas";
import type { CotizacionDash, EmpresaDash, PersonaDash } from "./estadisticas";

// RF-106: PostgREST devuelve como máximo 1000 filas por consulta, así que se
// pagina. Solo se piden las columnas necesarias para contar.
async function traerTodo<T>(pedir: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const todo: T[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await pedir(desde, desde + 999);
    if (error) throw new Error(error.message);
    todo.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return todo;
}

export async function cargarEmpresasYPersonas(): Promise<{ empresas: EmpresaDash[]; personas: PersonaDash[] }> {
  const supabase = createServiceClient();
  const [empresas, personas] = await Promise.all([
    traerTodo<EmpresaDash>((a, b) => supabase.from("empresas").select("id, nombre").order("nombre").order("id").range(a, b)),
    traerTodo<PersonaDash>((a, b) =>
      supabase
        .from("profiles")
        .select("id, nombre, apellido, email, empresa_id, status, disabled_at, created_at")
        .order("created_at")
        .order("id")
        .range(a, b)
    ),
  ]);
  return { empresas, personas };
}

// Cotizaciones desde el inicio del primer mes elegido hasta el fin del último
// (meses completos, hora de Argentina). Los meses salteados se descartan después.
export async function cargarCotizaciones(meses: ClaveMes[]): Promise<CotizacionDash[]> {
  if (meses.length === 0) return [];
  const ordenados = [...meses].sort();
  const desde = limitesMesAR(ordenados[0]).desde;
  const hasta = limitesMesAR(ordenados[ordenados.length - 1]).hasta;
  const supabase = createServiceClient();
  return traerTodo<CotizacionDash>((a, b) =>
    supabase.from("quotes").select("created_by, created_at").gte("created_at", desde).lt("created_at", hasta).order("created_at").order("id").range(a, b)
  );
}

// Cotizaciones de un rango de meses completos (hora de Argentina), con las
// páginas pedidas en paralelo: sirve tanto para las estadísticas como para saber
// qué personas y empresas tuvieron actividad en cada mes (filtros del Dashboard).
export async function cargarCotizacionesRango(primerMes: ClaveMes, ultimoMes: ClaveMes): Promise<CotizacionDash[]> {
  const desde = limitesMesAR(primerMes).desde;
  const hasta = limitesMesAR(ultimoMes).hasta;
  const supabase = createServiceClient();
  const { count, error } = await supabase.from("quotes").select("id", { count: "exact", head: true }).gte("created_at", desde).lt("created_at", hasta);
  if (error) throw new Error(error.message);
  const paginas = Math.ceil((count ?? 0) / 1000);
  const todo: CotizacionDash[] = [];
  const EN_PARALELO = 8;
  for (let i = 0; i < paginas; i += EN_PARALELO) {
    const lote = await Promise.all(
      Array.from({ length: Math.min(EN_PARALELO, paginas - i) }, async (_, k) => {
        const a = (i + k) * 1000;
        const { data, error: e } = await supabase
          .from("quotes")
          .select("created_by, created_at")
          .gte("created_at", desde)
          .lt("created_at", hasta)
          .order("created_at")
          .order("id")
          .range(a, a + 999);
        if (e) throw new Error(e.message);
        return (data ?? []) as CotizacionDash[];
      })
    );
    for (const filas of lote) todo.push(...filas);
  }
  return todo;
}
