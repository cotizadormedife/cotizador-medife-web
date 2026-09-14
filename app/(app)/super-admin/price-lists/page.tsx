import { createServiceClient } from "@/lib/supabase/service";
import { resolveUploadTarget } from "@/lib/pricing/repository";
import { formatVigencia, vigenciaDeHoy, nextVigencia } from "@/lib/pricing/vigencia";
import UploadForm from "./UploadForm";

export default async function PriceListsPage() {
  const supabase = createServiceClient();
  const [{ data: versionsData }, proximoTarget] = await Promise.all([
    supabase
      .from("price_list_versions")
      .select("id, source_filename, vigencia_anio, vigencia_mes, version_num, uploaded_at, activated_at, parse_report, uploader:profiles!price_list_versions_uploaded_by_fkey(nombre, apellido)")
      .order("uploaded_at", { ascending: false }),
    resolveUploadTarget("proximo").catch(() => null),
  ]);
  const versions = (versionsData ?? []) as any[];

  const hoy = vigenciaDeHoy();
  const mesSiguiente = nextVigencia(hoy);

  // RF-68: "Activa" es un valor puramente calculado a partir de la vigencia
  // (mes actual o mes siguiente) — no hay ningún flag guardado ni forma
  // manual de cambiarlo desde la pantalla.
  function esActiva(v: any): boolean {
    const vig = { anio: v.vigencia_anio, mes: v.vigencia_mes };
    return (vig.anio === hoy.anio && vig.mes === hoy.mes) || (vig.anio === mesSiguiente.anio && vig.mes === mesSiguiente.mes);
  }

  const actual = versions.find((v: any) => v.vigencia_anio === hoy.anio && v.vigencia_mes === hoy.mes);

  const versionesOrdenadas = [...versions].sort((a, b) => {
    const aActiva = esActiva(a);
    const bActiva = esActiva(b);
    if (aActiva !== bActiva) return aActiva ? -1 : 1;
    return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
  });

  const existingProximoLabel = proximoTarget?.existingId
    ? formatVigencia(proximoTarget.vigencia, proximoTarget.existingVersionNum ?? 1)
    : null;

  return (
    <div>
      <h1 style={{ fontSize: 22, margin: "0 0 16px" }}>Precios y descuentos</h1>

      <div className="card">
        <h2 style={{ fontSize: 16, margin: "0 0 10px" }}>Versión vigente (mes actual)</h2>
        {actual ? (
          <p style={{ fontSize: 14, color: "var(--text-neutral)", margin: 0 }}>
            <strong>{formatVigencia({ anio: actual.vigencia_anio, mes: actual.vigencia_mes }, actual.version_num)}</strong> (
            {actual.source_filename}) — última carga el{" "}
            {new Date(actual.uploaded_at).toLocaleString("es-AR")}
            {actual.uploader ? ` por ${actual.uploader.nombre} ${actual.uploader.apellido}` : ""}
          </p>
        ) : (
          <p style={{ fontSize: 14, color: "var(--text-neutral)", margin: 0 }}>Todavía no se cargó ninguna lista para el mes actual.</p>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: 16, margin: "0 0 10px" }}>Cargar nueva lista de precios</h2>
        <p style={{ fontSize: 13, color: "var(--text-neutral)", margin: "0 0 16px" }}>
          Subí el archivo .xlsx con la hoja "Resumen LP". Se valida e interpreta, y queda utilizable de inmediato
          — no hace falta ningún paso aparte de activación. "Pisar lista del mes actual" reemplaza los precios de{" "}
          {actual ? (
            <strong>{formatVigencia({ anio: actual.vigencia_anio, mes: actual.vigencia_mes }, actual.version_num)}</strong>
          ) : (
            "el mes actual"
          )}{" "}
          ahora mismo. "Lista del próximo mes"{" "}
          {existingProximoLabel ? (
            <>
              reemplaza la que ya está cargada (<strong>{existingProximoLabel}</strong>)
            </>
          ) : (
            <>
              carga por primera vez <strong>{proximoTarget ? formatVigencia(proximoTarget.vigencia, 1) : "el mes siguiente"}</strong>
            </>
          )}
          .
        </p>
        <UploadForm existingProximoLabel={existingProximoLabel} />
      </div>

      <div className="card">
        <h2 style={{ fontSize: 16, margin: "0 0 14px" }}>Historial de versiones</h2>
        <div className="table-scroll">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={th}>Vigencia</th>
                <th style={th}>Archivo</th>
                <th style={th}>Estado</th>
                <th style={th}>Subida</th>
                <th style={th}>Activada</th>
                <th style={th}>Celdas</th>
                <th style={th}>Avisos</th>
              </tr>
            </thead>
            <tbody>
              {versionesOrdenadas.map((v: any) => (
                <tr key={v.id}>
                  <td style={td}>
                    <strong>{formatVigencia({ anio: v.vigencia_anio, mes: v.vigencia_mes }, v.version_num)}</strong>
                  </td>
                  <td style={td}>{v.source_filename}</td>
                  <td style={td}>{esActiva(v) ? "Activa" : "Inactiva"}</td>
                  <td style={td}>
                    {new Date(v.uploaded_at).toLocaleString("es-AR")}
                    {v.uploader ? ` · ${v.uploader.nombre} ${v.uploader.apellido}` : ""}
                  </td>
                  <td style={td}>{v.activated_at ? new Date(v.activated_at).toLocaleString("es-AR") : "—"}</td>
                  <td style={td}>{v.parse_report?.totalCells ?? "—"}</td>
                  <td style={td}>{v.parse_report?.warnings?.length ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", borderBottom: "2px solid var(--border-default)", whiteSpace: "nowrap" };
const td: React.CSSProperties = { textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--border-disabled)" };
