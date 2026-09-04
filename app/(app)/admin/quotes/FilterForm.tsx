"use client";

import { useState } from "react";

type Usuario = { id: string; nombre: string; apellido: string; email: string; empresa_id: string | null };
type Empresa = { id: string; nombre: string };

const labelStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600 };

// RF-53: los combos de Usuario y Empresa quedan cruzados — elegir una
// empresa limita el combo de Usuario a sus vendedores, y elegir un usuario
// reposiciona el combo de Empresa en la suya.
export default function FilterForm({
  desde,
  hasta,
  numero,
  orden,
  usuario,
  empresa,
  usuarios,
  empresas,
  scoped,
}: {
  desde?: string;
  hasta?: string;
  numero?: string;
  orden?: string;
  usuario?: string;
  empresa?: string;
  usuarios: Usuario[];
  empresas: Empresa[];
  scoped: boolean;
}) {
  const [usuarioSel, setUsuarioSel] = useState(usuario ?? "");
  const [empresaSel, setEmpresaSel] = useState(empresa ?? "");

  function onEmpresaChange(nuevaEmpresa: string) {
    setEmpresaSel(nuevaEmpresa);
    const actual = usuarios.find((u) => u.id === usuarioSel);
    if (nuevaEmpresa && actual && actual.empresa_id !== nuevaEmpresa) {
      setUsuarioSel("");
    }
  }

  function onUsuarioChange(nuevoUsuario: string) {
    setUsuarioSel(nuevoUsuario);
    const u = usuarios.find((x) => x.id === nuevoUsuario);
    if (u?.empresa_id) setEmpresaSel(u.empresa_id);
  }

  const usuariosVisibles = empresaSel ? usuarios.filter((u) => u.empresa_id === empresaSel) : usuarios;

  return (
    <form method="get" style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-end" }}>
      <label style={labelStyle}>
        Desde
        <input type="date" name="desde" defaultValue={desde} />
      </label>
      <label style={labelStyle}>
        Hasta
        <input type="date" name="hasta" defaultValue={hasta} />
      </label>
      <label style={labelStyle}>
        N° de cotización
        <input type="number" inputMode="numeric" min={1} step={1} name="numero" defaultValue={numero ?? ""} />
      </label>
      <label style={{ ...labelStyle, minWidth: 220 }}>
        Usuario
        <select name="usuario" value={usuarioSel} onChange={(e) => onUsuarioChange(e.target.value)}>
          <option value="">Todos</option>
          {usuariosVisibles.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre} {u.apellido} ({u.email})
            </option>
          ))}
        </select>
      </label>
      {!scoped && (
        <label style={{ ...labelStyle, minWidth: 200 }}>
          Empresa
          <select name="empresa" value={empresaSel} onChange={(e) => onEmpresaChange(e.target.value)}>
            <option value="">Todas</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </label>
      )}
      <label style={labelStyle}>
        Ordenar por
        <select name="orden" defaultValue={orden ?? "fecha"}>
          <option value="fecha">Fecha</option>
          <option value="usuario">Usuario</option>
        </select>
      </label>
      <button type="submit" className="btn-primary">
        Filtrar
      </button>
    </form>
  );
}
