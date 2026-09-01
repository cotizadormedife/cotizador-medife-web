"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotPasswordAction, type ForgotPasswordState } from "./actions";

const initialState: ForgotPasswordState = {};

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, initialState);

  if (state.sent) {
    return (
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 600, margin: "0 0 8px" }}>Revisá tu email</h2>
        <p style={{ color: "var(--text-neutral)", fontSize: 15 }}>
          Si existe una cuenta con ese email, te enviamos un link para elegir una contraseña
          nueva.
        </p>
        <p style={{ marginTop: 24, fontSize: 14 }}>
          <Link href="/login">Volver a iniciar sesión</Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 26, fontWeight: 600, margin: "0 0 8px" }}>Recuperar contraseña</h2>
      <p style={{ color: "var(--text-neutral)", fontSize: 15, margin: "0 0 28px" }}>
        Ingresá tu email y te mandamos un link para elegir una contraseña nueva.
      </p>
      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14, fontWeight: 600 }}>
          Email
          <input type="email" name="email" required autoComplete="email" />
        </label>
        {state.error && (
          <p role="alert" style={{ color: "#c0392b", fontSize: 14, margin: 0 }}>
            {state.error}
          </p>
        )}
        <button type="submit" disabled={pending} style={{ marginTop: 8 }}>
          {pending ? "Enviando..." : "Enviar link"}
        </button>
      </form>
      <p style={{ marginTop: 24, fontSize: 14, color: "var(--text-neutral)" }}>
        <Link href="/login">Volver a iniciar sesión</Link>
      </p>
    </div>
  );
}
