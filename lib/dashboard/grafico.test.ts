import { describe, expect, it } from "vitest";
import { anchoBarra, elegirSeries, escalaY, MAX_SERIES, mostrarValores, PALETA_SERIES } from "./grafico";
import type { FilaGrafico } from "./estadisticas";

const fila = (n: number): FilaGrafico => ({ clave: `k${n}`, etiqueta: `Persona ${n}`, porMes: {}, total: 100 - n });

describe("elegirSeries (máximo 8, sin inventar colores)", () => {
  it("con 2 personas elegidas se muestran las 2, cada una por separado", () => {
    const r = elegirSeries([fila(1), fila(2)]);
    expect(r.series).toHaveLength(2);
    expect(r.recortado).toBe(false);
  });
  it("con más de 8 se muestran las 8 con más cotizaciones y se avisa", () => {
    const r = elegirSeries(Array.from({ length: 66 }, (_, i) => fila(i)));
    expect(r.series).toHaveLength(MAX_SERIES);
    expect(r.series[0].clave).toBe("k0"); // la de mayor total primero
    expect(r.totalElegidas).toBe(66);
    expect(r.recortado).toBe(true);
  });
  it("la paleta tiene un color por serie y sin repetirse", () => {
    expect(new Set(PALETA_SERIES).size).toBe(MAX_SERIES);
  });
});

describe("escalaY", () => {
  it("elige un tope redondo que contiene al máximo y marcas parejas", () => {
    expect(escalaY(819)).toEqual({ tope: 1000, ticks: [0, 250, 500, 750, 1000] });
    expect(escalaY(214)).toEqual({ tope: 240, ticks: [0, 60, 120, 180, 240] });
    expect(escalaY(12362).tope).toBe(16000);
    expect(escalaY(5).tope).toBe(8); // mínimo: 4 marcas enteras
    expect(escalaY(0).tope).toBe(4); // sin datos no rompe
  });
  it("el tope siempre alcanza para el máximo", () => {
    for (const m of [1, 3, 7, 12, 99, 101, 640, 2819, 12362]) expect(escalaY(m).tope).toBeGreaterThanOrEqual(m);
  });
});

describe("anchoBarra / mostrarValores", () => {
  it("barras finas: máximo 24 px y más angostas con más series", () => {
    expect(anchoBarra(1)).toBe(24);
    expect(anchoBarra(2)).toBe(24);
    expect(anchoBarra(8)).toBe(24); // 8 series todavía entran a 24 px
    expect(anchoBarra(12)).toBe(21);
    expect(anchoBarra(100)).toBe(10); // piso: nunca más finas que 10 px
  });
  it("muestra números sobre las barras solo si son pocas", () => {
    expect(mostrarValores(2, 1)).toBe(true); // 2 personas, 1 mes
    expect(mostrarValores(2, 6)).toBe(true);
    expect(mostrarValores(8, 10)).toBe(false);
  });
});
