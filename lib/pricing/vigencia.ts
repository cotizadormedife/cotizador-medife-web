const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export type Vigencia = { anio: number; mes: number };

export function formatVigencia(v: Vigencia): string {
  return `${MESES[v.mes - 1]} ${v.anio}`;
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
