import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { signOutAction } from "@/lib/auth/actions";

export default async function PendingPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.status === "approved" && !profile.disabled_at) redirect("/quotes");

  return (
    <div>
      {profile.disabled_at ? (
        <>
          <h2 style={{ fontSize: 26, fontWeight: 600, margin: "0 0 8px" }}>Tu cuenta fue deshabilitada</h2>
          <p style={{ color: "var(--text-neutral)", fontSize: 15 }}>
            Un administrador deshabilitó tu acceso al cotizador.
          </p>
        </>
      ) : profile.status === "rejected" ? (
        <>
          <h2 style={{ fontSize: 26, fontWeight: 600, margin: "0 0 8px" }}>Tu registro fue rechazado</h2>
          <p style={{ color: "var(--text-neutral)", fontSize: 15 }}>
            Un administrador rechazó tu solicitud de acceso al cotizador. Si creés
            que es un error, contactá a tu administrador.
          </p>
        </>
      ) : (
        <>
          <h2 style={{ fontSize: 26, fontWeight: 600, margin: "0 0 8px" }}>Cuenta pendiente de aprobación</h2>
          <p style={{ color: "var(--text-neutral)", fontSize: 15 }}>
            Tu cuenta ({profile.email}) todavía no fue aprobada por un
            administrador. Vas a poder usar el cotizador apenas se apruebe.
          </p>
        </>
      )}
      <form action={signOutAction} style={{ marginTop: 16 }}>
        <button type="submit">Cerrar sesión</button>
      </form>
    </div>
  );
}
