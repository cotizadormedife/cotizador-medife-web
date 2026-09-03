import { createServiceClient } from "@/lib/supabase/service";
import { requireRole } from "@/lib/auth/session";
import { listEmpresas, isMedife } from "@/lib/empresas";
import { summarizeMiembros, descuentoOfrecidoPct } from "@/lib/pricing/summary";
import QuoteDetailActions from "../../quotes/QuoteDetailModal";

type SearchParams = {
  desde?: string;
  hasta?: string;
  usuario?: string;
  empresa?: string;
  orden?: "fecha" | "usuario";
};

export default async function AdminQuotesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const actor = await requireRole(["admin", "super_admin"]);
  const scoped = actor.role === "admin" && !isMedife(actor.empresa_id);

  const { desde, hasta, usuario, empresa, orden } = await searchParams;
  const supabase = createServiceClient();

  let usuariosQuery = supabase.from("profiles").select("id, nombre, apellido, email, empresa_id").order("nombre");
  if (scoped) usuariosQuery = usuariosQuery.eq("empresa_id", actor.empresa_id);
  const { data: usuarios } = await usuariosQuery;

  const empresas = scoped ? [] : await listEmpresas();

  let query = supabase
    .from("quotes")
    .select(
      "id, created_at, asociado_nombre, vendedor_nombre, region_code, filial_code, categoria, vigencia, created_by, input, output, profiles!quotes_created_by_fkey(nombre, apellido, email, empresa_id), price_list_versions(source_filename, uploaded_at)"
    );

  if (desde) query = query.gte("created_at", desde);
  if (hasta) query = query.lte("created_at", hasta);
  if (usuario) query = query.eq("created_by", usuario);

  // RF-31: un Admin de una empresa distinta de Medife solo ve cotizaciones de su propia empresa.
  if (scoped) {
    const ids = (usuarios ?? []).map((u) => u.id);
    query = query.in("created_by", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  } else if (empresa) {
    const idsDeEmpresa = (await supabase.from("profiles").select("id").eq("empresa_id", empresa)).data ?? [];
    const ids = idsDeEmpresa.map((u) => u.id);
    query = query.in("created_by", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }

  query =
    orden === "usuario"
      ? query.order("created_by", { ascending: true })
      : query.order("created_at", { ascending: false });

  const { data: quotes, error } = await query;

  return (
    <div>
      <h1 style={{ fontSize: 22, margin: "0 0 16px" }}>Todas las cotizaciones</h1>
      <div className="card">
        <form method="get" style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-end" }}>
          <label style={labelStyle}>
            Desde
            <input type="date" name="desde" defaultValue={desde} />
          </label>
          <label style={labelStyle}>
            Hasta
            <input type="date" name="hasta" defaultValue={hasta} />
          </label>
          <label style={{ ...labelStyle, minWidth: 220 }}>
            Usuario
            <select name="usuario" defaultValue={usuario ?? ""}>
              <option value="">Todos</option>
              {(usuarios ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} {u.apellido} ({u.email})
                </option>
              ))}
            </select>
          </label>
          {!scoped && (
            <label style={{ ...labelStyle, minWidth: 200 }}>
              Empresa
              <select name="empresa" defaultValue={empresa ?? ""}>
                <option value="">Todas</option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label style={labelStyle}>
            Ordenar por
            <select name="orden" defaultValue={orden ?? "fecha"}>
              <option value="fecha">Fecha</option>
              <option value="usuario">Usuario</option>
            </select>
          </label>
          <button type="submit" className="btn-primary">
            Filtrar
          </button>
        </form>
      </div>

      {error && (
        <p role="alert" style={{ color: "#c0392b" }}>
          {error.message}
        </p>
      )}

      <div className="card">
        <div className="table-scroll">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={th}>Fecha</th>
                <th style={th}>Vendedor</th>
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
              {(quotes ?? []).map((q: any) => (
                <tr key={q.id}>
                  <td style={td}>{new Date(q.created_at).toLocaleString("es-AR")}</td>
                  <td style={td}>
                    {q.profiles?.nombre} {q.profiles?.apellido} ({q.profiles?.email})
                  </td>
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
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600 };
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", borderBottom: "2px solid var(--border-default)", whiteSpace: "nowrap" };
const td: React.CSSProperties = { textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--border-disabled)" };
