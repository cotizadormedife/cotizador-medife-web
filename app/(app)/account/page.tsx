import { requireApprovedUser } from "@/lib/auth/session";
import ChangePasswordForm from "./ChangePasswordForm";

export default async function AccountPage() {
  const profile = await requireApprovedUser();

  return (
    <div>
      <h1 style={{ fontSize: 22, margin: "0 0 16px" }}>Mi cuenta</h1>
      <div className="card" style={{ maxWidth: 420 }}>
        <p style={{ fontSize: 14, color: "var(--text-neutral)", margin: "0 0 4px" }}>
          {profile.nombre} {profile.apellido}
        </p>
        <p style={{ fontSize: 14, color: "var(--text-neutral)", margin: "0 0 20px" }}>{profile.email}</p>
        <h2 style={{ fontSize: 16, margin: "0 0 14px" }}>Cambiar contraseña</h2>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
