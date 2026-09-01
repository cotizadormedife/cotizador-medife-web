"use client";

import type { QuoteResult } from "@/lib/pricing/types";
import { PLANES, PLAN_LABELS } from "@/lib/pricing/types";

export const fmtMoney = (n: number) =>
  n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
export const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${Math.round(n * 100)}%`;

export default function QuoteResults({ result }: { result: QuoteResult }) {
  const plataIdx = 4;
  return (
    <div>
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
        <div className="card" style={{ background: "var(--brand-orange-focus-bg)" }}>
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
        <p style={{ fontSize: 13, color: "var(--text-neutral)" }}>
          ℹ️ Recargo geográfico {fmtPct(result.recargoInfo.pct)} — {result.recargoInfo.detalle}
        </p>
      )}

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
            <Row label="Precio Plan Lista" values={result.planes.map((p) => p.subtotal)} />
            <Row label="Ajuste Lista Hijos" values={result.planes.map((p) => p.ajusteHijos)} />
            <Row label="Segmento Joven" values={result.planes.map((p) => p.segmentoJoven)} />
            <Row label="Precio Plan (Dto Nom)" values={result.planes.map((p) => p.dtoNom)} bold />
            <Row label="Descuento Filial" values={result.planes.map((p) => p.descuentoFilial)} />
            <Row label="Descuentos comerciales" values={result.planes.map((p) => p.descuentoComercial)} />
            <Row label="UCC" values={result.planes.map((p) => p.ucc)} />
            <Row label="IVA / Aportes" values={result.planes.map((p) => p.iva + p.aportes)} />
            <Row label="GAF interés general" values={result.planes.map((p) => p.gafInteres)} />
            <Row label="Total 1ª cuota" values={result.planes.map((p) => p.total)} bold highlight />
          </tbody>
        </table>
      </div>

      {result.activePolicies.length > 0 && (
        <div className="card">
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
              {PLANES.map((plan) => (
                <th key={plan} style={th}>
                  {PLAN_LABELS[plan]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.proyeccionCuotas.map((c) => (
              <tr key={c.month}>
                <td style={td}>{c.month}</td>
                {PLANES.map((plan) => (
                  <td key={plan} style={td}>
                    {fmtMoney(c.porPlan[plan])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "right", padding: "8px 10px", borderBottom: "2px solid var(--border-default)", whiteSpace: "nowrap" };
const td: React.CSSProperties = { textAlign: "right", padding: "8px 10px", borderBottom: "1px solid var(--border-disabled)", whiteSpace: "nowrap" };

function Row({ label, values, bold, highlight }: { label: string; values: number[]; bold?: boolean; highlight?: boolean }) {
  if (values.every((v) => v === 0) && !bold) return null;
  return (
    <tr style={highlight ? { background: "var(--brand-orange-focus-bg)" } : undefined}>
      <td style={{ ...td, textAlign: "left", fontWeight: bold ? 700 : 400 }}>{label}</td>
      {values.map((v, i) => (
        <td key={i} style={{ ...td, fontWeight: bold ? 700 : 400 }}>
          {fmtMoney(v)}
        </td>
      ))}
    </tr>
  );
}
