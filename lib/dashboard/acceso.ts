// RF-106: el Dashboard estadístico es para perfiles admin y super_admin. Release
// aprobado por Diego el 14/10/2026 (RF-119): lo ven todos los admin y super_admin.
// Para volver a limitarlo a los usuarios de la lista: DASHBOARD_RELEASE_APROBADO = false.

export const DASHBOARD_RELEASE_APROBADO = true;
const EMAILS_HABILITADOS_HASTA_EL_RELEASE = ["diegoschwartzman@medife.com.ar"];

export function puedeVerDashboard(perfil: { role: string; email: string }): boolean {
  if (perfil.role !== "admin" && perfil.role !== "super_admin") return false;
  if (DASHBOARD_RELEASE_APROBADO) return true;
  return EMAILS_HABILITADOS_HASTA_EL_RELEASE.includes((perfil.email ?? "").trim().toLowerCase());
}
