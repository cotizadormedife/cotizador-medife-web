import type { FilaGrafico } from "./estadisticas";

// RF-107: cálculos del gráfico comparativo del Dashboard (puros, para probarlos).

// Paleta categórica validada (adyacentes separables incluso con daltonismo): como
// máximo 8 series — con más no se generan colores nuevos, se muestran las 8 con
// más cotizaciones y se avisa.
export const PALETA_SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"] as const;
export const MAX_SERIES = PALETA_SERIES.length;

export type SeriesElegidas = { series: FilaGrafico[]; totalElegidas: number; recortado: boolean };

// `filas` ya viene ordenada de mayor a menor total.
export function elegirSeries(filas: FilaGrafico[], max: number = MAX_SERIES): SeriesElegidas {
  return { series: filas.slice(0, max), totalElegidas: filas.length, recortado: filas.length > max };
}

// Eje vertical con marcas en pasos "redondos" (1, 2, 2,5, 3, 4, 5, 6, 8 × 10^k,
// siempre enteros): el tope es la marca más alta y alcanza para el máximo.
const FACTORES_PASO = [1, 2, 2.5, 3, 4, 5, 6, 8, 10];

export function escalaY(maximo: number, marcas: number = 4): { tope: number; ticks: number[] } {
  const minimoPaso = Math.max(1, maximo) / marcas;
  const potencia = 10 ** Math.floor(Math.log10(minimoPaso));
  const paso = FACTORES_PASO.map((f) => f * potencia).find((p) => p >= minimoPaso && Number.isInteger(p)) ?? Math.ceil(minimoPaso);
  return { tope: paso * marcas, ticks: Array.from({ length: marcas + 1 }, (_, i) => paso * i) };
}

// Barras finas (máx. 24 px), más angostas cuanto más series haya por mes.
export function anchoBarra(cantidadSeries: number): number {
  return Math.min(24, Math.max(10, Math.floor(260 / Math.max(1, cantidadSeries))));
}

// Un número sobre cada barra solo cuando son pocas; si no, es ruido (queda el tooltip y la leyenda).
export function mostrarValores(cantidadSeries: number, cantidadMeses: number): boolean {
  return cantidadSeries * cantidadMeses <= 16;
}
