import { createServiceClient } from "@/lib/supabase/service";
import { requireRole } from "@/lib/auth/session";
import { listEmpresas, isMedife } from "@/lib/empresas";
import { approveUserAction, rejectUserAction } from "./actions";
import InviteForm from "./InviteForm";
import UserRow from "./UserRow";

export default async function AdminUsersPage() {
  const actor = await requireRole(["admin", "super_admin"]);
  const scoped = actor.role === "admin" && !isMedife(actor.empresa_id);

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

  let allQuery = supabase
    .from("profiles")
    .select("id, email, nombre, apellido, role, status, disabled_at, empresa_id, empresas(nombre)")
    .order("created_at", { ascending: false });
  if (scoped) allQuery = allQuery.eq("empresa_id", actor.empresa_id);
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
                          <button type="submit">Rechazar</button>
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

const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", borderBottom: "2px solid var(--border-default)", whiteSpace: "nowrap" };
const td: React.CSSProperties = { textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--border-disabled)" };
