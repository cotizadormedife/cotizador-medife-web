"use client";

import { useState } from "react";
import { mesesQueCorresponden } from "@/lib/fechas";

// RF-106: filtros del Dashboard. Los checkboxes "Todas" / "Todo el año" son
// atajos de la pantalla; lo que viaja en la URL es corto (flags en vez de
// cientos de ids) y el servidor lo vuelve a validar contra lo que el usuario
// tiene permitido ver.

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

type Empresa = { id: string; nombre: string };
type Persona = { id: string; nombre: string; empresaId: string | null; deshabilitada: boolean };

export default function DashboardFilters({
  tab,
  esSuper,
  empresas,
  personas,
  hoy,
  anios,
  inicial,
}: {
  tab: "personas" | "empresas";
  esSuper: boolean;
  empresas: Empresa[];
  personas: Persona[];
  hoy: { anio: number; mes: number };
  anios: number[];
  inicial: { anio: number; meses: number[]; empresasSel: string[]; personasSel: string[] };
}) {
  const [anio, setAnio] = useState(inicial.anio);
  const [meses, setMeses] = useState<Set<number>>(new Set(inicial.meses));
  const [empresasSel, setEmpresasSel] = useState<Set<string>>(new Set(inicial.empresasSel));
  const [personasSel, setPersonasSel] = useState<Set<string>>(new Set(inicial.personasSel));
  const [busqueda, setBusqueda] = useState("");

  const disponibles = mesesQueCorresponden(anio, hoy);
  const todoElAnio = disponibles.length > 0 && disponibles.every((m) => meses.has(m));

  const eligeEmpresas = tab === "empresas" || (tab === "personas" && esSuper);
  const todasEmpresas = empresas.length > 0 && empresasSel.size === empresas.length;

  // Personas del/los grupo(s) elegido(s); "Todas" = todas esas.
  const delGrupo = tab === "personas" ? personas.filter((p) => !esSuper || (p.empresaId != null && empresasSel.has(p.empresaId))) : [];
  const q = busqueda.trim().toLowerCase();
  const visibles = q ? delGrupo.filter((p) => p.nombre.toLowerCase().includes(q)) : delGrupo;
  const personasElegidas = delGrupo.filter((p) => personasSel.has(p.id));
  const todasPersonas = delGrupo.length > 0 && personasElegidas.length === delGrupo.length;

  const cambiarAnio = (nuevo: number) => {
    const nuevosDisponibles = mesesQueCorresponden(nuevo, hoy);
    setMeses(todoElAnio ? new Set(nuevosDisponibles) : new Set([...meses].filter((m) => nuevosDisponibles.includes(m))));
    setAnio(nuevo);
  };
  const alternar = <T,>(set: Set<T>, valor: T, marcado: boolean) => {
    const copia = new Set(set);
    if (marcado) copia.add(valor);
    else copia.delete(valor);
    return copia;
  };

  const sinMeses = meses.size === 0;
  const sinEntidades = tab === "empresas" ? empresasSel.size === 0 : personasElegidas.length === 0;

  return (
    <form method="get" action="/admin/dashboard" className="card">
      <input type="hidden" name="tab" value={tab} />
      <input type="hidden" name="f" value="1" />
      <input type="hidden" name="anio" value={anio} />
      {[...meses].sort((a, b) => a - b).map((m) => (
        <input key={m} type="hidden" name="mes" value={m} />
      ))}
      {eligeEmpresas && (todasEmpresas ? <input type="hidden" name="todasEmpresas" value="1" /> : [...empresasSel].map((id) => <input key={id} type="hidden" name="empresa" value={id} />))}
      {tab === "personas" && (todasPersonas ? <input type="hidden" name="todasPersonas" value="1" /> : personasElegidas.map((p) => <input key={p.id} type="hidden" name="persona" value={p.id} />))}

      <div className="dash-filtros-grupo">
        <p className="dash-filtros-titulo">Período (siempre meses completos)</p>
        <div className="dash-chips" style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
            Año
            <select value={anio} onChange={(e) => cambiarAnio(Number(e.target.value))} style={{ width: "auto", minHeight: 36, padding: "6px 10px" }}>
              {anios.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="dash-chip">
            <input
              type="checkbox"
              checked={todoElAnio}
              disabled={disponibles.length === 0}
              onChange={(e) => setMeses(e.target.checked ? new Set(disponibles) : new Set())}
            />
            Todo el año
          </label>
        </div>
        <div className="dash-chips">
          {MESES.map((nombre, i) => {
            const m = i + 1;
            const habilitado = disponibles.includes(m);
            return (
              <label key={m} className="dash-chip">
                <input type="checkbox" checked={meses.has(m)} disabled={!habilitado} onChange={(e) => setMeses(alternar(meses, m, e.target.checked))} />
                {nombre}
              </label>
            );
          })}
        </div>
      </div>

      {eligeEmpresas && (
        <div className="dash-filtros-grupo">
          <p className="dash-filtros-titulo">Empresas / Grupos</p>
          <div className="dash-lista">
            <label className="dash-chip" style={{ fontWeight: 700 }}>
              <input type="checkbox" checked={todasEmpresas} onChange={(e) => setEmpresasSel(e.target.checked ? new Set(empresas.map((x) => x.id)) : new Set())} />
              Todas
            </label>
            {empresas.map((e) => (
              <label key={e.id} className="dash-chip">
                <input type="checkbox" checked={empresasSel.has(e.id)} onChange={(ev) => setEmpresasSel(alternar(empresasSel, e.id, ev.target.checked))} />
                {e.nombre}
              </label>
            ))}
          </div>
        </div>
      )}

      {tab === "personas" && (
        <div className="dash-filtros-grupo">
          <p className="dash-filtros-titulo">{esSuper ? "Personas" : "Personas de tu grupo"}</p>
          <input
            type="search"
            placeholder="Buscar por nombre o email"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ marginBottom: 8, maxWidth: 360 }}
            aria-label="Buscar persona"
          />
          <div className="dash-lista">
            <label className="dash-chip" style={{ fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={todasPersonas}
                onChange={(e) =>
                  setPersonasSel(e.target.checked ? new Set([...personasSel, ...delGrupo.map((p) => p.id)]) : new Set([...personasSel].filter((id) => !delGrupo.some((p) => p.id === id))))
                }
              />
              Todas ({delGrupo.length})
            </label>
            {visibles.map((p) => (
              <label key={p.id} className="dash-chip">
                <input type="checkbox" checked={personasSel.has(p.id)} onChange={(ev) => setPersonasSel(alternar(personasSel, p.id, ev.target.checked))} />
                {p.nombre}
                {p.deshabilitada ? " (deshabilitado)" : ""}
              </label>
            ))}
            {visibles.length === 0 && <span style={{ fontSize: 13, color: "var(--text-neutral)" }}>No hay personas para mostrar.</span>}
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <button type="submit" className="btn-primary" disabled={sinMeses || sinEntidades}>
          Aplicar
        </button>
        {sinMeses && <span style={{ fontSize: 13, color: "#c0392b" }}>Elegí al menos un mes.</span>}
        {!sinMeses && sinEntidades && <span style={{ fontSize: 13, color: "#c0392b" }}>{tab === "empresas" ? "Elegí al menos una empresa." : "Elegí al menos una persona."}</span>}
      </div>
    </form>
  );
}
