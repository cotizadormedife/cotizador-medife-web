import { createServiceClient } from "@/lib/supabase/service";
import { promoteToAdminAction } from "./actions";

export default async function RolesPage() {
  const supabase = createServiceClient();
  const { data: vendedores } = await supabase
    .from("profiles")
    .select("id, nombre, apellido, email, role")
    .eq("status", "approved")
    .neq("role", "super_admin")
    .order("nombre");

  async function promote(formData: FormData) {
    "use server";
    await promoteToAdminAction(String(formData.get("id")));
  }

  return (
    <div>
      <h1>Ascender usuario a Admin</h1>
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Email</th>
            <th>Rol actual</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {(vendedores ?? []).map((u) => (
            <tr key={u.id}>
              <td>{u.nombre} {u.apellido}</td>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td>
                {u.role !== "admin" && (
                  <form action={promote}>
                    <input type="hidden" name="id" value={u.id} />
                    <button type="submit">Ascender a Admin</button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
