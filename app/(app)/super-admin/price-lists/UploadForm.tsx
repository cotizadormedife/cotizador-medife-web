"use client";

import { useRef, useState, useTransition } from "react";
import { uploadPriceListAction, type UploadState } from "./actions";

type Modo = "pisar" | "proximo";

// RF-66: texto que sigue a "...como lista de precios " en el popup de
// reconfirmación, ya con la preposición correcta para cada modo.
const CONFIRM_DESCRIPCION: Record<Modo, string> = {
  pisar: "de este mes, pisando la actual",
  proximo: "del próximo mes",
};

export default function UploadForm() {
  const [state, setState] = useState<UploadState | null>(null);
  const [pending, startTransition] = useTransition();
  const [fileSelected, setFileSelected] = useState(false);
  const [modo, setModo] = useState<Modo>("proximo");
  const fileRef = useRef<HTMLInputElement>(null);

  function submit(formData: FormData) {
    const ok = confirm(`¿Confirmás que querés subir este archivo como lista de precios ${CONFIRM_DESCRIPCION[modo]}?`);
    if (!ok) return;

    setState(null);
    startTransition(async () => {
      const res = await uploadPriceListAction(formData);
      setState(res);
      if (res.ok) {
        if (fileRef.current) fileRef.current.value = "";
        setFileSelected(false);
        setModo("proximo");
      }
    });
  }

  return (
    <div>
      <form action={submit} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input
          ref={fileRef}
          type="file"
          name="file"
          accept=".xlsx"
          required
          onChange={(e) => setFileSelected(e.target.files != null && e.target.files.length > 0)}
          style={{ flex: fileSelected ? "0 1 146px" : "1 1 260px" }}
        />
        {fileSelected && (
          <div style={{ display: "flex", flexDirection: "column", gap: 1, fontSize: 10, lineHeight: 1.2, whiteSpace: "nowrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <input
                type="radio"
                name="modo"
                value="pisar"
                checked={modo === "pisar"}
                onChange={() => setModo("pisar")}
                style={{ width: "auto", minHeight: 0, padding: 0, border: "none", margin: 0, accentColor: "var(--brand-orange)" }}
              />
              Pisar lista del mes actual
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <input
                type="radio"
                name="modo"
                value="proximo"
                checked={modo === "proximo"}
                onChange={() => setModo("proximo")}
                style={{ width: "auto", minHeight: 0, padding: 0, border: "none", margin: 0, accentColor: "var(--brand-orange)" }}
              />
              Lista del próximo mes
            </label>
          </div>
        )}
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Procesando..." : "Subir y validar"}
        </button>
      </form>

      {state && !state.ok && (
        <p role="alert" style={{ color: "#c0392b", marginTop: 12, fontSize: 14 }}>
          {state.error}
        </p>
      )}

      {state && state.ok && (
        <div style={{ marginTop: 16, padding: 14, border: "1px solid var(--border-default)", borderRadius: 10, background: "var(--brand-orange-focus-bg)" }}>
          <p style={{ margin: "0 0 8px", fontSize: 14 }}>
            ✅ Se interpretaron <strong>{state.report.totalCells}</strong> celdas de precio, en las regiones:{" "}
            {state.report.regionsParsed.join(", ")}.{" "}
            {state.vigenteDeInmediato ? (
              <>
                Lista de precios actualizada: <strong>{state.vigenciaLabel}</strong>.
              </>
            ) : (
              <>
                Vigencia asignada: <strong>{state.vigenciaLabel}</strong>.
              </>
            )}
          </p>
          {state.report.warnings.length > 0 && (
            <div style={{ fontSize: 13 }}>
              <strong>Avisos ({state.report.warnings.length}):</strong>
              <ul>
                {state.report.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--text-neutral)" }}>
            {state.vigenteDeInmediato
              ? "Ya está pisando la lista activa — se usa en las cotizaciones nuevas de inmediato, sin pasar por Activar."
              : "Quedó guardada como borrador. Activala desde el historial de versiones cuando quieras que empiece a usarse en las cotizaciones."}
          </p>
        </div>
      )}
    </div>
  );
}
