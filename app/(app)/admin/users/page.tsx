import { createServiceClient } from "@/lib/supabase/service";
import { requireRole } from "@/lib/auth/session";
import { listEmpresas, isMedife } from "@/lib/empresas";
import { approveUserAction, rejectUserAction } from "./actions";
import InviteForm from "./InviteForm";
import UserRow from "./UserRow";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; empresa?: string }>;
}) {
  const actor = await requireRole(["admin", "super_admin"]);
  const scoped = actor.role === "admin" && !isMedife(actor.empresa_id);

  const { q, empresa } = await searchParams;
  const supabase = createServiceClient();
  const empresas = await listEmpresas();
  const lockedEmpresa = scoped ? empresas.find((e) => e.id === actor.empresa_id) : undefined;

  let pendingQuery = supabase
    .from("profiles")
    .select("id, email, nombre, apellido, celular, empresa_id, empresas(nombre), created_at")
    .eq("status", "pending_approval")
    .order("created_at", { ascending: true });
  if (scoped) pendingQuery = pendingQuery.eq("empresa_id", actor.empresa_id);
  const { data: pending } = await pendingQuery;

  // RF-48: buscador por nombre/apellido/email y, para el Super Admin, combo
  // de empresa; el listado siempre se muestra ordenado alfabéticamente.
  let allQuery = supabase
    .from("profiles")
    .select("id, email, nombre, apellido, role, status, disabled_at, empresa_id, empresas(nombre)")
    .order("nombre", { ascending: true })
    .order("apellido", { ascending: true });
  if (scoped) {
    allQuery = allQuery.eq("empresa_id", actor.empresa_id);
  } else if (empresa) {
    allQuery = allQuery.eq("empresa_id", empresa);
  }
  if (q) {
    const like = `%${q.replace(/[%,()]/g, "")}%`;
    allQuery = allQuery.or(`nombre.ilike.${like},apellido.ilike.${like},email.ilike.${like}`);
  }
  const { data: all } = await allQuery;

  async function approve(formData: FormData) {
    "use server";
    await approveUserAction(String(formData.get("id")));
  }
  async function reject(formData: FormData) {
    "use server";
    await rejectUserAction(String(formData.get("id")));
  }

  return (
    <div>
      <InviteForm empresas={empresas} lockedEmpresa={lockedEmpresa} />

      <div className="card">
        <h2 style={{ fontSize: 18, margin: "0 0 14px" }}>Usuarios pendientes de aprobación</h2>
        {!pending || pending.length === 0 ? (
          <p style={{ color: "var(--text-neutral)", fontSize: 14 }}>No hay solicitudes pendientes.</p>
        ) : (
          <div className="table-scroll">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={th}>Nombre</th>
                  <th style={th}>Email</th>
                  <th style={th}>Celular</th>
                  <th style={th}>Empresa</th>
                  <th style={th}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(pending as any[]).map((u) => (
                  <tr key={u.id}>
                    <td style={td}>{u.nombre} {u.apellido}</td>
                    <td style={td}>{u.email}</td>
                    <td style={td}>{u.celular}</td>
                    <td style={td}>{u.empresas?.nombre ?? "—"}</td>
                    <td style={td}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <form action={approve}>
                          <input type="hidden" name="id" value={u.id} />
                          <button type="submit" className="btn-primary" style={{ padding: "8px 14px", fontSize: 13, minHeight: 0 }}>
                            Aprobar
                          </button>
                        </form>
                        <form action={reject}>
                          <input type="hidden" name="id" value={u.id} />
                          <button type="submit" style={{ padding: "8px 14px", fontSize: 13, minHeight: 0 }}>
                            Rechazar
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: 18, margin: "0 0 14px" }}>Todos los usuarios</h2>
        <form method="get" style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-end", marginBottom: 16 }}>
          <label style={{ ...labelStyle, minWidth: 240 }}>
            Buscar (nombre, apellido o email)
            <input type="text" name="q" defaultValue={q ?? ""} />
          </label>
          {actor.role === "super_admin" && (
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
          <button type="submit" className="btn-primary">
            Filtrar
          </button>
        </form>
        <div className="table-scroll">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={th}>Nombre</th>
                <th style={th}>Email</th>
                <th style={th}>Empresa</th>
                <th style={th}>Rol</th>
                <th style={th}>Estado</th>
                <th style={th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {((all ?? []) as any[]).map((u) => (
                <UserRow
                  key={u.id}
                  user={{
                    id: u.id,
                    nombre: u.nombre,
                    apellido: u.apellido,
                    email: u.email,
                    role: u.role,
                    status: u.status,
                    disabled_at: u.disabled_at,
                    empresa_id: u.empresa_id,
                    empresa_nombre: u.empresas?.nombre ?? null,
                  }}
                  empresas={empresas}
                  isSuperAdmin={actor.role === "super_admin"}
                />
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
