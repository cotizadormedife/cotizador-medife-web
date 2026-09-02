import { createServiceClient } from "@/lib/supabase/service";
import { requireRole } from "@/lib/auth/session";
import { isMedife } from "@/lib/empresas";
import { promoteToAdminAction } from "./actions";

export default async function RolesPage() {
  const actor = await requireRole(["admin", "super_admin"]);
  const scoped = actor.role === "admin" && !isMedife(actor.empresa_id);

  const supabase = createServiceClient();
  let query = supabase
    .from("profiles")
    .select("id, nombre, apellido, email, role, empresas(nombre)")
    .eq("status", "approved")
    .neq("role", "super_admin")
    .order("nombre");
  if (scoped) query = query.eq("empresa_id", actor.empresa_id);
  const { data: usuarios } = await query;

  async function promote(formData: FormData) {
    "use server";
    await promoteToAdminAction(String(formData.get("id")));
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, margin: "0 0 16px" }}>Ascender usuario a Admin</h1>
      <div className="card">
        <div className="table-scroll">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={th}>Nombre</th>
                <th style={th}>Email</th>
                <th style={th}>Empresa</th>
                <th style={th}>Rol actual</th>
                <th style={th}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {((usuarios ?? []) as any[]).map((u) => (
                <tr key={u.id}>
                  <td style={td}>{u.nombre} {u.apellido}</td>
                  <td style={td}>{u.email}</td>
                  <td style={td}>{u.empresas?.nombre ?? "—"}</td>
                  <td style={td}>{u.role}</td>
                  <td style={td}>
                    {u.role !== "admin" && (
                      <form action={promote}>
                        <input type="hidden" name="id" value={u.id} />
                        <button type="submit" className="btn-primary" style={{ padding: "8px 14px", fontSize: 13, minHeight: 0 }}>
                          Ascender a Admin
                        </button>
                      </form>
                    )}
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
