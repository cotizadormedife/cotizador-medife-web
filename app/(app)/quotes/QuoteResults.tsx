"use client";

import { useState } from "react";
import type { QuoteResult } from "@/lib/pricing/types";
import { PLANES, PLAN_LABELS } from "@/lib/pricing/types";

export const fmtMoney = (n: number) =>
  n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
export const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${Math.round(n * 100)}%`;

export type QuoteResultsMeta = {
  asociado?: string;
  vendedor?: string;
  fecha?: string;
  region?: string;
  filial?: string;
  categoria?: string;
  procedencia?: string;
  vigencia?: string;
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

  return (
    <div>
      {meta && (
        <div className="rdg-grid">
          {meta.asociado && <RdgItem label="Nombre del asociado" value={meta.asociado} />}
          {meta.fecha && <RdgItem label="Fecha de cotización" value={meta.fecha} />}
          {meta.vigencia && <RdgItem label="Vigencia" value={meta.vigencia} />}
          {meta.region && <RdgItem label="Región" value={meta.region} />}
          {meta.filial && <RdgItem label="Filial / Zona" value={meta.filial} />}
          {catLabel && <RdgItem label="Categoría" value={catLabel} />}
          {meta.procedencia && <RdgItem label="Procedencia" value={meta.procedencia} />}
          {meta.vendedor && <RdgItem label="Vendedor" value={meta.vendedor} />}
        </div>
      )}

      <div className="print-hidden" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button type="button" onClick={() => setSelectorOpen(true)} style={{ padding: "8px 16px", fontSize: 13 }}>
          Imprimir
        </button>
      </div>

      <div
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
            <div style={{ fontSize: 20, fontWeight: 700, margin: "8px 0" }}>{fmtMoney(p.total)}</div>
            <div style={{ fontSize: 11, color: "var(--text-neutral)" }}>1ª cuota</div>
            {p.descuentoComercialPct !== 0 && (
              <div style={{ fontSize: 12, color: "var(--brand-orange)", marginTop: 6 }}>
                {fmtPct(p.descuentoComercialPct)}
              </div>
            )}
          </div>
        ))}
      </div>

      {(result.usoInterno.ajusteHijosPct > 0 || result.usoInterno.segmentoJovenPct > 0) && (
        <div className="card print-hidden" style={{ background: "var(--brand-orange-focus-bg)" }}>
          <strong>Uso interno</strong> — porcentajes a cargar en el sistema de Medife:
          <ul>
            {result.usoInterno.ajusteHijosPct > 0 && <li>Ajuste Lista Hijos: {fmtPct(-result.usoInterno.ajusteHijosPct)}</li>}
            {result.usoInterno.segmentoJovenPct > 0 && (
              <li>Segmento Joven: {fmtPct(-result.usoInterno.segmentoJovenPct)}</li>
            )}
          </ul>
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
            <PrintOnlyRow label="Grupo Familiar" values={result.planes.map((p) => p.dtoNom)} hiddenPlans={hiddenPlans} />
            <Row label="Descuento Filial" values={result.planes.map((p) => p.descuentoFilial)} printHidden hiddenPlans={hiddenPlans} />
            <Row label="Descuentos comerciales" values={result.planes.map((p) => p.descuentoComercial)} hiddenPlans={hiddenPlans} />
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
              <tr key={c.month}>
                <td style={td}>{c.month}</td>
                {PLANES.map((plan, i) => (
                  <td key={plan} style={td} className={hiddenPlans.has(i) ? "plan-col-hidden" : undefined}>
                    {fmtMoney(c.porPlan[plan])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
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
        <td key={i} className={hiddenPlans.has(i) ? "plan-col-hidden" : undefined} style={{ ...td, fontWeight: bold ? 700 : 400 }}>
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
        <td key={i} className={hiddenPlans.has(i) ? "plan-col-hidden" : undefined} style={{ ...td, fontWeight: 700 }}>
          {fmtMoney(v)}
        </td>
      ))}
    </tr>
  );
}
