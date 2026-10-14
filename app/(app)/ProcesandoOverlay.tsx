"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// RF-120: pantalla gris con un spinner mientras se procesa una navegación o una
// búsqueda que tarda (clic en una opción de menú o link interno, búsqueda con
// filtros, clic en una persona del gráfico). Aparece recién a los 150 ms, para
// que las navegaciones rápidas no parpadeen, y se va cuando la nueva pantalla
// está lista (cambia la ruta o los parámetros) o, como seguro, a los 30 s.

export const EVENTO_PROCESANDO = "app:procesando";
const DEMORA_MS = 150;
const SEGURO_MS = 30_000;

function esNavegacionInterna(a: HTMLAnchorElement, e: MouseEvent): boolean {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  if (a.target && a.target !== "_self") return false;
  if (a.hasAttribute("download")) return false;
  const url = new URL(a.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  if (url.pathname === window.location.pathname && url.search === window.location.search) return false; // misma pantalla (o solo #ancla)
  return true;
}

export default function ProcesandoOverlay() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [visible, setVisible] = useState(false);
  const pendiente = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seguro = useRef<ReturnType<typeof setTimeout> | null>(null);

  const arrancar = useRef(() => {});
  const detener = useRef(() => {});
  arrancar.current = () => {
    if (pendiente.current || visible) return;
    pendiente.current = setTimeout(() => setVisible(true), DEMORA_MS);
    seguro.current = setTimeout(() => detener.current(), SEGURO_MS);
  };
  detener.current = () => {
    if (pendiente.current) clearTimeout(pendiente.current);
    if (seguro.current) clearTimeout(seguro.current);
    pendiente.current = null;
    seguro.current = null;
    setVisible(false);
  };

  // La nueva pantalla está lista: cambió la ruta o los parámetros.
  useEffect(() => {
    detener.current();
  }, [pathname, search]);

  useEffect(() => {
    const alClic = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (a && esNavegacionInterna(a, e)) arrancar.current();
    };
    // Búsquedas con filtros: formularios GET (recargan la pantalla con los filtros en la dirección).
    const alEnviar = (e: Event) => {
      const f = e.target as HTMLFormElement | null;
      if (f?.tagName === "FORM" && (f.method || "get").toLowerCase() === "get" && !e.defaultPrevented) arrancar.current();
    };
    const alPedido = () => arrancar.current();
    // Volver a la pantalla desde el historial del navegador (bfcache) no debe dejar la pantalla gris.
    const alMostrar = (e: PageTransitionEvent) => {
      if (e.persisted) detener.current();
    };
    // En captura: el <Link> de Next hace preventDefault en su propio manejador.
    document.addEventListener("click", alClic, true);
    document.addEventListener("submit", alEnviar);
    window.addEventListener(EVENTO_PROCESANDO, alPedido);
    window.addEventListener("pageshow", alMostrar);
    return () => {
      document.removeEventListener("click", alClic, true);
      document.removeEventListener("submit", alEnviar);
      window.removeEventListener(EVENTO_PROCESANDO, alPedido);
      window.removeEventListener("pageshow", alMostrar);
    };
  }, []);

  if (!visible) return null;
  return (
    <div className="procesando-overlay" role="status" aria-live="polite" aria-label="Procesando">
      <div className="procesando-caja">
        <div className="procesando-spinner" aria-hidden="true" />
        <p>Procesando…</p>
      </div>
    </div>
  );
}
