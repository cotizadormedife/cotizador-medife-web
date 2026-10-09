// RF-106: el Dashboard estadístico es para perfiles admin y super_admin, pero
// hasta que Diego apruebe el release está habilitado SOLO para su usuario.
// Para liberarlo a todos los admin/super_admin: DASHBOARD_RELEASE_APROBADO = true.

export const DASHBOARD_RELEASE_APROBADO = false;
const EMAILS_HABILITADOS_HASTA_EL_RELEASE = ["diegoschwartzman@medife.com.ar"];

export function puedeVerDashboard(perfil: { role: string; email: string }): boolean {
  if (perfil.role !== "admin" && perfil.role !== "super_admin") return false;
  if (DASHBOARD_RELEASE_APROBADO) return true;
  return EMAILS_HABILITADOS_HASTA_EL_RELEASE.includes((perfil.email ?? "").trim().toLowerCase());
}
