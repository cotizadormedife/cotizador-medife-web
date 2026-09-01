"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <div>
      <h2 style={{ fontSize: 26, fontWeight: 600, margin: "0 0 8px" }}>Iniciar sesión</h2>
      <p style={{ color: "var(--text-neutral)", fontSize: 15, margin: "0 0 28px" }}>
        Ingresá tu email y contraseña.
      </p>
      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14, fontWeight: 600 }}>
          Email
          <input type="email" name="email" required autoComplete="email" />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14, fontWeight: 600 }}>
          Contraseña
          <input type="password" name="password" required autoComplete="current-password" />
        </label>
        {state.error && (
          <p role="alert" style={{ color: "#c0392b", fontSize: 14, margin: 0 }}>
            {state.error}
          </p>
        )}
        <button type="submit" disabled={pending} style={{ marginTop: 8 }}>
          {pending ? "Ingresando..." : "Iniciar sesión"}
        </button>
      </form>
      <p style={{ marginTop: 16, fontSize: 14 }}>
        <Link href="/forgot-password">¿Olvidaste tu contraseña?</Link>
      </p>
      <p style={{ marginTop: 8, fontSize: 14, color: "var(--text-neutral)" }}>
        ¿No tenés cuenta? <Link href="/register">Registrate</Link>
      </p>
    </div>
  );
}
