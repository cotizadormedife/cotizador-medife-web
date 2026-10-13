import { etiquetaMes } from "@/lib/fechas";
import type { Estadistica } from "@/lib/dashboard/estadisticas";
import { anchoBarra, elegirSeries, escalaY, estiloSerie, mostrarValores } from "@/lib/dashboard/grafico";

// RF-106/RF-107: presentación de resultados del Dashboard — server components,
// sin librería de gráficos. El gráfico es siempre comparativo: una barra por
// persona o empresa, una al lado de la otra, mes a mes (nunca sumadas en una
// sola).

const fmtEntero = (n: number) => n.toLocaleString("es-AR");
const fmtPromedio = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export type Tarjeta = {
  color: "naranja" | "gris" | "carbon" | "azul";
  etiqueta: string;
  valor: string;
  detalle?: string;
  desglose?: { etiqueta: string; valor: string }[]; // cifras chicas dentro de la misma tarjeta
};

export const tarjetaNumero = (color: Tarjeta["color"], etiqueta: string, n: number, detalle?: string): Tarjeta => ({ color, etiqueta, valor: fmtEntero(n), detalle });
export const fmtCantidad = fmtEntero;
export const tarjetaPromedio = (etiqueta: string, n: number, detalle: string, desglose?: Tarjeta["desglose"]): Tarjeta => ({
  color: "azul",
  etiqueta,
  valor: fmtPromedio(n),
  detalle,
  desglose,
});
export const fmtDecimal = fmtPromedio;

export function Tarjetas({ titulo, tarjetas, compacto }: { titulo?: string; tarjetas: Tarjeta[]; compacto?: boolean }) {
  return (
    <section aria-label={titulo}>
      {titulo && <h2 className="dash-tiles-titulo">{titulo}</h2>}
      <div className={compacto ? "dash-tiles dash-tiles--general" : "dash-tiles"}>
        {tarjetas.map((t) => (
          <div key={t.etiqueta} className={`dash-tile dash-tile--${t.color}`}>
            <div className="dash-tile-label">{t.etiqueta}</div>
            <div className="dash-tile-valor">{t.valor}</div>
            {t.desglose && (
              <dl className="dash-tile-desglose">
                {t.desglose.map((d) => (
                  <div key={d.etiqueta}>
                    <dt>{d.etiqueta}</dt>
                    <dd>{d.valor}</dd>
                  </div>
                ))}
              </dl>
            )}
            {t.detalle && <div className="dash-tile-detalle">{t.detalle}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}

const ALTO = 320; // alto del área de barras, en px
const ALTO_ETIQUETA = 24; // franja de los nombres de mes, debajo de las barras

export function Comparativa({ e, singular, plural }: { e: Estadistica; singular: string; plural: string }) {
  const { series, totalElegidas, recortado } = elegirSeries(e.filas);
  const hayDatos = series.length > 0;
  const maximo = Math.max(0, ...series.flatMap((s) => e.meses.map((m) => s.porMes[m] ?? 0)));
  const { tope, ticks } = escalaY(maximo);
  const ancho = anchoBarra(series.length);
  const conValores = mostrarValores(series.length, e.meses.length);

  return (
    <div className="card">
      <h2 style={{ fontSize: 16, margin: "0 0 4px" }}>Cotizaciones por mes</h2>
      <p style={{ fontSize: 12, color: "var(--text-neutral)", margin: "0 0 14px" }}>
        Comparativa de {plural}, una barra por {singular} en cada mes.
        {recortado && (
          <>
            {" "}
            <strong>Se muestran las {series.length} con más cotizaciones de las {totalElegidas} elegidas</strong> — para compararlas a todas, elegí menos.
          </>
        )}
      </p>

      {!hayDatos ? (
        <p style={{ fontSize: 14, color: "var(--text-neutral)" }}>No hay datos para mostrar.</p>
      ) : (
        <>
          <ul className="dash-leyenda" aria-label="Referencias">
            {series.map((s, i) => (
              <li key={s.clave}>
                <span className="dash-leyenda-color" style={estiloSerie(i)} aria-hidden="true" />
                <span className="dash-leyenda-nombre">{s.etiqueta}</span>
                <span className="dash-leyenda-total">{fmtEntero(s.total)} en el período</span>
              </li>
            ))}
          </ul>

          <div
            className="dash-comp"
            role="img"
            aria-label={`Cotizaciones por mes: ${series.map((s) => `${s.etiqueta} ${fmtEntero(s.total)} en total`).join(", ")}`}
          >
            <div className="dash-comp-eje" style={{ height: ALTO + ALTO_ETIQUETA }}>
              {ticks.map((t) => (
                <span key={t} style={{ bottom: ALTO_ETIQUETA + (t / tope) * ALTO }}>
                  {fmtEntero(t)}
                </span>
              ))}
            </div>
            <div className="dash-comp-scroll">
              <div className="dash-comp-plot" style={{ height: ALTO + ALTO_ETIQUETA }}>
                {ticks.map((t) => (
                  <div key={t} className="dash-comp-linea" style={{ bottom: ALTO_ETIQUETA + (t / tope) * ALTO }} />
                ))}
                <div className="dash-comp-clusters">
                  {e.meses.map((m) => (
                    <div key={m} className="dash-comp-cluster">
                      <div className="dash-comp-barras" style={{ height: ALTO }}>
                        {series.map((s, i) => {
                          const v = s.porMes[m] ?? 0;
                          return (
                            <div
                              key={s.clave}
                              className="dash-comp-barra"
                              style={{ width: ancho, height: Math.max(v > 0 ? 3 : 1, Math.round((v / tope) * ALTO)), ...estiloSerie(i) }}
                              title={`${s.etiqueta} · ${etiquetaMes(m)}: ${fmtEntero(v)} cotizaciones`}
                            >
                              {conValores && <span className="dash-comp-valor">{fmtEntero(v)}</span>}
                            </div>
                          );
                        })}
                      </div>
                      <div className="dash-comp-mes" style={{ height: ALTO_ETIQUETA }}>
                        {etiquetaMes(m)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
