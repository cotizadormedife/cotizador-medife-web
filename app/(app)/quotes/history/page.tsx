import { requireApprovedUser } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/service";
import { summarizeMiembros, descuentoOfrecidoPct } from "@/lib/pricing/summary";
import QuoteDetailActions from "../QuoteDetailModal";

export default async function HistoryPage() {
  const profile = await requireApprovedUser();
  const supabase = createServiceClient();

  const { data: quotes } = await supabase
    .from("quotes")
    .select("id, created_at, vendedor_nombre, asociado_nombre, region_code, filial_code, categoria, vigencia, input, output, price_list_versions(source_filename, uploaded_at)")
    .eq("created_by", profile.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 style={{ fontSize: 22, margin: "0 0 16px" }}>Mi historial</h1>
      {!quotes || quotes.length === 0 ? (
        <p style={{ color: "var(--text-neutral)" }}>Todavía no generaste ninguna cotización.</p>
      ) : (
        <div className="card">
          <div className="table-scroll">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={th}>Fecha</th>
                  <th style={th}>Cliente</th>
                  <th style={th}>Región</th>
                  <th style={th}>Categoría</th>
                  <th style={th}>Grupo familiar</th>
                  <th style={th}>% Descuento (PLATA)</th>
                  <th style={th}>Lista de precios</th>
                  <th style={th}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q: any) => (
                  <tr key={q.id}>
                    <td style={td}>{new Date(q.created_at).toLocaleString("es-AR")}</td>
                    <td style={td}>{q.asociado_nombre}</td>
                    <td style={td}>{q.region_code}</td>
                    <td style={td}>{q.categoria === "Vol" ? "Voluntario" : "Obligatorio"}</td>
                    <td style={td}>{summarizeMiembros(q.input?.miembros ?? [])}</td>
                    <td style={td}>{Math.round(descuentoOfrecidoPct(q.output) * 100)}%</td>
                    <td style={td}>
                      {q.price_list_versions?.source_filename ?? "—"}
                      {q.price_list_versions?.uploaded_at && (
                        <div style={{ fontSize: 11, color: "var(--text-neutral)" }}>
                          {new Date(q.price_list_versions.uploaded_at).toLocaleDateString("es-AR")}
                        </div>
                      )}
                    </td>
                    <td style={td}>
                      <QuoteDetailActions
                        quoteId={q.id}
                        result={q.output}
                        input={q.input}
                        meta={{
                          fecha: new Date(q.created_at).toLocaleString("es-AR"),
                          vendedor: q.vendedor_nombre,
                          asociado: q.asociado_nombre,
                          region: q.region_code,
                          categoria: q.categoria,
                          filial: q.filial_code,
                          vigencia: q.vigencia,
                          listaPrecios: q.price_list_versions?.source_filename,
                          listaPreciosFecha: q.price_list_versions?.uploaded_at
                            ? new Date(q.price_list_versions.uploaded_at).toLocaleString("es-AR")
                            : undefined,
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", borderBottom: "2px solid var(--border-default)", whiteSpace: "nowrap" };
const td: React.CSSProperties = { textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--border-disabled)" };
