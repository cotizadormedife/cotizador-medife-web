"use client";

import { useActionState } from "react";
import { changePasswordAction, type ChangePasswordState } from "./actions";

const initialState: ChangePasswordState = {};

const labelStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600 };

export default function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialState);

  return (
    <form action={formAction} key={state.ok ? "done" : "form"} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <label style={labelStyle}>
        Contraseña actual
        <input type="password" name="oldPassword" required autoComplete="current-password" />
      </label>
      <label style={labelStyle}>
        Nueva contraseña
        <input type="password" name="newPassword" required minLength={6} autoComplete="new-password" />
      </label>
      <label style={labelStyle}>
        Repetir nueva contraseña
        <input type="password" name="confirmPassword" required minLength={6} autoComplete="new-password" />
      </label>
      {state.error && (
        <p role="alert" style={{ color: "#c0392b", fontSize: 14, margin: 0 }}>
          {state.error}
        </p>
      )}
      {state.ok && (
        <p style={{ color: "#1a7a3c", fontSize: 14, margin: 0 }}>Contraseña actualizada correctamente.</p>
      )}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Guardando..." : "Cambiar contraseña"}
      </button>
    </form>
  );
}
