"use client";

import { useTransition } from "react";
import { toggleHabilitadaAction } from "./actions";

export default function ToggleHabilitadaButton({ versionId, habilitada }: { versionId: string; habilitada: boolean }) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !habilitada;
    if (!next && !confirm("¿Deshabilitar esta lista? Deja de ofrecerse en el combo del cotizador.")) return;
    startTransition(async () => {
      const res = await toggleHabilitadaAction(versionId, next);
      if (!res.ok) alert(res.error);
    });
  }

  return (
    <button type="button" onClick={toggle} disabled={pending} style={{ padding: "6px 14px", fontSize: 12, minHeight: 0 }}>
      {pending ? "..." : habilitada ? "Deshabilitar" : "Habilitar"}
    </button>
  );
}
