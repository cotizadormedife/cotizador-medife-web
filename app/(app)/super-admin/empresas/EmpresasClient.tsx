"use client";

import { useState, useTransition } from "react";
import { createEmpresaAction, updateEmpresaAction, type EmpresaFormState } from "./actions";
import type { Empresa } from "@/lib/empresas";
import { MEDIFE_EMPRESA_ID } from "@/lib/empresas";

const labelStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600 };
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", borderBottom: "2px solid var(--border-default)", whiteSpace: "nowrap" };
const td: React.CSSProperties = { textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--border-disabled)" };

export default function EmpresasClient({ empresas }: { empresas: Empresa[] }) {
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [createState, setCreateState] = useState<EmpresaFormState | null>(null);
  const [pending, startTransition] = useTransition();

  function submitCreate() {
    setCreateState(null);
    startTransition(async () => {
      const res = await createEmpresaAction({ nombre, direccion });
      setCreateState(res);
      if (res.ok) {
        setNombre("");
        setDireccion("");
      }
    });
  }

  return (
    <div>
      <div className="card">
        <h2 style={{ fontSize: 18, margin: "0 0 6px" }}>Nueva Empresa / Equipo de Ventas / Broker</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <label style={{ ...labelStyle, flex: "1 1 220px" }}>
            Nombre
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={200} />
          </label>
          <label style={{ ...labelStyle, flex: "2 1 320px" }}>
            Dirección completa
            <input value={direccion} onChange={(e) => setDireccion(e.target.value)} maxLength={200} />
          </label>
        </div>
        <button type="button" className="btn-primary" onClick={submitCreate} disabled={pending} style={{ marginTop: 16 }}>
          {pending ? "Creando..." : "Crear empresa"}
        </button>
        {createState && !createState.ok && (
          <p role="alert" style={{ color: "#c0392b", marginTop: 12 }}>
            {createState.error}
          </p>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: 18, margin: "0 0 14px" }}>Empresas / Equipos de Ventas / Brokers</h2>
        <div className="table-scroll">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={th}>Nombre</th>
                <th style={th}>Dirección</th>
                <th style={th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((e) => (
                <EmpresaRow key={e.id} empresa={e} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EmpresaRow({ empresa }: { empresa: Empresa }) {
  const [editing, setEditing] = useState(false);
  const [nombre, setNombre] = useState(empresa.nombre);
  const [direccion, setDireccion] = useState(empresa.direccion);
  const [state, setState] = useState<EmpresaFormState | null>(null);
  const [pending, startTransition] = useTransition();
  const isMedife = empresa.id === MEDIFE_EMPRESA_ID;

  function save() {
    setState(null);
    startTransition(async () => {
      const res = await updateEmpresaAction(empresa.id, { nombre, direccion });
      setState(res);
      if (res.ok) setEditing(false);
    });
  }

  if (!editing) {
    return (
      <tr>
        <td style={td}>
          {empresa.nombre}
          {isMedife && <span style={{ color: "var(--text-neutral)", fontSize: 12 }}> (empresa propia)</span>}
        </td>
        <td style={td}>{empresa.direccion}</td>
        <td style={td}>
          <button type="button" onClick={() => setEditing(true)} style={{ padding: "6px 12px", fontSize: 12, minHeight: 0 }}>
            Editar
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td style={td}>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={200} style={{ fontSize: 13 }} />
      </td>
      <td style={td}>
        <input value={direccion} onChange={(e) => setDireccion(e.target.value)} maxLength={200} style={{ fontSize: 13 }} />
        {state && !state.ok && (
          <p role="alert" style={{ color: "#c0392b", fontSize: 12, margin: "4px 0 0" }}>
            {state.error}
          </p>
        )}
      </td>
      <td style={td}>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn-primary" onClick={save} disabled={pending} style={{ padding: "6px 12px", fontSize: 12, minHeight: 0 }}>
            {pending ? "Guardando..." : "Guardar"}
          </button>
          <button type="button" onClick={() => setEditing(false)} style={{ padding: "6px 12px", fontSize: 12, minHeight: 0 }}>
            Cancelar
          </button>
        </div>
      </td>
    </tr>
  );
}
