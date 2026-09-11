import { createServiceClient } from "@/lib/supabase/service";
import { requireRole } from "@/lib/auth/session";
import { listEmpresas, isMedife } from "@/lib/empresas";
import { summarizeMiembros } from "@/lib/pricing/summary";
import QuoteDetailActions from "../../quotes/QuoteDetailModal";
import DiscountsCell from "../../quotes/DiscountsCell";
import FilterForm from "./FilterForm";

type SearchParams = {
  desde?: string;
  hasta?: string;
  usuario?: string;
  empresa?: string;
  numero?: string;
  orden?: "fecha" | "usuario";
};

export default async function AdminQuotesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const actor = await requireRole(["admin", "super_admin"]);
  const scoped = actor.role === "admin" && !isMedife(actor.empresa_id);

  const { desde, hasta, usuario, empresa, numero, orden } = await searchParams;
  const supabase = createServiceClient();

  let usuariosQuery = supabase.from("profiles").select("id, nombre, apellido, email, empresa_id").order("nombre");
  if (scoped) usuariosQuery = usuariosQuery.eq("empresa_id", actor.empresa_id);
  const { data: usuarios } = await usuariosQuery;

  const empresas = scoped ? [] : await listEmpresas();

  let query = supabase
    .from("quotes")
    .select(
      "id, quote_number, created_at, asociado_nombre, vendedor_nombre, region_code, filial_code, categoria, vigencia, created_by, input, output, profiles!quotes_created_by_fkey(nombre, apellido, email, empresa_id, empresas(nombre)), price_list_versions(uploaded_at)"
    );

  if (desde) query = query.gte("created_at", desde);
  if (hasta) query = query.lte("created_at", hasta);
  if (usuario) query = query.eq("created_by", usuario);
  if (numero) query = query.eq("quote_number", Number(numero));

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

  // T-A6: sin tope, esta consulta podía traer el padrón completo de
  // asociados (con sueldo, obra social, etc.) de una sola vez.
  const QUOTES_HARD_CAP = 1000;
  const { data: quotes, error } = await query.limit(QUOTES_HARD_CAP);

  // T-A6: acceso masivo de lectura al padrón — se registra para que quede
  // detectable (Pilar 6.4). Se espera el insert (una promesa sin await no
  // llega a ejecutarse de forma confiable una vez que el Server Component
  // termina de renderizar), pero un fallo acá no bloquea la carga de la
  // página — es un log, no una mutación de negocio.
  await supabase.from("audit_log").insert({
    actor_id: actor.id,
    action: "quotes.bulk_read",
    target_type: "quotes",
    meta: { count: quotes?.length ?? 0, filtros: { desde, hasta, usuario, empresa, numero } },
  });

  return (
    <div>
      <h1 style={{ fontSize: 22, margin: "0 0 16px" }}>Todas las cotizaciones</h1>
      <div className="card">
        <FilterForm
          desde={desde}
          hasta={hasta}
          numero={numero}
          orden={orden}
          usuario={usuario}
          empresa={empresa}
          usuarios={usuarios ?? []}
          empresas={empresas}
          scoped={scoped}
        />
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
                <th style={th}>N°</th>
                <th style={th}>Fecha</th>
                <th style={th}>Vendedor</th>
                <th style={th}>Cliente</th>
                <th style={th}>Región</th>
                <th style={th}>Categoría</th>
                <th style={th}>Grupo familiar</th>
                <th style={th}>% Descuento</th>
                <th style={th}>Lista de precios</th>
                <th style={th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(quotes ?? []).map((q: any) => (
                <tr key={q.id}>
                  <td style={td}>{q.quote_number}</td>
                  <td style={td}>{new Date(q.created_at).toLocaleString("es-AR")}</td>
                  <td style={td}>
                    {q.profiles?.nombre} {q.profiles?.apellido} ({q.profiles?.empresas?.nombre ?? "—"}) ({q.profiles?.email})
                  </td>
                  <td style={td}>{q.asociado_nombre}</td>
                  <td style={td}>{q.region_code}</td>
                  <td style={td}>{q.categoria === "Vol" ? "Voluntario" : "Obligatorio"}</td>
                  <td style={td}>{summarizeMiembros(q.input?.miembros ?? [])}</td>
                  <td style={td}>
                    <DiscountsCell input={q.input} output={q.output} />
                  </td>
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
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", borderBottom: "2px solid var(--border-default)", whiteSpace: "nowrap" };
const td: React.CSSProperties = { textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--border-disabled)" };
