import { createServiceClient } from "@/lib/supabase/service";
import { computeNextVigencia } from "@/lib/pricing/repository";
import { formatVigencia } from "@/lib/pricing/vigencia";
import UploadForm from "./UploadForm";
import ActivateButton from "./ActivateButton";
import ToggleHabilitadaButton from "./ToggleHabilitadaButton";

export default async function PriceListsPage() {
  const supabase = createServiceClient();
  const [{ data: versionsData }, nextVigencia] = await Promise.all([
    supabase
      .from("price_list_versions")
      .select("id, source_filename, status, habilitada, vigencia_anio, vigencia_mes, uploaded_at, activated_at, parse_report, uploader:profiles!price_list_versions_uploaded_by_fkey(nombre, apellido), activator:profiles!price_list_versions_activated_by_fkey(nombre, apellido)")
      .order("uploaded_at", { ascending: false }),
    computeNextVigencia(),
  ]);
  const versions = (versionsData ?? []) as any[];

  const active = versions.find((v: any) => v.status === "active");

  return (
    <div>
      <h1 style={{ fontSize: 22, margin: "0 0 16px" }}>Precios y descuentos</h1>

      <div className="card">
        <h2 style={{ fontSize: 16, margin: "0 0 10px" }}>Versión activa</h2>
        {active ? (
          <p style={{ fontSize: 14, color: "var(--text-neutral)", margin: 0 }}>
            <strong>{formatVigencia({ anio: active.vigencia_anio, mes: active.vigencia_mes })}</strong> (
            {active.source_filename}) — activada el{" "}
            {active.activated_at ? new Date(active.activated_at).toLocaleString("es-AR") : "—"}
            {active.activator ? ` por ${active.activator.nombre} ${active.activator.apellido}` : ""}
          </p>
        ) : (
          <p style={{ fontSize: 14, color: "var(--text-neutral)", margin: 0 }}>No hay ninguna versión activa.</p>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: 16, margin: "0 0 10px" }}>Cargar nueva lista de precios</h2>
        <p style={{ fontSize: 13, color: "var(--text-neutral)", margin: "0 0 16px" }}>
          Subí el archivo .xlsx con la hoja "Resumen LP". Se valida e interpreta antes de activarla — la
          carga queda en borrador hasta que la actives explícitamente. La próxima que subas quedará con
          vigencia <strong>{formatVigencia(nextVigencia)}</strong>, asignada automáticamente.
        </p>
        <UploadForm />
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
                <th style={th}>Habilitada</th>
                <th style={th}>Subida</th>
                <th style={th}>Activada</th>
                <th style={th}>Celdas</th>
                <th style={th}>Avisos</th>
                <th style={th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(versions ?? []).map((v: any) => (
                <tr key={v.id}>
                  <td style={td}>
                    <strong>{formatVigencia({ anio: v.vigencia_anio, mes: v.vigencia_mes })}</strong>
                  </td>
                  <td style={td}>{v.source_filename}</td>
                  <td style={td}>{v.status}</td>
                  <td style={td}>{v.status === "draft" ? "—" : v.habilitada ? "Sí" : "No"}</td>
                  <td style={td}>
                    {new Date(v.uploaded_at).toLocaleString("es-AR")}
                    {v.uploader ? ` · ${v.uploader.nombre} ${v.uploader.apellido}` : ""}
                  </td>
                  <td style={td}>{v.activated_at ? new Date(v.activated_at).toLocaleString("es-AR") : "—"}</td>
                  <td style={td}>{v.parse_report?.totalCells ?? "—"}</td>
                  <td style={td}>{v.parse_report?.warnings?.length ?? 0}</td>
                  <td style={td}>
                    {v.status === "draft" && <ActivateButton versionId={v.id} />}
                    {v.status !== "draft" && <ToggleHabilitadaButton versionId={v.id} habilitada={v.habilitada} />}
                  </td>
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
