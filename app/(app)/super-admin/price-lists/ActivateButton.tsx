"use client";

import { useTransition } from "react";
import { activatePriceListAction } from "./actions";

export default function ActivateButton({ versionId }: { versionId: string }) {
  const [pending, startTransition] = useTransition();

  function activate() {
    if (!confirm("¿Activar esta versión? Pasa a usarse en las cotizaciones nuevas de inmediato.")) return;
    startTransition(() => {
      activatePriceListAction(versionId);
    });
  }

  return (
    <button type="button" className="btn-primary" onClick={activate} disabled={pending} style={{ padding: "6px 14px", fontSize: 12, minHeight: 0 }}>
      {pending ? "Activando..." : "Activar"}
    </button>
  );
}
