"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// RF-118: pestañas del Dashboard (Todas las cotizaciones, Personas, Empresas/Grupos).
// Cada pestaña recuerda sus últimos filtros aplicados (en esta pestaña del navegador),
// así al volver a una sección se ve lo mismo que se dejó.

export type SeccionDashboard = "cotizaciones" | "personas" | "empresas";

const BASE: Record<SeccionDashboard, string> = {
  cotizaciones: "/admin/quotes",
  personas: "/admin/dashboard?tab=personas",
  empresas: "/admin/dashboard?tab=empresas",
};
const clave = (s: SeccionDashboard) => `dashboard-filtros:${s}`;

export default function DashboardTabs({ actual, esSuper }: { actual: SeccionDashboard; esSuper: boolean }) {
  const [guardadas, setGuardadas] = useState<Partial<Record<SeccionDashboard, string>>>({});

  useEffect(() => {
    try {
      sessionStorage.setItem(clave(actual), window.location.pathname + window.location.search);
    } catch {
      // sin almacenamiento (navegación privada, etc.): las pestañas abren sin filtros
    }
    const leidas: Partial<Record<SeccionDashboard, string>> = {};
    for (const s of Object.keys(BASE) as SeccionDashboard[]) {
      try {
        const v = sessionStorage.getItem(clave(s));
        if (v && v.startsWith(BASE[s].split("?")[0])) leidas[s] = v;
      } catch {
        // idem
      }
    }
    setGuardadas(leidas);
  }, [actual]);

  const item = (s: SeccionDashboard, texto: string) => (
    <Link className="dash-tab" href={guardadas[s] ?? BASE[s]} aria-current={actual === s ? "page" : undefined}>
      {texto}
    </Link>
  );

  return (
    <nav className="dash-tabs" aria-label="Secciones del dashboard">
      {item("cotizaciones", "Todas las cotizaciones")}
      {item("personas", "Personas")}
      {esSuper && item("empresas", "Empresas / Grupos")}
    </nav>
  );
}
