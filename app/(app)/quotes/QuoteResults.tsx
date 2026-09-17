"use client";

import { Fragment, useState } from "react";
import type { Miembro, QuoteResult } from "@/lib/pricing/types";
import { PLANES, PLAN_LABELS } from "@/lib/pricing/types";
import { cambioLabel, composicionLabel, condicionLabel, cronogramaLabel, origenLabel } from "./printLabels";

export const fmtMoney = (n: number) =>
  n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
export const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${Math.round(n * 100)}%`;
const fmtUsoInternoPct = (n: number | null) => (n === null ? "–" : `${(n * 100).toFixed(2)}%`);
// RF-50: número de cotización completado con ceros a la izquierda hasta 12 dígitos.
export const fmtQuoteNumber = (n: number) => String(n).padStart(12, "0");

export type QuoteResultsMeta = {
  numero?: number;
  asociado?: string;
  vendedor?: string;
  fecha?: string;
  region?: string;
  filial?: string;
  categoria?: string;
  procedencia?: string;
  vigencia?: string;
  miembros?: Miembro[];
};

export default function QuoteResults({ result, meta }: { result: QuoteResult; meta?: QuoteResultsMeta }) {
  const plataIdx = 4;
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selection, setSelection] = useState<Set<number>>(new Set(result.planes.map((_, i) => i)));
  const [hiddenPlans, setHiddenPlans] = useState<Set<number>>(new Set());

  function toggleSelection(idx: number, checked: boolean) {
    setSelection((prev) => {
      const next = new Set(prev);
      if (checked) next.add(idx);
      else next.delete(idx);
      return next;
    });
  }

  function confirmPrint() {
    if (selection.size === 0) {
      alert("Seleccioná al menos un plan.");
      return;
    }
    setHiddenPlans(new Set(result.planes.map((_, i) => i).filter((i) => !selection.has(i))));
    setSelectorOpen(false);
    setTimeout(() => {
      window.print();
      setHiddenPlans(new Set());
    }, 150);
  }

  const catLabel = meta?.categoria === "Vol" ? "Voluntario" : meta?.categoria === "Obl" ? "Obligatorio" : meta?.categoria;
  const hasAjusteHijos = result.usoInterno.ajusteHijosPct.some((v) => v !== null && v > 0);
  const hasSegmentoJoven = result.usoInterno.segmentoJovenPct.some((v) => v !== null && v > 0);

  const composicion = meta?.miembros ? composicionLabel(meta.miembros) : "Grupo Familiar";
  const noAutoPolicies = result.activePolicies.filter((p) => !p.automatica);

  return (
    <div>
      {meta?.vendedor && <div className="print-only-block" style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>{meta.vendedor}</div>}
      {meta && (
        <div className="rdg-grid">
          {meta.asociado && <RdgItem label="Nombre del asociado" value={meta.asociado} />}
          {meta.fecha && <RdgItem label="Fecha de cotización" value={meta.fecha} />}
          {meta.vigencia && <RdgItem label="Vigencia" value={meta.vigencia} />}
          {meta.region && <RdgItem label="Región" value={meta.region} />}
          {meta.filial && <RdgItem label="Filial / Zona" value={meta.filial} />}
          {catLabel && <RdgItem label="Categoría" value={catLabel} />}
          {meta.procedencia && <RdgItem label="Procedencia" value={meta.procedencia} />}
        </div>
      )}
      {meta?.vigencia && (
        <div
          className="print-only-block"
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--brand-orange)",
            border: "1px solid var(--brand-orange)",
            borderRadius: 999,
            padding: "4px 12px",
            margin: "0 0 16px",
            width: "fit-content",
          }}
        >
          📌 Cotizador {meta.vigencia}
        </div>
      )}

      {meta?.miembros && meta.miembros.length > 0 && (
        <div className="print-only-block" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.3, margin: "0 0 6px" }}>GRUPO FAMILIAR</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ ...td, textAlign: "left", borderBottom: "2px solid var(--border-default)" }}>Tipo</th>
                <th style={{ ...td, textAlign: "left", borderBottom: "2px solid var(--border-default)" }}>Rango de edad</th>
                <th style={{ ...td, textAlign: "left", borderBottom: "2px solid var(--border-default)" }}>Sueldo bruto</th>
                <th style={{ ...td, textAlign: "left", borderBottom: "2px solid var(--border-default)" }}>Origen del aporte</th>
              </tr>
            </thead>
            <tbody>
              {meta.miembros.map((m, i) => (
                <tr key={i}>
                  <td style={{ ...td, textAlign: "left" }}>{m.tipo}</td>
                  <td style={{ ...td, textAlign: "left" }}>{m.rango}</td>
                  <td className="mono" style={{ ...td, textAlign: "left" }}>
                    {meta.categoria === "Obl" && m.sueldo ? fmtMoney(m.sueldo) : "—"}
                  </td>
                  <td style={{ ...td, textAlign: "left" }}>{meta.categoria === "Obl" ? origenLabel(m) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="print-hidden" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button type="button" onClick={() => setSelectorOpen(true)} style={{ padding: "8px 16px", fontSize: 13 }}>
          Imprimir
        </button>
      </div>

      {meta?.numero != null && (
        <div style={{ textAlign: "left", fontSize: 16, fontWeight: 700, margin: "0 0 12px" }}>
          Número de cotización: {fmtQuoteNumber(meta.numero)}
        </div>
      )}

      <div
        className="plan-cards-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {result.planes.map((p, i) => (
          <div
            key={p.planCode}
            className={hiddenPlans.has(i) ? "plan-col-hidden" : undefined}
            style={{
              border: i === plataIdx ? "2px solid var(--brand-orange)" : "1px solid var(--border-default)",
              borderRadius: 12,
              padding: 16,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 12, color: "var(--text-neutral)", fontWeight: 700 }}>{PLAN_LABELS[p.planCode]}</div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 700, margin: "8px 0" }}>{fmtMoney(p.total)}</div>
            <div style={{ fontSize: 11, color: "var(--text-neutral)" }}>1ª cuota</div>
            {p.descuentoComercialPct !== 0 && (
              <div className="mono" style={{ fontSize: 12, color: "var(--brand-orange)", marginTop: 6, fontWeight: 700 }}>
                {fmtPct(p.descuentoComercialPct)}
              </div>
            )}
          </div>
        ))}
      </div>

      {(hasAjusteHijos || hasSegmentoJoven) && (
        <div className="card print-hidden" style={{ background: "var(--brand-orange-focus-bg)", border: "1px solid var(--brand-orange)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--brand-orange)", textTransform: "uppercase", letterSpacing: 0.3 }}>
            ℹ️ Uso interno — Dto. a ingresar en sistema sobre grupo familiar
          </div>
          <div style={{ fontSize: 11, color: "var(--text-neutral)", margin: "2px 0 10px", textTransform: "uppercase" }}>
            % equivalente al ajuste de precios, para aplicar sobre el total del grupo en el sistema
          </div>
          <div className="table-scroll">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={th}>Concepto</th>
                  {result.planes.map((p) => (
                    <th key={p.planCode} style={th}>
                      {PLAN_LABELS[p.planCode]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hasAjusteHijos && (
                  <tr>
                    <td style={{ ...td, textAlign: "left" }}>Dto. Ajuste Hijos</td>
                    {result.usoInterno.ajusteHijosPct.map((v, i) => (
                      <td key={i} style={td}>
                        {fmtUsoInternoPct(v)}
                      </td>
                    ))}
                  </tr>
                )}
                {hasSegmentoJoven && (
                  <tr>
                    <td style={{ ...td, textAlign: "left" }}>Dto. Segmento Joven</td>
                    {result.usoInterno.segmentoJovenPct.map((v, i) => (
                      <td key={i} style={td}>
                        {fmtUsoInternoPct(v)}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result.recargoInfo?.activo && (
        <p className="print-hidden" style={{ fontSize: 13, color: "var(--text-neutral)" }}>
          ℹ️ Recargo geográfico {fmtPct(result.recargoInfo.pct)} — {result.recargoInfo.detalle}
        </p>
      )}

      <div className="table-scroll">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={th}>Concepto</th>
              {result.planes.map((p, i) => (
                <th key={p.planCode} style={th} className={hiddenPlans.has(i) ? "plan-col-hidden" : undefined}>
                  {PLAN_LABELS[p.planCode]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Row label="Precio Plan Lista" values={result.planes.map((p) => p.subtotal)} printHidden hiddenPlans={hiddenPlans} />
            <Row label="Ajuste Lista Hijos" values={result.planes.map((p) => p.ajusteHijos)} printHidden hiddenPlans={hiddenPlans} />
            <Row label="Segmento Joven" values={result.planes.map((p) => p.segmentoJoven)} printHidden hiddenPlans={hiddenPlans} />
            <Row label="Precio Plan (Dto Nom)" values={result.planes.map((p) => p.dtoNom)} bold printHidden hiddenPlans={hiddenPlans} />
            <PrintOnlyRow label={composicion} values={result.planes.map((p) => p.dtoNom)} hiddenPlans={hiddenPlans} />
            <Row label="Descuento Filial" values={result.planes.map((p) => p.descuentoFilial)} printHidden hiddenPlans={hiddenPlans} />
            <PctRow label="Descuentos" values={result.planes.map((p) => p.descuentoComercialPct)} hiddenPlans={hiddenPlans} />
            <Row label="Valor descuento" values={result.planes.map((p) => p.descuentoComercial)} hiddenPlans={hiddenPlans} />
            <Row label="UCC" values={result.planes.map((p) => p.ucc)} printHidden hiddenPlans={hiddenPlans} />
            <Row label="IVA / Aportes" values={result.planes.map((p) => p.iva + p.aportes)} hiddenPlans={hiddenPlans} />
            <Row label="GAF interés general" values={result.planes.map((p) => p.gafInteres)} printHidden hiddenPlans={hiddenPlans} />
            <Row label="Total 1ª cuota" values={result.planes.map((p) => p.total)} bold highlight hiddenPlans={hiddenPlans} />
          </tbody>
        </table>
      </div>

      {result.activePolicies.length > 0 && (
        <div className="card print-hidden">
          <strong>Descuentos activos</strong>
          <ul>
            {result.activePolicies.map((p) => (
              <li key={p.id}>
                {p.nombre} {p.detalle ? `— ${p.detalle}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {noAutoPolicies.length > 0 && (
        <div className="print-only-block" style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.3, margin: "0 0 6px" }}>DESCUENTOS APLICADOS</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ ...td, textAlign: "left", borderBottom: "2px solid var(--border-default)" }}>Descuento</th>
                <th style={{ ...td, textAlign: "left", borderBottom: "2px solid var(--border-default)" }}>Cronograma</th>
                <th style={{ ...td, textAlign: "left", borderBottom: "2px solid var(--border-default)" }}>Condición</th>
              </tr>
            </thead>
            <tbody>
              {noAutoPolicies.map((p) => (
                <tr key={p.id}>
                  <td style={{ ...td, textAlign: "left", fontWeight: 700 }}>{p.nombre}</td>
                  <td className="mono" style={{ ...td, textAlign: "left" }}>
                    {cronogramaLabel(p)}
                  </td>
                  <td style={{ ...td, textAlign: "left" }}>{condicionLabel(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="print-only-block" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.3, margin: "0 0 6px" }}>
        PROYECCIÓN DE CUOTAS — A MEDIDA QUE VENCEN LOS DESCUENTOS TEMPORALES
      </div>
      <div className="table-scroll">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={th}>Cuota</th>
              {PLANES.map((plan, i) => (
                <th key={plan} style={th} className={hiddenPlans.has(i) ? "plan-col-hidden" : undefined}>
                  {PLAN_LABELS[plan]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.proyeccionCuotas.map((c) => (
              <Fragment key={c.month}>
                {c.cambios.map((cambio, ci) => (
                  <tr key={`cambio-${ci}`} className="print-only-row cambio-row">
                    <td colSpan={PLANES.length + 1} style={{ ...td, textAlign: "left" }}>
                      ▶ {cambioLabel(cambio, c.month)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td style={td}>Cuota {c.month}</td>
                  {PLANES.map((plan, i) => (
                    <td key={plan} className={`mono${hiddenPlans.has(i) ? " plan-col-hidden" : ""}`} style={td}>
                      {fmtMoney(c.porPlan[plan])}
                    </td>
                  ))}
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div
        className="print-only-block"
        style={{ border: "1px solid var(--border-default)", borderLeft: "4px solid var(--brand-orange)", borderRadius: 8, padding: "16px 20px", fontSize: 11, lineHeight: 1.5, color: "var(--text-neutral)" }}
      >
        <ul style={{ margin: 0, padding: "0 0 0 16px" }}>
          <li>La presente cotización no contempla casos de alto costo y baja incidencia.</li>
          <li>La validez del presente presupuesto es de 7 días hábiles a partir de su fecha de emisión.</li>
          <li>
            Se informa que los datos personales y la documentación respaldatoria aportada por el solicitante para la
            confección de la presente cotización revisten el carácter de Declaración Jurada. En caso de falseamiento
            y/o omisión en los datos personales y/o en la documentación respaldatoria aportada, la presente
            cotización se considerará inválida.
          </li>
          <li>
            La presente cotización queda expresamente sujeta a variaciones conforme actualizaciones y/o aumentos y/o
            ajustes que pudiera autorizar la Superintendencia de Servicios de Salud, en su carácter de Autoridad de
            Aplicación.
          </li>
          <li>
            La presente cotización se encuentra sujeta a variaciones atento a modificaciones y/o actualizaciones de
            los datos personales aportados por el solicitante, las cuales serán aplicadas al mes que se indique.
          </li>
          <li>
            La presente cotización queda sujeta a la previa evaluación y aprobación por parte de la auditoría médica
            de MEDIFE. A tales efectos, MEDIFE se reserva el derecho de solicitar documentación médica previa
            respaldatoria relativa tanto al solicitante como a su grupo familiar a cargo, en función de la evaluación
            efectuada por parte de su auditoría médica.
          </li>
          <li>
            En los casos de aplicación de descuento por grupo de afinidad, el mismo se encuentra sujeto al
            cumplimiento en tiempo y forma de las condiciones requeridas para su otorgamiento.
          </li>
          <li>
            Los descuentos de Ajuste Lista Hijos y Segmento Joven se aplican únicamente sobre el precio de lista de
            los integrantes que corresponden, no sobre el total del grupo familiar.
          </li>
          <li>La proyección de cuotas contempla el vencimiento de los descuentos temporales según su plazo y esquema escalonado.</li>
          <li>
            El monto del plan informado se encuentra sujeto a incrementos.{" "}
            <strong>Versión: Cotizador {meta?.vigencia}</strong>
          </li>
          <li>Superintendencia de Servicios de Salud — 0800-222-(72583)</li>
        </ul>
      </div>

      {selectorOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectorOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 200,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 14, padding: 24, maxWidth: 480, width: "100%" }}
          >
            <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>¿Qué planes incluir?</h3>
            <p style={{ fontSize: 13, color: "var(--text-neutral)", margin: "0 0 16px" }}>
              Elegí los planes que van a aparecer en la impresión / PDF.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {result.planes.map((p, i) => (
                <label
                  key={p.planCode}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    border: "1px solid var(--border-default)",
                    borderRadius: 10,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selection.has(i)}
                    onChange={(e) => toggleSelection(i, e.target.checked)}
                    style={{ width: "auto", minHeight: 0, accentColor: "var(--brand-orange)" }}
                  />
                  <span style={{ flex: 1 }}>{PLAN_LABELS[p.planCode]}</span>
                  <span style={{ fontWeight: 600 }}>{fmtMoney(p.total)}</span>
                </label>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <button type="button" onClick={() => setSelectorOpen(false)}>
                Cancelar
              </button>
              <button type="button" className="btn-primary" onClick={confirmPrint}>
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "right", padding: "8px 10px", borderBottom: "2px solid var(--border-default)", whiteSpace: "nowrap" };
const td: React.CSSProperties = { textAlign: "right", padding: "8px 10px", borderBottom: "1px solid var(--border-disabled)", whiteSpace: "nowrap" };

function RdgItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rdg-item">
      <span className="rdg-label">{label}</span>
      <span className="rdg-value">{value}</span>
    </div>
  );
}

function Row({
  label,
  values,
  bold,
  highlight,
  printHidden,
  hiddenPlans,
}: {
  label: string;
  values: number[];
  bold?: boolean;
  highlight?: boolean;
  printHidden?: boolean;
  hiddenPlans: Set<number>;
}) {
  if (values.every((v) => v === 0) && !bold) return null;
  return (
    <tr className={printHidden ? "print-hidden" : undefined} style={highlight ? { background: "var(--brand-orange-focus-bg)" } : undefined}>
      <td style={{ ...td, textAlign: "left", fontWeight: bold ? 700 : 400 }}>{label}</td>
      {values.map((v, i) => (
        <td key={i} className={`mono${hiddenPlans.has(i) ? " plan-col-hidden" : ""}`} style={{ ...td, fontWeight: bold ? 700 : 400 }}>
          {fmtMoney(v)}
        </td>
      ))}
    </tr>
  );
}

function PrintOnlyRow({ label, values, hiddenPlans }: { label: string; values: number[]; hiddenPlans: Set<number> }) {
  return (
    <tr className="print-only-row" style={{ background: "var(--brand-orange-focus-bg)" }}>
      <td style={{ ...td, textAlign: "left", fontWeight: 700 }}>{label}</td>
      {values.map((v, i) => (
        <td key={i} className={`mono${hiddenPlans.has(i) ? " plan-col-hidden" : ""}`} style={{ ...td, fontWeight: 700 }}>
          {fmtMoney(v)}
        </td>
      ))}
    </tr>
  );
}

// RF-M11: fila de porcentaje de descuento comercial ("Descuentos" en el PDF
// de cotización), justo arriba de "Valor descuento" ($).
function PctRow({ label, values, hiddenPlans }: { label: string; values: number[]; hiddenPlans: Set<number> }) {
  if (values.every((v) => v === 0)) return null;
  return (
    <tr>
      <td style={{ ...td, textAlign: "left" }}>{label}</td>
      {values.map((v, i) => (
        <td key={i} className={`mono${hiddenPlans.has(i) ? " plan-col-hidden" : ""}`} style={{ ...td, color: v !== 0 ? "var(--brand-orange)" : undefined }}>
          {v === 0 ? "—" : fmtPct(v)}
        </td>
      ))}
    </tr>
  );
}
