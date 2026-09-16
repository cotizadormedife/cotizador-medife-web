"use client";

import { useMemo, useState, useTransition } from "react";
import { runQuoteAction, type RunQuoteState } from "./actions";
import { RANGOS_BY_TIPO, RANGOS_HIJO_INTERIOR } from "@/lib/pricing/memberKey";
import {
  dedupeTacticosByPlan,
  isAutoPolicy,
  isCompatible,
  isPolicyMemberEligible,
  isPolicyRelevant,
  isRequisitoCumplido,
} from "@/lib/pricing/policyEligibility";
import type { DiscountPolicy, Miembro, TipoMiembro } from "@/lib/pricing/types";
import OptionGroup from "./OptionGroup";
import QuoteResults, { fmtPct } from "./QuoteResults";

type Region = { code: string; nombre: string; sort_order: number };
type Filial = { code: string; region_code: string; nombre: string; sort_order: number };
type PriceListVersion = { id: string; sourceFilename: string; uploadedAt: string; vigenciaLabel: string; disabled?: boolean };
type VigenciaOption = { id: string; label: string };
type VigenciaSelection = { actual: VigenciaOption | null; actualEsFallback: boolean; siguiente: VigenciaOption | null };
// RF-M9: el set completo (regiones, filiales, descuentos) de una lista de
// precios puntual — precargado por page.tsx para cada lista seleccionable,
// así cambiar "Lista a utilizar" conmuta todo al instante en el cliente.
export type VersionBundle = { regions: Region[]; filiales: Filial[]; policies: DiscountPolicy[] };

const MONOTRIBUTO_CATS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];
const TIPOS: TipoMiembro[] = ["Titular", "Esposo/a", "Hijo/a", "Familiar a cargo"];

function getSection(p: DiscountPolicy): "gaf" | "estrategico" | "tactico" {
  if (p.grupo === "gaf") return "gaf";
  if (p.grupo === "tactico") return "tactico";
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
  vigencia: string;
  miembros: Miembro[];
  selectedPolicyIds: string[];
  priceListVersionId?: string;
};

const EMPTY_BUNDLE: VersionBundle = { regions: [], filiales: [], policies: [] };

export default function QuoteForm({
  bundlesByVersionId,
  priceListVersions,
  vigenciaSelection,
  vendedorDefault,
  initial,
}: {
  bundlesByVersionId: Record<string, VersionBundle>;
  priceListVersions: PriceListVersion[];
  vigenciaSelection: VigenciaSelection;
  vendedorDefault: string;
  initial?: QuoteFormInitial | null;
}) {
  const [vendedor, setVendedor] = useState(initial?.vendedor ?? vendedorDefault);
  const [asociado, setAsociado] = useState(initial?.asociado ?? "");
  const [priceListVersionId, setPriceListVersionId] = useState(
    initial?.priceListVersionId ?? vigenciaSelection.actual?.id ?? priceListVersions[0]?.id ?? ""
  );
  // RF-M9: todo el set (regiones, filiales, descuentos) sale del bundle de
  // la lista elegida — cambiar de lista recalcula esto al instante, sin ida
  // y vuelta al servidor.
  const bundle = bundlesByVersionId[priceListVersionId] ?? EMPTY_BUNDLE;
  const { regions, filiales, policies } = bundle;
  const [region, setRegion] = useState(initial?.region ?? regions[0]?.code ?? "AMBA");
  const [categoria, setCategoria] = useState<"Vol" | "Obl">(initial?.categoria ?? "Vol");
  const [procedencia, setProcedencia] = useState<"Otros" | "comprobable">(initial?.procedencia ?? "Otros");
  const filialesRegion = useMemo(() => filiales.filter((f) => f.region_code === region), [filiales, region]);
  const [filial, setFilial] = useState(initial?.filial ?? filialesRegion[0]?.code ?? "");
  const [miembros, setMiembros] = useState<Miembro[]>(initial?.miembros ?? [{ tipo: "Titular", rango: "36-40" }]);
  const [selectedPolicyIds, setSelectedPolicyIds] = useState<string[]>(initial?.selectedPolicyIds ?? []);
  // RF-65: el label real (Septiembre 2026, etc.) de la lista efectivamente
  // elegida — reemplaza al viejo "Mes actual"/"Mes siguiente" cosmético.
  const vigenciaLabel =
    priceListVersions.find((v) => v.id === priceListVersionId)?.vigenciaLabel ??
    (priceListVersionId === vigenciaSelection.actual?.id ? vigenciaSelection.actual.label : undefined) ??
    (priceListVersionId === vigenciaSelection.siguiente?.id ? vigenciaSelection.siguiente.label : undefined) ??
    initial?.vigencia ??
    "";
  const [state, setState] = useState<RunQuoteState | null>(null);
  const [pending, startTransition] = useTransition();

  // RF-M9: al cambiar de lista, los descuentos tildados no son portables
  // (son ids únicos de la lista anterior) — se limpian. Región/Filial se
  // revalidan contra el nuevo bundle por las dudas, aunque en la práctica
  // el set de regiones/filiales es estable mes a mes.
  function onVigenciaChange(newVersionId: string) {
    setPriceListVersionId(newVersionId);
    setSelectedPolicyIds([]);
    const newBundle = bundlesByVersionId[newVersionId] ?? EMPTY_BUNDLE;
    const regionOk = newBundle.regions.some((r) => r.code === region);
    const nextRegion = regionOk ? region : newBundle.regions[0]?.code ?? "AMBA";
    if (!regionOk) setRegion(nextRegion);
    const filialOk = newBundle.filiales.some((f) => f.code === filial && f.region_code === nextRegion);
    if (!filialOk) {
      setFilial(newBundle.filiales.find((f) => f.region_code === nextRegion)?.code ?? "");
    }
  }

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

  // RF-63: el Integrante 1 es siempre el único Titular — "Titular" se saca
  // del combo de los demás integrantes. Tampoco puede haber más de un
  // Esposo/a a la vez — se saca esa opción del combo de los demás mientras
  // ya haya uno cargado.
  function tiposFor(idx: number): TipoMiembro[] {
    let opts = TIPOS;
    if (idx !== 0) opts = opts.filter((t) => t !== "Titular");
    const hayOtroEsposo = miembros.some((mm, i) => i !== idx && mm.tipo === "Esposo/a");
    if (hayOtroEsposo) opts = opts.filter((t) => t !== "Esposo/a");
    return opts;
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
    const selectedSlugs = policies.filter((p) => selectedPolicyIds.includes(p.id)).map((p) => p.slug);
    // RF-M8: acá solo se oculta lo que tiene un requisito sin cumplir (ej.
    // Opción 6 exige Opción 4) — igual que antes. Las exclusiones mutuas
    // (excluyeOtros/excluyeGrupo, ej. Opción 7) NO ocultan el checkbox: el
    // operador puede verlas y elegirlas siempre, el motor de cálculo es
    // quien decide qué combinación queda aplicada al cotizar.
    return policies.filter(
      (p) =>
        !isAutoPolicy(p) &&
        p.tipo !== "recargo" &&
        isPolicyRelevant(p, { region, categoria, procedencia, filial }) &&
        isPolicyMemberEligible(p, miembros, isAMBA) &&
        isRequisitoCumplido(p, selectedSlugs)
    );
  }, [policies, region, categoria, procedencia, filial, miembros, selectedPolicyIds]);

  const gaf = selectable.filter((p) => getSection(p) === "gaf");
  const estrategico = selectable.filter((p) => getSection(p) === "estrategico");
  // RF-M10: dos descuentos tácticos no pueden convivir para el mismo plan —
  // solo se muestra/deja elegir el de mayor descuento en ese solapamiento.
  const tactico = dedupeTacticosByPlan(selectable.filter((p) => getSection(p) === "tactico"));

  // RF-M9 (fix): esto comparaba id.startsWith("opcion-N"), pero desde M8 el
  // id es un uuid opaco — esas exclusiones de UI quedaron muertas. Se
  // reescribe usando el slug de cada política (estable dentro de la misma
  // lista) en vez del id.
  function togglePolicy(id: string, checked: boolean) {
    const policyOf = (x: string) => policies.find((p) => p.id === x);
    const slugOf = (x: string) => policyOf(x)?.slug ?? "";
    setSelectedPolicyIds((prev) => {
      let next = checked ? [...prev, id] : prev.filter((x) => x !== id);
      const slug = slugOf(id);
      if (checked && slug.startsWith("opcion-4")) next = next.filter((x) => !slugOf(x).startsWith("opcion-5"));
      if (checked && slug.startsWith("opcion-5")) next = next.filter((x) => !slugOf(x).startsWith("opcion-4"));
      // RF-60: Opción 1, 2 y 3 son mutuamente excluyentes entre sí.
      const isUno23 = (x: string) => {
        const s = slugOf(x);
        return s.startsWith("opcion-1") || s.startsWith("opcion-2") || s.startsWith("opcion-3");
      };
      if (checked && isUno23(id)) next = next.filter((x) => x === id || !isUno23(x));
      // RF-61: sin Opción 4 seleccionada, Opción 6 no es válida — se destilda sola.
      if (!next.some((x) => slugOf(x).startsWith("opcion-4"))) next = next.filter((x) => !slugOf(x).startsWith("opcion-6"));
      // RF-M10: reglas de "no acumulable" leídas del Excel (excluyeOtros/
      // excluyeGrupo) — al tildar una, se destilda en el momento cualquier
      // otra ya elegida que sea incompatible con ella, en cualquiera de los
      // dos sentidos (la nueva excluye a la vieja, o la vieja excluía a la
      // nueva).
      if (checked) {
        const thisPolicy = policyOf(id);
        if (thisPolicy) {
          next = next.filter((x) => {
            const other = policyOf(x);
            return !other || isCompatible(thisPolicy, other);
          });
        }
      }
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
        vigencia: vigenciaLabel,
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
          <h2 style={{ fontSize: 18, margin: "0 0 16px" }}>DATOS DE COTIZACIÓN</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Lista a utilizar</div>
              {(vigenciaSelection.actual || vigenciaSelection.siguiente) && (
                <OptionGroup
                  name="vigencia"
                  value={priceListVersionId}
                  onChange={onVigenciaChange}
                  options={[
                    ...(vigenciaSelection.actual ? [{ value: vigenciaSelection.actual.id, label: vigenciaSelection.actual.label }] : []),
                    ...(vigenciaSelection.siguiente
                      ? [{ value: vigenciaSelection.siguiente.id, label: vigenciaSelection.siguiente.label }]
                      : []),
                  ]}
                />
              )}
              {vigenciaSelection.actualEsFallback && (
                <p style={{ fontSize: 12, color: "#c0392b", margin: "6px 0 0" }}>No hay lista actual.</p>
              )}
            </div>
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
                  <select
                    value={m.tipo}
                    disabled={idx === 0}
                    onChange={(e) => onTipoChange(idx, e.target.value as TipoMiembro)}
                  >
                    {tiposFor(idx).map((t) => (
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
              procedencia: procedencia === "comprobable" ? "Con procedencia comprobable" : "Sin procedencia comprobable",
              vigencia: vigenciaLabel,
              miembros,
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
              {p.fuenteComentario && (
                <div style={{ color: "var(--text-neutral)", fontSize: 12, fontStyle: "italic" }}>{p.fuenteComentario}</div>
              )}
            </span>
            <span style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{fmtPct(p.valorPct)}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
