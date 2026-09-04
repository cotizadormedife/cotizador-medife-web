"use client";

import { useMemo, useState, useTransition } from "react";
import { runQuoteAction, type RunQuoteState } from "./actions";
import { RANGOS_BY_TIPO, RANGOS_HIJO_INTERIOR } from "@/lib/pricing/memberKey";
import { isAutoPolicy, isPolicyMemberEligible, isPolicyRelevant } from "@/lib/pricing/policyEligibility";
import type { DiscountPolicy, Miembro, TipoMiembro } from "@/lib/pricing/types";
import OptionGroup from "./OptionGroup";
import QuoteResults, { fmtPct } from "./QuoteResults";

type Region = { code: string; nombre: string; sort_order: number };
type Filial = { code: string; region_code: string; nombre: string; sort_order: number };
type PriceListVersion = { id: string; sourceFilename: string; uploadedAt: string; disabled?: boolean };

const MONOTRIBUTO_CATS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];
const TIPOS: TipoMiembro[] = ["Titular", "Esposo/a", "Hijo/a", "Familiar a cargo"];

function getSection(p: DiscountPolicy): "gaf" | "estrategico" | "tactico" {
  if (p.procedenciaGate === "GAF") return "gaf";
  if (p.id.startsWith("opcion-")) return "estrategico";
  if (p.id.startsWith("dto-mes") || p.id.startsWith("dto-indie")) return "tactico";
  return "estrategico";
}

const labelStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600 };

export type QuoteFormInitial = {
  vendedor: string;
  asociado: string;
  region: string;
  categoria: "Vol" | "Obl";
  procedencia: "Otros" | "comprobable";
  filial: string;
  vigencia: "actual" | "siguiente";
  miembros: Miembro[];
  selectedPolicyIds: string[];
  priceListVersionId?: string;
};

export default function QuoteForm({
  regions,
  filiales,
  policies,
  priceListVersions,
  vendedorDefault,
  initial,
}: {
  regions: Region[];
  filiales: Filial[];
  policies: DiscountPolicy[];
  priceListVersions: PriceListVersion[];
  vendedorDefault: string;
  initial?: QuoteFormInitial | null;
}) {
  const [vendedor, setVendedor] = useState(initial?.vendedor ?? vendedorDefault);
  const [asociado, setAsociado] = useState(initial?.asociado ?? "");
  const [region, setRegion] = useState(initial?.region ?? regions[0]?.code ?? "AMBA");
  const [categoria, setCategoria] = useState<"Vol" | "Obl">(initial?.categoria ?? "Vol");
  const [procedencia, setProcedencia] = useState<"Otros" | "comprobable">(initial?.procedencia ?? "Otros");
  const [vigencia, setVigencia] = useState<"actual" | "siguiente">(initial?.vigencia ?? "actual");
  const filialesRegion = useMemo(() => filiales.filter((f) => f.region_code === region), [filiales, region]);
  const [filial, setFilial] = useState(initial?.filial ?? filialesRegion[0]?.code ?? "");
  const [miembros, setMiembros] = useState<Miembro[]>(initial?.miembros ?? [{ tipo: "Titular", rango: "36-40" }]);
  const [selectedPolicyIds, setSelectedPolicyIds] = useState<string[]>(initial?.selectedPolicyIds ?? []);
  const [priceListVersionId, setPriceListVersionId] = useState(
    initial?.priceListVersionId ?? priceListVersions[0]?.id ?? ""
  );
  const [state, setState] = useState<RunQuoteState | null>(null);
  const [pending, startTransition] = useTransition();

  function onRegionChange(newRegion: string) {
    setRegion(newRegion);
    const opts = filiales.filter((f) => f.region_code === newRegion);
    setFilial(opts[0]?.code ?? "");
    const isAmba = newRegion === "AMBA";
    setMiembros((ms) =>
      ms.map((m) => {
        if (m.tipo !== "Hijo/a") return m;
        const ambaRangos = RANGOS_BY_TIPO["Hijo/a"];
        const interiorRangos = RANGOS_HIJO_INTERIOR;
        if (isAmba && interiorRangos.includes(m.rango)) return { ...m, rango: "" };
        if (!isAmba && ambaRangos.includes(m.rango)) return { ...m, rango: "" };
        return m;
      })
    );
  }

  function rangosFor(tipo: TipoMiembro): string[] {
    if (tipo === "Hijo/a") return region === "AMBA" ? RANGOS_BY_TIPO["Hijo/a"] : RANGOS_HIJO_INTERIOR;
    return RANGOS_BY_TIPO[tipo];
  }

  function addMiembro() {
    setMiembros((ms) => [...ms, { tipo: "Hijo/a", rango: rangosFor("Hijo/a")[0] }]);
  }
  function removeMiembro(idx: number) {
    setMiembros((ms) => ms.filter((_, i) => i !== idx));
  }
  function updateMiembro(idx: number, patch: Partial<Miembro>) {
    setMiembros((ms) => ms.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  }
  function onTipoChange(idx: number, tipo: TipoMiembro) {
    updateMiembro(idx, { tipo, rango: rangosFor(tipo)[0] ?? "" });
  }

  const selectable = useMemo(() => {
    const isAMBA = region === "AMBA";
    return policies.filter(
      (p) =>
        !isAutoPolicy(p) &&
        p.tipo !== "recargo" &&
        isPolicyRelevant(p, { region, categoria, procedencia, filial }) &&
        isPolicyMemberEligible(p, miembros, isAMBA)
    );
  }, [policies, region, categoria, procedencia, filial, miembros]);

  const gaf = selectable.filter((p) => getSection(p) === "gaf");
  const estrategico = selectable.filter((p) => getSection(p) === "estrategico");
  const tactico = selectable.filter((p) => getSection(p) === "tactico");

  function togglePolicy(id: string, checked: boolean) {
    setSelectedPolicyIds((prev) => {
      let next = checked ? [...prev, id] : prev.filter((x) => x !== id);
      if (checked && id.startsWith("opcion-4")) next = next.filter((x) => !x.startsWith("opcion-5"));
      if (checked && id.startsWith("opcion-5")) next = next.filter((x) => !x.startsWith("opcion-4"));
      return next;
    });
  }

  function submit() {
    setState(null);
    startTransition(async () => {
      const res = await runQuoteAction({
        vendedor,
        asociado,
        region,
        categoria,
        procedencia,
        filial,
        vigencia,
        miembros,
        selectedPolicyIds,
        priceListVersionId,
      });
      setState(res);
      window.scrollTo(0, 0);
    });
  }

  return (
    <div className="quote-layout">
      <div className="print-hidden">
        <div className="card">
          <h2 style={{ fontSize: 18, margin: "0 0 16px" }}>Configuración</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <label style={labelStyle}>
              Vendedor
              <input value={vendedor} onChange={(e) => setVendedor(e.target.value)} />
            </label>
            <label style={labelStyle}>
              Asociado / Cliente
              <input value={asociado} onChange={(e) => setAsociado(e.target.value)} />
            </label>
            <label style={labelStyle}>
              Región
              <select value={region} onChange={(e) => onRegionChange(e.target.value)}>
                {regions.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label style={labelStyle}>
              Filial / Zona
              <select value={filial} onChange={(e) => setFilial(e.target.value)}>
                {filialesRegion.map((f) => (
                  <option key={f.code} value={f.code}>
                    {f.nombre}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Categoría</div>
              <OptionGroup
                name="categoria"
                value={categoria}
                onChange={setCategoria}
                options={[
                  { value: "Vol", label: "Voluntario" },
                  { value: "Obl", label: "Obligatorio" },
                ]}
              />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Procedencia</div>
              <OptionGroup
                name="procedencia"
                value={procedencia}
                onChange={setProcedencia}
                options={[
                  { value: "Otros", label: "Sin procedencia" },
                  { value: "comprobable", label: "Comprobable" },
                ]}
              />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Vigencia</div>
              <OptionGroup
                name="vigencia"
                value={vigencia}
                onChange={setVigencia}
                options={[
                  { value: "actual", label: "Mes actual" },
                  { value: "siguiente", label: "Mes siguiente" },
                ]}
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ fontSize: 18, margin: 0 }}>Grupo familiar</h2>
            <button type="button" onClick={addMiembro}>
              + Agregar
            </button>
          </div>
          {miembros.map((m, idx) => (
            <div key={idx} style={{ border: "1px solid var(--border-disabled)", borderRadius: 10, padding: 14, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <strong style={{ fontSize: 13 }}>Integrante {idx + 1}</strong>
                {idx > 0 && (
                  <button type="button" onClick={() => removeMiembro(idx)} style={{ padding: "2px 10px", minHeight: 28 }}>
                    ×
                  </button>
                )}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
                <label style={{ ...labelStyle, flex: "1 1 160px" }}>
                  Tipo
                  <select value={m.tipo} onChange={(e) => onTipoChange(idx, e.target.value as TipoMiembro)}>
                    {TIPOS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ ...labelStyle, flex: "1 1 160px" }}>
                  Rango de edad
                  <select value={m.rango} onChange={(e) => updateMiembro(idx, { rango: e.target.value })}>
                    {rangosFor(m.tipo).map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {categoria === "Obl" && (
                <>
                  <label style={{ ...labelStyle, marginTop: 10 }}>
                    Sueldo bruto (para aportes)
                    <input
                      type="number"
                      value={m.sueldo ?? ""}
                      onChange={(e) => updateMiembro(idx, { sueldo: parseFloat(e.target.value) || 0 })}
                    />
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
                    <label style={{ ...labelStyle, flex: "1 1 160px" }}>
                      Origen del aporte
                      <select
                        value={m.obraSocial ?? "Medife"}
                        onChange={(e) => updateMiembro(idx, { obraSocial: e.target.value as Miembro["obraSocial"] })}
                      >
                        <option value="OBRAS SOCIALES">Obra Social</option>
                        <option value="Medife">Medifé</option>
                        <option value="MONOTRIBUTO">Monotributo</option>
                      </select>
                    </label>
                    {m.obraSocial === "MONOTRIBUTO" && (
                      <label style={{ ...labelStyle, flex: "1 1 160px" }}>
                        Categoría
                        <select
                          value={m.monotributoCat ?? "A"}
                          onChange={(e) => updateMiembro(idx, { monotributoCat: e.target.value })}
                        >
                          {MONOTRIBUTO_CATS.map((c) => (
                            <option key={c} value={c}>
                              Monotributo {c}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="card">
          <h2 style={{ fontSize: 18, margin: "0 0 14px" }}>Opciones de descuento</h2>
          <DiscountSection title="GAF" items={gaf} selected={selectedPolicyIds} onToggle={togglePolicy} />
          <DiscountSection
            title="Descuentos estratégicos"
            items={estrategico}
            selected={selectedPolicyIds}
            onToggle={togglePolicy}
          />
          <DiscountSection title="Descuentos tácticos" items={tactico} selected={selectedPolicyIds} onToggle={togglePolicy} />
        </div>

        <div className="card">
          <label style={labelStyle}>
            Lista de precios
            <select value={priceListVersionId} onChange={(e) => setPriceListVersionId(e.target.value)}>
              {priceListVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  {new Date(v.uploadedAt).toLocaleString("es-AR")}
                  {v.disabled ? " (deshabilitada)" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button type="button" className="btn-primary" onClick={submit} disabled={pending} style={{ width: "100%" }}>
          {pending ? "Calculando..." : "Cotizar"}
        </button>
      </div>

      <div>
        {state && !state.ok && (
          <p role="alert" style={{ color: "#c0392b" }}>
            {state.error}
          </p>
        )}
        {state && state.ok && (
          <QuoteResults
            result={state.result}
            meta={{
              numero: state.quoteNumber,
              asociado,
              vendedor,
              fecha: new Date().toLocaleDateString("es-AR"),
              region: regions.find((r) => r.code === region)?.nombre ?? region,
              filial: filialesRegion.find((f) => f.code === filial)?.nombre ?? filial,
              categoria,
              procedencia: procedencia === "comprobable" ? "Comprobable" : "Sin procedencia",
              vigencia: vigencia === "actual" ? "Mes actual" : "Mes siguiente",
            }}
          />
        )}
      </div>
    </div>
  );
}

function DiscountSection({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string;
  items: DiscountPolicy[];
  selected: string[];
  onToggle: (id: string, checked: boolean) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((p) => (
          <label
            key={p.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 14px",
              border: "1px solid var(--border-disabled)",
              borderRadius: 10,
              fontSize: 13,
              minHeight: 44,
            }}
          >
            <input
              type="checkbox"
              checked={selected.includes(p.id)}
              onChange={(e) => onToggle(p.id, e.target.checked)}
              style={{ width: "auto", minHeight: 0, accentColor: "var(--brand-orange)" }}
            />
            <span style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{p.nombre}</div>
              {p.detalle && <div style={{ color: "var(--text-neutral)", fontSize: 12 }}>{p.detalle}</div>}
            </span>
            <span style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{fmtPct(p.valorPct)}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
