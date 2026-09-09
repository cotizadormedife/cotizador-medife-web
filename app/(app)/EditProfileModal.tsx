"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateProfileAction, type UpdateProfileState } from "./account/actions";
import type { Empresa } from "@/lib/empresas";

const initialState: UpdateProfileState = {};
const labelStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600 };

export default function EditProfileModal({
  profile,
  empresas,
}: {
  profile: {
    email: string;
    nombre: string | null;
    apellido: string | null;
    celular: string | null;
    empresa_id: string | null;
    role: "vendedor" | "admin" | "super_admin";
  };
  empresas: Empresa[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateProfileAction, initialState);
  const empresaNombre = empresas.find((e) => e.id === profile.empresa_id)?.nombre ?? "—";
  const router = useRouter();

  function close() {
    setOpen(false);
    if (state.ok) router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <Link href="/account" style={{ fontSize: 13, color: "var(--text-neutral)", textDecoration: "none" }}>
        {profile.nombre} {profile.apellido} · {profile.role}
      </Link>
      <button type="button" onClick={() => setOpen(true)} style={{ padding: "2px 0", fontSize: 12, minHeight: 0, background: "transparent", border: "none", color: "var(--brand-orange)", fontWeight: 600, cursor: "pointer" }}>
        Modificar mis datos personales
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={close}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 16px", zIndex: 100, overflowY: "auto" }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 24, maxWidth: 420, width: "100%", marginBottom: 40 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, margin: 0 }}>Modificar mis datos personales</h2>
              <button type="button" onClick={close} style={{ padding: "6px 12px", minHeight: 0 }}>
                Cerrar
              </button>
            </div>

            {state.ok ? (
              <div>
                <p style={{ color: "#1a7a3c", fontSize: 14, margin: "0 0 12px" }}>Datos actualizados correctamente.</p>
                {state.emailChangePending && (
                  <p style={{ fontSize: 14, color: "var(--text-neutral)", margin: "0 0 12px" }}>
                    Te enviamos un link de confirmación a tu email nuevo. Hasta que lo confirmes, seguís iniciando sesión con el email anterior.
                  </p>
                )}
                <button type="button" className="btn-primary" onClick={close}>
                  Listo
                </button>
              </div>
            ) : (
              <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <label style={labelStyle}>
                  Email
                  <input type="email" name="email" required defaultValue={profile.email} />
                </label>
                <label style={labelStyle}>
                  Nombre
                  <input type="text" name="nombre" required defaultValue={profile.nombre ?? ""} />
                </label>
                <label style={labelStyle}>
                  Apellido
                  <input type="text" name="apellido" required defaultValue={profile.apellido ?? ""} />
                </label>
                <label style={labelStyle}>
                  Celular
                  <input type="text" name="celular" required defaultValue={profile.celular ?? ""} />
                </label>
                <label style={labelStyle}>
                  Empresa / Broker
                  {profile.role === "vendedor" ? (
                    <select name="empresa_id" defaultValue={profile.empresa_id ?? ""}>
                      {empresas.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.nombre}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span style={{ fontWeight: 400, color: "var(--text-neutral)" }}>
                      {empresaNombre} (solo el Super Admin puede cambiarla)
                    </span>
                  )}
                </label>
                {state.error && (
                  <p role="alert" style={{ color: "#c0392b", fontSize: 14, margin: 0 }}>
                    {state.error}
                  </p>
                )}
                <button type="submit" className="btn-primary" disabled={pending}>
                  {pending ? "Guardando..." : "Guardar cambios"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
