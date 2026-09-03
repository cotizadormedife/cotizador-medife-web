import { requireApprovedUser } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/service";
import { summarizeMiembros, descuentoOfrecidoPct } from "@/lib/pricing/summary";
import QuoteDetailActions from "../QuoteDetailModal";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ numero?: string }>;
}) {
  const profile = await requireApprovedUser();
  const { numero } = await searchParams;
  const supabase = createServiceClient();

  let query = supabase
    .from("quotes")
    .select(
      "id, quote_number, created_at, vendedor_nombre, asociado_nombre, region_code, filial_code, categoria, vigencia, input, output, price_list_versions(uploaded_at)"
    )
    .eq("created_by", profile.id);
  if (numero) query = query.eq("quote_number", Number(numero));
  query = query.order("created_at", { ascending: false });

  const { data: quotes } = await query;

  return (
    <div>
      <h1 style={{ fontSize: 22, margin: "0 0 16px" }}>Mi historial</h1>

      <div className="card">
        <form method="get" style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-end" }}>
          <label style={labelStyle}>
            N° de cotización
            <input type="number" inputMode="numeric" min={1} step={1} name="numero" defaultValue={numero ?? ""} />
          </label>
          <button type="submit" className="btn-primary">
            Filtrar
          </button>
        </form>
      </div>

      {!quotes || quotes.length === 0 ? (
        <p style={{ color: "var(--text-neutral)" }}>
          {numero ? "No se encontró ninguna cotización con ese número." : "Todavía no generaste ninguna cotización."}
        </p>
      ) : (
        <div className="card">
          <div className="table-scroll">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={th}>N°</th>
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
                    <td style={td}>{q.quote_number}</td>
                    <td style={td}>{new Date(q.created_at).toLocaleString("es-AR")}</td>
                    <td style={td}>{q.asociado_nombre}</td>
                    <td style={td}>{q.region_code}</td>
                    <td style={td}>{q.categoria === "Vol" ? "Voluntario" : "Obligatorio"}</td>
                    <td style={td}>{summarizeMiembros(q.input?.miembros ?? [])}</td>
                    <td style={td}>{Math.round(descuentoOfrecidoPct(q.output) * 100)}%</td>
                    <td style={td}>
                      {q.price_list_versions?.uploaded_at ? new Date(q.price_list_versions.uploaded_at).toLocaleString("es-AR") : "—"}
                    </td>
                    <td style={td}>
                      <QuoteDetailActions
                        quoteId={q.id}
                        result={q.output}
                        input={q.input}
                        meta={{
                          numero: q.quote_number,
                          fecha: new Date(q.created_at).toLocaleString("es-AR"),
                          vendedor: q.vendedor_nombre,
                          asociado: q.asociado_nombre,
                          region: q.region_code,
                          categoria: q.categoria,
                          filial: q.filial_code,
                          vigencia: q.vigencia,
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

const labelStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600 };
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", borderBottom: "2px solid var(--border-default)", whiteSpace: "nowrap" };
const td: React.CSSProperties = { textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--border-disabled)" };
