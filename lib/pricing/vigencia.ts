const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export type Vigencia = { anio: number; mes: number };

// RF-67: "Septiembre 2026 Ver.2" — versionNum se omite solo cuando todavía
// no hay una versión real asociada (ej. el texto de vista previa antes de
// cargar un archivo).
export function formatVigencia(v: Vigencia, versionNum?: number): string {
  const base = `${MESES[v.mes - 1]} ${v.anio}`;
  return versionNum != null ? `${base} Ver.${versionNum}` : base;
}

export function nextVigencia(v: Vigencia): Vigencia {
  return v.mes === 12 ? { anio: v.anio + 1, mes: 1 } : { anio: v.anio, mes: v.mes + 1 };
}

export function compareVigencia(a: Vigencia, b: Vigencia): number {
  return a.anio - b.anio || a.mes - b.mes;
}

// RF-65: mes actual/siguiente se definen por la fecha real de hoy en
// Argentina (no la del servidor, que en Vercel corre en UTC).
export function vigenciaDeHoy(): Vigencia {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());
  const anio = Number(partes.find((p) => p.type === "year")!.value);
  const mes = Number(partes.find((p) => p.type === "month")!.value);
  return { anio, mes };
}
