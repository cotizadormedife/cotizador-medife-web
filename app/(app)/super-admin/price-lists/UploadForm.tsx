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

export default function UploadForm({ existingProximoLabel }: { existingProximoLabel: string | null }) {
  const [state, setState] = useState<UploadState | null>(null);
  const [pending, startTransition] = useTransition();
  const [fileName, setFileName] = useState<string | null>(null);
  const [modo, setModo] = useState<Modo>("proximo");
  const fileRef = useRef<HTMLInputElement>(null);

  function submit(formData: FormData) {
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) {
      alert("Elegí un archivo .xlsx.");
      return;
    }

    // RF-66: si ya hay una lista cargada para el próximo mes, el popup avisa
    // puntualmente que la va a sobrescribir, en vez del texto genérico.
    const mensaje =
      modo === "proximo" && existingProximoLabel
        ? `Ya está cargada la lista del próximo mes (${existingProximoLabel}), ¿estás seguro que querés sobreescribirla con esta versión?`
        : `¿Confirmás que querés subir este archivo como lista de precios ${CONFIRM_DESCRIPCION[modo]}?`;
    const ok = confirm(mensaje);
    if (!ok) return;

    setState(null);
    startTransition(async () => {
      const res = await uploadPriceListAction(formData);
      setState(res);
      if (res.ok) {
        if (fileRef.current) fileRef.current.value = "";
        setFileName(null);
        setModo("proximo");
      }
    });
  }

  return (
    <div>
      <form action={submit} style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
          <div
            style={{
              boxSizing: "border-box",
              width: 584,
              height: 44,
              display: "flex",
              alignItems: "center",
              padding: "0 14px",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-input)",
              fontSize: 14,
              color: fileName ? "var(--text-primary)" : "var(--text-muted)",
              background: "#ffffff",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {fileName ?? "Ningún archivo seleccionado"}
          </div>
          <input
            ref={fileRef}
            type="file"
            name="file"
            accept=".xlsx"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            style={{ display: "none" }}
          />
          <button type="button" onClick={() => fileRef.current?.click()} style={{ padding: "8px 16px", fontSize: 13, minHeight: 0 }}>
            Seleccionar archivo
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: 44, fontSize: 12, whiteSpace: "nowrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input
              type="radio"
              name="modo"
              value="pisar"
              checked={modo === "pisar"}
              onChange={() => setModo("pisar")}
              style={{ width: 16, height: 16, minHeight: 0, padding: 0, border: "none", margin: 0, accentColor: "var(--brand-orange)" }}
            />
            Pisar lista del mes actual
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input
              type="radio"
              name="modo"
              value="proximo"
              checked={modo === "proximo"}
              onChange={() => setModo("proximo")}
              style={{ width: 16, height: 16, minHeight: 0, padding: 0, border: "none", margin: 0, accentColor: "var(--brand-orange)" }}
            />
            Lista del próximo mes
          </label>
        </div>
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
            {state.report.regionsParsed.join(", ")}. Lista de precios: <strong>{state.vigenciaLabel}</strong>.
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
              ? "Ya está pisando la lista activa — se usa en las cotizaciones nuevas de inmediato."
              : "Ya está disponible como lista del mes siguiente en el cotizador — no hace falta ningún paso más."}
          </p>
        </div>
      )}
    </div>
  );
}
