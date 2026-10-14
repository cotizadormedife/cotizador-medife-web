"use client";

import { useRouter } from "next/navigation";
import { EVENTO_PROCESANDO } from "../../ProcesandoOverlay";

// RF-118/RF-120: un clic en una persona del gráfico (una barra o su nombre en la leyenda)
// → Todas las cotizaciones, ya filtrado por esa persona. Una barra lleva además el
// mes de esa barra; el nombre en la leyenda, todo el período elegido.
export default function IrAlListado({
  periodo,
  mesesDias,
  children,
}: {
  periodo: { desde: string; hasta: string };
  mesesDias: Record<string, { desde: string; hasta: string }>; // por mes "AAAA-MM"
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <div
      onClick={(e) => {
        const el = (e.target as HTMLElement).closest<HTMLElement>("[data-persona]");
        if (!el?.dataset.persona) return;
        const rango = (el.dataset.mes && mesesDias[el.dataset.mes]) || periodo;
        const q = new URLSearchParams({ usuario: el.dataset.persona, desde: rango.desde, hasta: rango.hasta });
        window.dispatchEvent(new Event(EVENTO_PROCESANDO));
        router.push(`/admin/quotes?${q.toString()}`);
      }}
    >
      {children}
    </div>
  );
}
