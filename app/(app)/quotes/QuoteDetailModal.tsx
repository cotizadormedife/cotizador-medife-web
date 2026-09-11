"use client";

import { useState } from "react";
import Link from "next/link";
import type { QuoteResult } from "@/lib/pricing/types";
import { summarizeMiembros } from "@/lib/pricing/summary";
import QuoteResults from "./QuoteResults";

export default function QuoteDetailActions({
  quoteId,
  result,
  input,
  meta,
}: {
  quoteId: string;
  result: QuoteResult;
  input: any;
  meta: {
    numero?: number;
    fecha: string;
    vendedor: string;
    asociado: string;
    region: string;
    categoria: string;
    filial: string;
    vigencia?: string;
    listaPreciosFecha?: string;
  };
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => setOpen(true)} style={{ padding: "6px 12px", fontSize: 12, minHeight: 0 }}>
          Ver detalle
        </button>
        <Link href={`/quotes?rehacer=${quoteId}`}>
          <button type="button" style={{ padding: "6px 12px", fontSize: 12, minHeight: 0 }}>
            Re-cotizar
          </button>
        </Link>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "24px 16px",
            zIndex: 100,
            overflowY: "auto",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: 24,
              maxWidth: 960,
              width: "100%",
              marginBottom: 40,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 20, margin: "0 0 4px" }}>
                  {meta.asociado}
                  {meta.numero != null && (
                    <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-neutral)" }}> · N° {meta.numero}</span>
                  )}
                </h2>
                <p style={{ fontSize: 13, color: "var(--text-neutral)", margin: 0 }}>
                  {meta.fecha} · {meta.vendedor} · {meta.region} / {meta.filial} ·{" "}
                  {meta.categoria === "Vol" ? "Voluntario" : "Obligatorio"}
                </p>
                <p style={{ fontSize: 13, color: "var(--text-neutral)", margin: "4px 0 0" }}>
                  Grupo familiar: {summarizeMiembros(input?.miembros ?? [])}
                </p>
                {meta.listaPreciosFecha && (
                  <p style={{ fontSize: 13, color: "var(--text-neutral)", margin: "4px 0 0" }}>
                    Lista de precios: {meta.listaPreciosFecha}
                  </p>
                )}
              </div>
              <button type="button" onClick={() => setOpen(false)} style={{ padding: "6px 12px", minHeight: 0 }}>
                Cerrar
              </button>
            </div>
            <QuoteResults
              result={result}
              meta={{
                numero: meta.numero,
                asociado: meta.asociado,
                vendedor: meta.vendedor,
                fecha: meta.fecha,
                region: meta.region,
                filial: meta.filial,
                categoria: meta.categoria,
                procedencia: input?.procedencia === "comprobable" ? "Comprobable" : "Sin procedencia",
                vigencia: meta.vigencia,
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
