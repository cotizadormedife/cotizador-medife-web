import { etiquetaMes } from "@/lib/fechas";
import type { Estadistica } from "@/lib/dashboard/estadisticas";

// RF-106: presentación de resultados del Dashboard — server components, sin
// librería de gráficos. Una sola tonalidad (naranja de la marca) para las
// barras: comparan magnitud, no identidad; el detalle por mes va en columnas
// aparte y en la tabla, en vez de apilar hasta 12 colores.

const fmtEntero = (n: number) => n.toLocaleString("es-AR");
const fmtPromedio = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function Tarjetas({
  e,
  vendedores,
  detallePromedio,
}: {
  e: Estadistica;
  vendedores?: { etiqueta: string; detalle: string };
  detallePromedio: string;
}) {
  return (
    <div className="dash-tiles">
      {vendedores && (
        <div className="dash-tile dash-tile--naranja">
          <div className="dash-tile-label">{vendedores.etiqueta}</div>
          <div className="dash-tile-valor">{fmtEntero(e.totalVendedores)}</div>
          <div className="dash-tile-detalle">{vendedores.detalle}</div>
        </div>
      )}
      <div className="dash-tile dash-tile--carbon">
        <div className="dash-tile-label">Cantidad de cotizaciones</div>
        <div className="dash-tile-valor">{fmtEntero(e.totalCotizaciones)}</div>
        <div className="dash-tile-detalle">En el período elegido</div>
      </div>
      <div className="dash-tile dash-tile--azul">
        <div className="dash-tile-label">Promedio de cotizaciones por vendedor</div>
        <div className="dash-tile-valor">{fmtPromedio(e.promedio)}</div>
        <div className="dash-tile-detalle">{detallePromedio}</div>
      </div>
    </div>
  );
}

export function BarrasPorEntidad({ e, titulo }: { e: Estadistica; titulo: string }) {
  const max = Math.max(1, ...e.filas.map((f) => f.total));
  return (
    <div className="card">
      <h2 style={{ fontSize: 16, margin: "0 0 4px" }}>{titulo}</h2>
      <p style={{ fontSize: 12, color: "var(--text-neutral)", margin: "0 0 14px" }}>
        Total de cotizaciones en el período, de mayor a menor ({e.filas.length} {e.filas.length === 1 ? "fila" : "filas"}).
      </p>
      {e.filas.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--text-neutral)" }}>No hay datos para mostrar.</p>
      ) : (
        <div className="dash-barras" role="list" aria-label={titulo}>
          {e.filas.map((f) => (
            <div key={f.clave} className="dash-barra-fila" role="listitem" title={`${f.etiqueta}: ${fmtEntero(f.total)} cotizaciones`}>
              <div className="dash-barra-etiqueta">{f.etiqueta}</div>
              <div className="dash-barra-pista">
                <div className="dash-barra" style={{ width: `${(f.total / max) * 100}%`, maxWidth: "calc(100% - 52px)" }} />
                <span className="dash-valor">{fmtEntero(f.total)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Solo cuando se eligen 2 o más meses: total por mes de lo seleccionado.
export function ColumnasPorMes({ e }: { e: Estadistica }) {
  if (e.meses.length < 2) return null;
  const totales = e.meses.map((m) => e.filas.reduce((s, f) => s + (f.porMes[m] ?? 0), 0));
  const max = Math.max(1, ...totales);
  const ALTO = 170;
  return (
    <div className="card">
      <h2 style={{ fontSize: 16, margin: "0 0 4px" }}>Cotizaciones por mes</h2>
      <p style={{ fontSize: 12, color: "var(--text-neutral)", margin: "0 0 14px" }}>Suma de todo lo seleccionado, mes a mes.</p>
      <div className="dash-columnas" role="img" aria-label={`Cotizaciones por mes: ${e.meses.map((m, i) => `${etiquetaMes(m)} ${totales[i]}`).join(", ")}`}>
        {e.meses.map((m, i) => (
          <div key={m} className="dash-columna-cel" title={`${etiquetaMes(m)}: ${fmtEntero(totales[i])} cotizaciones`}>
            <span className="dash-valor" style={{ fontSize: 12 }}>{fmtEntero(totales[i])}</span>
            <div className="dash-columna" style={{ height: Math.max(2, Math.round((totales[i] / max) * ALTO)) }} />
          </div>
        ))}
      </div>
      <div className="dash-columnas-etiquetas">
        {e.meses.map((m) => (
          <span key={m}>{etiquetaMes(m)}</span>
        ))}
      </div>
    </div>
  );
}

// Vista en tabla de los mismos datos (accesible y exportable a mano).
export function TablaDetalle({ e, encabezado }: { e: Estadistica; encabezado: string }) {
  return (
    <details className="card">
      <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 14 }}>Ver el detalle en tabla</summary>
      <div className="table-scroll" style={{ marginTop: 14, marginBottom: 0, maxHeight: 480, overflow: "auto" }}>
        <table className="dash-tabla">
          <thead>
            <tr>
              <th>{encabezado}</th>
              {e.meses.map((m) => (
                <th key={m}>{etiquetaMes(m)}</th>
              ))}
              {e.meses.length > 1 && <th>Total</th>}
            </tr>
          </thead>
          <tbody>
            {e.filas.map((f) => (
              <tr key={f.clave}>
                <td>{f.etiqueta}</td>
                {e.meses.map((m) => (
                  <td key={m}>{fmtEntero(f.porMes[m] ?? 0)}</td>
                ))}
                {e.meses.length > 1 && <td style={{ fontWeight: 700 }}>{fmtEntero(f.total)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
