"use client";

import { useState, useTransition } from "react";
import { inviteUserAction, type InviteUserState } from "./actions";
import type { Empresa } from "@/lib/empresas";

const labelStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600 };

export default function InviteForm({ empresas, lockedEmpresa }: { empresas: Empresa[]; lockedEmpresa?: Empresa }) {
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [celular, setCelular] = useState("");
  const [empresaId, setEmpresaId] = useState(lockedEmpresa?.id ?? empresas[0]?.id ?? "");
  const [result, setResult] = useState<InviteUserState | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    setResult(null);
    setCopied(false);
    startTransition(async () => {
      const res = await inviteUserAction({ email, nombre, apellido, celular, empresa_id: empresaId });
      setResult(res);
      if (res.ok) {
        setEmail("");
        setNombre("");
        setApellido("");
        setCelular("");
      }
    });
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // el navegador puede bloquear el acceso al portapapeles; no es crítico
    }
  }

  return (
    <div className="card">
      <h2 style={{ fontSize: 18, margin: "0 0 6px" }}>Crear usuario</h2>
      <p style={{ fontSize: 13, color: "var(--text-neutral)", margin: "0 0 16px" }}>
        Se crea ya aprobado. Te va a mostrar un link de primer ingreso para que se lo compartas —
        ahí la persona pone su email y elige su propia contraseña.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <label style={{ ...labelStyle, flex: "1 1 220px" }}>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label style={{ ...labelStyle, flex: "1 1 160px" }}>
          Nombre
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label style={{ ...labelStyle, flex: "1 1 160px" }}>
          Apellido
          <input value={apellido} onChange={(e) => setApellido(e.target.value)} />
        </label>
        <label style={{ ...labelStyle, flex: "1 1 160px" }}>
          Celular
          <input value={celular} onChange={(e) => setCelular(e.target.value)} />
        </label>
        <label style={{ ...labelStyle, flex: "1 1 200px" }}>
          Empresa / Equipo de Ventas / Broker
          {lockedEmpresa ? (
            <input value={lockedEmpresa.nombre} disabled />
          ) : (
            <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
              {empresas.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.nombre}
                </option>
              ))}
            </select>
          )}
        </label>
      </div>
      <button type="button" className="btn-primary" onClick={submit} disabled={pending} style={{ marginTop: 16 }}>
        {pending ? "Creando..." : "Crear usuario y generar link"}
      </button>

      {result && !result.ok && (
        <p role="alert" style={{ color: "#c0392b", marginTop: 12 }}>
          {result.error}
        </p>
      )}
      {result && result.ok && (
        <div style={{ marginTop: 16, padding: 14, border: "1px solid var(--border-default)", borderRadius: 10, background: "var(--brand-orange-focus-bg)" }}>
          <div style={{ fontSize: 13, marginBottom: 8 }}>
            Usuario creado para <strong>{result.email}</strong>. Compartile este link (es de un solo uso, no vence):
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input readOnly value={result.link} style={{ flex: "1 1 260px", fontSize: 12 }} onFocus={(e) => e.target.select()} />
            <button type="button" onClick={() => copyLink(result.link)}>
              {copied ? "Copiado ✓" : "Copiar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
