"use client";

import { useRef, useState, useTransition } from "react";
import { uploadPriceListAction, type UploadState } from "./actions";

export default function UploadForm() {
  const [state, setState] = useState<UploadState | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function submit(formData: FormData) {
    setState(null);
    startTransition(async () => {
      const res = await uploadPriceListAction(formData);
      setState(res);
      if (res.ok && fileRef.current) fileRef.current.value = "";
    });
  }

  return (
    <div>
      <form action={submit} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input ref={fileRef} type="file" name="file" accept=".xlsx" required style={{ flex: "1 1 260px" }} />
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
            {state.report.regionsParsed.join(", ")}.
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
            Quedó guardada como borrador. Activala desde el historial de versiones cuando quieras que empiece
            a usarse en las cotizaciones.
          </p>
        </div>
      )}
    </div>
  );
}
