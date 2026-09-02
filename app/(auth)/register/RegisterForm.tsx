"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction, type RegisterState } from "./actions";
import type { Empresa } from "@/lib/empresas";

const initialState: RegisterState = {};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 14,
  fontWeight: 600,
};

export default function RegisterForm({ empresas }: { empresas: Empresa[] }) {
  const [state, formAction, pending] = useActionState(registerAction, initialState);

  if (state.needsEmailConfirmation) {
    return (
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 600, margin: "0 0 8px" }}>Confirmá tu email</h2>
        <p style={{ color: "var(--text-neutral)", fontSize: 15 }}>
          Te enviamos un correo para confirmar tu cuenta. Una vez confirmada, vas a
          quedar pendiente de aprobación por un administrador.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 26, fontWeight: 600, margin: "0 0 8px" }}>Crear cuenta</h2>
      <p style={{ color: "var(--text-neutral)", fontSize: 15, margin: "0 0 28px" }}>
        Completá tus datos para pedir acceso al cotizador.
      </p>
      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <label style={labelStyle}>
          Email
          <input type="email" name="email" required autoComplete="email" />
        </label>
        <label style={labelStyle}>
          Contraseña
          <input type="password" name="password" required minLength={6} autoComplete="new-password" />
        </label>
        <div style={{ display: "flex", gap: 12 }}>
          <label style={{ ...labelStyle, flex: 1 }}>
            Nombre
            <input type="text" name="nombre" required />
          </label>
          <label style={{ ...labelStyle, flex: 1 }}>
            Apellido
            <input type="text" name="apellido" required />
          </label>
        </div>
        <label style={labelStyle}>
          Celular
          <input type="tel" name="celular" required />
        </label>
        <label style={labelStyle}>
          Empresa / Broker
          <select name="empresa_id" required defaultValue={empresas[0]?.id ?? ""}>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </label>
        {state.error && (
          <p role="alert" style={{ color: "#c0392b", fontSize: 14, margin: 0 }}>
            {state.error}
          </p>
        )}
        <button type="submit" disabled={pending} style={{ marginTop: 8 }}>
          {pending ? "Creando cuenta..." : "Registrarme"}
        </button>
      </form>
      <p style={{ marginTop: 24, fontSize: 14, color: "var(--text-neutral)" }}>
        ¿Ya tenés cuenta? <Link href="/login">Iniciá sesión</Link>
      </p>
    </div>
  );
}
