"use client";

import { useState, useTransition } from "react";
import {
  approveUserAction,
  deleteUserAction,
  reactivateUserAction,
  promoteToAdminAction,
  promoteToSuperAdminAction,
  demoteFromAdminAction,
  demoteFromSuperAdminAction,
  updateUserEmpresaAction,
  resendInviteAction,
} from "./actions";
import { MEDIFE_EMPRESA_ID, type Empresa } from "@/lib/empresas";

const td: React.CSSProperties = { textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--border-disabled)" };

type UserRowData = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  email: string;
  role: "vendedor" | "admin" | "super_admin";
  status: string;
  disabled_at: string | null;
  empresa_id: string | null;
  empresa_nombre: string | null;
  activoUltimos3Meses: boolean;
  pendingFirstLogin: boolean;
};

export default function UserRow({
  user,
  empresas,
  isSuperAdmin,
}: {
  user: UserRowData;
  empresas: Empresa[];
  isSuperAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [editingEmpresa, setEditingEmpresa] = useState(false);
  const [empresaId, setEmpresaId] = useState(user.empresa_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [newLink, setNewLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function resendInvite() {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const res = await resendInviteAction(user.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNewLink(res.link);
    });
  }

  async function copyLink() {
    if (!newLink) return;
    try {
      await navigator.clipboard.writeText(newLink);
      setCopied(true);
    } catch {
      // el navegador puede bloquear el acceso al portapapeles; no es crítico
    }
  }

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo completar la acción.");
      }
    });
  }

  function saveEmpresa() {
    setError(null);
    startTransition(async () => {
      const res = await updateUserEmpresaAction(user.id, empresaId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEditingEmpresa(false);
    });
  }

  return (
    <tr>
      <td style={td}>
        {user.nombre} {user.apellido}
        <div style={{ fontSize: 11, fontWeight: 700, color: user.activoUltimos3Meses ? "#1a7f37" : "#c0392b" }}>
          {user.activoUltimos3Meses ? "Activo" : "Inactivo hace 3 meses"}
        </div>
      </td>
      <td style={td}>{user.email}</td>
      <td style={td}>
        {isSuperAdmin && editingEmpresa ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} style={{ fontSize: 12 }}>
              {empresas.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.nombre}
                </option>
              ))}
            </select>
            <button type="button" onClick={saveEmpresa} disabled={pending} style={{ padding: "4px 10px", fontSize: 12, minHeight: 0 }}>
              Guardar
            </button>
            <button type="button" onClick={() => setEditingEmpresa(false)} style={{ padding: "4px 10px", fontSize: 12, minHeight: 0 }}>
              Cancelar
            </button>
          </div>
        ) : (
          <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {user.empresa_nombre ?? "—"}
            {isSuperAdmin && (
              <button type="button" onClick={() => setEditingEmpresa(true)} style={{ padding: "2px 8px", fontSize: 11, minHeight: 0 }}>
                Cambiar
              </button>
            )}
          </span>
        )}
      </td>
      <td style={td}>{user.role}</td>
      <td style={td}>
        {user.disabled_at ? "deshabilitado" : user.status}
        {user.pendingFirstLogin && (
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--brand-orange)" }}>Pendiente de primer ingreso</div>
        )}
      </td>
      <td style={td}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {/* RF-98: un usuario "rejected" (rechazado desde "Pendientes de
              aprobación") desaparece de esa lista y antes no tenía forma de
              volver a aprobarse desde "Todos los usuarios" — quedaba
              bloqueado sin acceso a la aplicación de forma permanente. */}
          {!user.disabled_at && user.status === "rejected" && (
            <button type="button" className="btn-primary" onClick={() => run(() => approveUserAction(user.id))} disabled={pending} style={{ padding: "8px 14px", fontSize: 13, minHeight: 0 }}>
              Aprobar
            </button>
          )}
          {!user.disabled_at && user.status === "approved" && (
            <button type="button" onClick={resendInvite} disabled={pending}>
              Generar link de primer ingreso
            </button>
          )}
          {!user.disabled_at ? (
            <button type="button" onClick={() => run(() => deleteUserAction(user.id))} disabled={pending}>
              Eliminar
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={() => run(() => reactivateUserAction(user.id))} disabled={pending} style={{ padding: "8px 14px", fontSize: 13, minHeight: 0 }}>
              Rehabilitar
            </button>
          )}
          {!user.disabled_at && user.status === "approved" && user.role === "vendedor" && (
            <button type="button" onClick={() => run(() => promoteToAdminAction(user.id))} disabled={pending}>
              Ascender a Admin
            </button>
          )}
          {user.role === "admin" && (
            <button type="button" onClick={() => run(() => demoteFromAdminAction(user.id))} disabled={pending}>
              Quitar Admin
            </button>
          )}
          {isSuperAdmin && user.role !== "super_admin" && user.empresa_id === MEDIFE_EMPRESA_ID && (
            <button type="button" onClick={() => run(() => promoteToSuperAdminAction(user.id))} disabled={pending}>
              Hacer Super Admin
            </button>
          )}
          {isSuperAdmin && user.role === "super_admin" && (
            <button type="button" onClick={() => run(() => demoteFromSuperAdminAction(user.id))} disabled={pending}>
              Quitar Super Admin
            </button>
          )}
        </div>
        {error && (
          <p role="alert" style={{ color: "#c0392b", fontSize: 12, margin: "4px 0 0" }}>
            {error}
          </p>
        )}
        {newLink && (
          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            <input readOnly value={newLink} style={{ flex: "1 1 220px", fontSize: 11, padding: "4px 8px", minHeight: 0 }} onFocus={(e) => e.target.select()} />
            <button type="button" onClick={copyLink} style={{ padding: "4px 10px", fontSize: 11, minHeight: 0 }}>
              {copied ? "Copiado ✓" : "Copiar"}
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
