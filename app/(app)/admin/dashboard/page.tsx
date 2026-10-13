import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { claveMes, hoyAR, mesesQueCorresponden } from "@/lib/fechas";
import { DASHBOARD_RELEASE_APROBADO, puedeVerDashboard } from "@/lib/dashboard/acceso";
import { cargarCotizacionesRango, cargarEmpresasYPersonas, cargarTotalCotizaciones } from "@/lib/dashboard/cargar";
import { actividadPorMes, cotizacionesGenerales, etiquetaConGrupo, nombrePersona, resumenGeneral, resumirPorEmpresa, resumirPorPersona, tuvoActividad } from "@/lib/dashboard/estadisticas";
import DashboardFilters from "./DashboardFilters";
import { Comparativa, fmtCantidad, fmtDecimal, Tarjetas, tarjetaNumero, tarjetaPromedio } from "./Resultados";

type Param = string | string[] | undefined;
type SearchParams = {
  tab?: string;
  f?: string;
  anio?: string;
  mes?: Param;
  empresa?: Param;
  todasEmpresas?: string;
  persona?: Param;
  todasPersonas?: string;
};

const lista = (v: Param): string[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const PRIMER_ANIO_CON_DATOS = 2026;

// RF-106: Dashboard estadístico. Hasta que se apruebe el release solo lo ve el
// usuario habilitado en lib/dashboard/acceso.ts (para el resto es una página
// que no existe).
export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const perfil = await requireRole(["admin", "super_admin"]);
  if (!puedeVerDashboard(perfil)) notFound();

  const sp = await searchParams;
  const esSuper = perfil.role === "super_admin";
  // La pestaña Empresas/Grupos es solo del super_admin (se valida acá, no solo en el menú).
  const tab: "personas" | "empresas" = sp.tab === "empresas" && esSuper ? "empresas" : "personas";
  const aplicado = sp.f === "1";

  const hoy = hoyAR();
  const anioPedido = Number(sp.anio);
  const anio = Number.isInteger(anioPedido) && anioPedido >= PRIMER_ANIO_CON_DATOS && anioPedido <= Math.max(hoy.anio, PRIMER_ANIO_CON_DATOS) ? anioPedido : hoy.anio;
  const disponibles = mesesQueCorresponden(anio, hoy);
  const mesesPedidos = lista(sp.mes).map(Number).filter((m) => Number.isInteger(m) && disponibles.includes(m));
  const mesesElegidos = aplicado ? [...new Set(mesesPedidos)].sort((a, b) => a - b) : disponibles.includes(hoy.mes) ? [hoy.mes] : [];
  const claves = mesesElegidos.map((m) => claveMes(anio, m));
  const anios = Array.from({ length: Math.max(hoy.anio, PRIMER_ANIO_CON_DATOS) - PRIMER_ANIO_CON_DATOS + 1 }, (_, i) => PRIMER_ANIO_CON_DATOS + i);

  const [{ empresas, personas }, cotizaciones, totalHistorico] = await Promise.all([cargarEmpresasYPersonas(), cargarCotizacionesRango(claveMes(PRIMER_ANIO_CON_DATOS, 1), claveMes(hoy.anio, hoy.mes)), cargarTotalCotizaciones()]);
  // Las estadísticas filtran por los meses elegidos; el año completo sirve para saber
  // quién tuvo actividad en cada mes (los filtros solo ofrecen a quien cotizó en el período).
  const actividad = actividadPorMes(cotizaciones, personas);
  const todasLasEmpresasIds = empresas.map((e) => e.id);

  // Empresas elegidas (super_admin). Un admin queda siempre limitado a la suya.
  let empresasElegidasIds: string[];
  if (esSuper) {
    const validas = new Set(todasLasEmpresasIds);
    empresasElegidasIds = !aplicado || sp.todasEmpresas === "1" ? todasLasEmpresasIds : [...new Set(lista(sp.empresa))].filter((id) => validas.has(id));
  } else {
    empresasElegidasIds = perfil.empresa_id ? [perfil.empresa_id] : [];
  }

  // Personas que se pueden elegir: aprobadas, de los grupos permitidos.
  const nombreEmpresa = new Map(empresas.map((e) => [e.id, e.nombre]));
  const alcance = new Set(empresasElegidasIds);
  const enAlcance = personas
    .filter((p) => p.status === "approved" && p.empresa_id && alcance.has(p.empresa_id))
    .sort((a, b) => nombrePersona(a).localeCompare(nombrePersona(b), "es"));
  const candidatas = enAlcance.filter((p) => tuvoActividad(actividad.personas[p.id], claves));
  const personasElegidas = !aplicado || sp.todasPersonas === "1" ? candidatas : candidatas.filter((p) => new Set(lista(sp.persona)).has(p.id));

  // Empresas/Grupos elegidos que cotizaron en el período: son las que ofrece el filtro y las que se cuentan.
  const empresasActivasElegidasIds = empresasElegidasIds.filter((id) => !esSuper || tuvoActividad(actividad.empresas[id], claves));

  const estadistica =
    tab === "empresas"
      ? resumirPorEmpresa({ empresas: empresas.filter((e) => empresasActivasElegidasIds.includes(e.id)), personas, cotizaciones, meses: claves })
      : resumirPorPersona({ personas: personasElegidas, cotizaciones, meses: claves, empresas: esSuper ? empresas : undefined });

  const hayFiltro = claves.length > 0;

  // Pestaña Empresas/Grupos: totales de toda la aplicación (siempre visibles, no dependen de la selección).
  const general = resumenGeneral(empresas, personas);
  const generales = cotizacionesGenerales(totalHistorico, cotizaciones);
  const porVendedorActivo = (n: number) => (general.vendedoresActivos > 0 ? n / general.vendedoresActivos : 0);

  return (
    <div>
      <h1 style={{ fontSize: 22, margin: "0 0 6px" }}>Dashboard estadístico</h1>
      {!DASHBOARD_RELEASE_APROBADO && (
        <p style={{ fontSize: 12, color: "var(--text-neutral)", margin: "0 0 16px" }}>
          Versión de prueba: por ahora solo la ve tu usuario, hasta que se apruebe el release.
        </p>
      )}

      <nav className="dash-tabs" aria-label="Secciones del dashboard">
        <Link className="dash-tab" href="/admin/dashboard?tab=personas" aria-current={tab === "personas" ? "page" : undefined}>
          Personas
        </Link>
        {esSuper && (
          <Link className="dash-tab" href="/admin/dashboard?tab=empresas" aria-current={tab === "empresas" ? "page" : undefined}>
            Empresas / Grupos
          </Link>
        )}
      </nav>

      {tab === "empresas" && (
        <Tarjetas
          titulo="Total de la aplicación"
          compacto
          tarjetas={[
            tarjetaNumero("naranja", "Brokers / Grupos activos", general.gruposActivos, "Con al menos un vendedor activo"),
            tarjetaNumero("gris", "Vendedores activos", general.vendedoresActivos, "Usuarios aprobados y habilitados hoy"),
            {
              color: "carbon",
              etiqueta: "Cotizaciones",
              valor: fmtCantidad(generales.totales),
              desglose: [
                { etiqueta: "Este año", valor: fmtCantidad(generales.esteAnio) },
                { etiqueta: "Este mes", valor: fmtCantidad(generales.esteMes) },
                { etiqueta: "Este día", valor: fmtCantidad(generales.hoy) },
              ],
            },
            tarjetaPromedio(
              "Promedio por vendedor activo",
              porVendedorActivo(generales.totales),
              undefined,
              [
                { etiqueta: "Este mes", valor: fmtDecimal(porVendedorActivo(generales.esteMes)) },
                { etiqueta: "Este día", valor: fmtDecimal(porVendedorActivo(generales.hoy)) },
              ]
            ),
          ]}
        />
      )}

      <DashboardFilters
        key={`${tab}-${aplicado ? "f" : "d"}-${sp.anio ?? ""}`}
        tab={tab}
        esSuper={esSuper}
        empresas={tab === "empresas" || esSuper ? empresas : []}
        personas={tab === "personas" ? enAlcance.map((p) => ({ id: p.id, nombre: etiquetaConGrupo(p, esSuper ? nombreEmpresa.get(p.empresa_id ?? "") : null), empresaId: p.empresa_id, deshabilitada: !!p.disabled_at })) : []}
        actividad={{
          personas: tab === "personas" ? Object.fromEntries(enAlcance.map((p) => [p.id, actividad.personas[p.id] ?? []])) : {},
          empresas: actividad.empresas,
        }}
        hoy={hoy}
        anios={anios}
        inicial={{ anio, meses: mesesElegidos, empresasSel: empresasActivasElegidasIds, personasSel: personasElegidas.map((p) => p.id) }}
        abiertoPorDefecto={!aplicado}
      />

      {!hayFiltro ? (
        <p style={{ color: "var(--text-neutral)" }}>Elegí al menos un mes para ver las estadísticas.</p>
      ) : (
        <>
          {tab === "empresas" ? (
            <Tarjetas
              titulo="Selección"
              tarjetas={[
                tarjetaNumero("naranja", "Grupos seleccionados", estadistica.filas.length, `De ${general.gruposActivos} grupos activos en total`),
                tarjetaNumero("gris", "Cantidad de vendedores seleccionados", estadistica.totalVendedores, `${estadistica.vendedoresQueCotizaron} cotizaron en el período · vendedores = usuarios aprobados y habilitados de los grupos elegidos`),
                tarjetaNumero("carbon", "Cantidad de cotizaciones", estadistica.totalCotizaciones, "De los grupos elegidos, en el período"),
                tarjetaPromedio("Promedio de cotizaciones por vendedor", estadistica.promedio, "Cotizaciones ÷ vendedores seleccionados"),
              ]}
            />
          ) : (
            <Tarjetas
              tarjetas={[
                tarjetaNumero("carbon", "Cantidad de cotizaciones", estadistica.totalCotizaciones, "En el período elegido"),
                tarjetaPromedio(
                  "Promedio de cotizaciones por vendedor",
                  estadistica.promedio,
                  `Cotizaciones ÷ ${estadistica.totalVendedores} ${estadistica.totalVendedores === 1 ? "persona elegida" : "personas elegidas"}`
                ),
              ]}
            />
          )}
          <Comparativa
            e={estadistica}
            singular={tab === "empresas" ? "empresa o grupo" : "persona"}
            plural={tab === "empresas" ? "empresas y grupos" : "personas"}
          />
        </>
      )}
    </div>
  );
}
