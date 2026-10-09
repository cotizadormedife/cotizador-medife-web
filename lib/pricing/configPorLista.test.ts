import { describe, expect, it } from "vitest";
import { armarConfig, claveTopePorLista } from "./configPorLista";

const FILAS = [
  { key: "aporte_tope", value: "4509567.41" },
  { key: "aporte_pct_capado", value: 0.0255 },
  { key: "aporte_factor_medife", value: 0.97 },
  { key: claveTopePorLista("lista-sep"), value: 4691748.47 },
  { key: claveTopePorLista("lista-oct"), value: 4771508 },
];

describe("armarConfig", () => {
  it("usa el tope propio de la lista con la que se cotiza", () => {
    expect(armarConfig(FILAS, "lista-oct").aporte_tope).toBe(4771508);
    expect(armarConfig(FILAS, "lista-sep").aporte_tope).toBe(4691748.47);
  });

  it("una lista sin tope propio (cargada antes de RF-103) cae al tope general", () => {
    expect(armarConfig(FILAS, "lista-vieja").aporte_tope).toBe(4509567.41);
    expect(armarConfig(FILAS).aporte_tope).toBe(4509567.41);
  });

  it("las claves por lista no se cuelan en la configuración general", () => {
    const config = armarConfig(FILAS, "lista-oct");
    expect(Object.keys(config).sort()).toEqual(["aporte_factor_medife", "aporte_pct_capado", "aporte_tope"]);
    expect(config.aporte_pct_capado).toBe(0.0255);
  });

  it("un tope propio inválido (0, negativo o no numérico) se ignora", () => {
    for (const malo of [0, -5, "abc"]) {
      const filas = [{ key: "aporte_tope", value: 4509567.41 }, { key: claveTopePorLista("x"), value: malo }];
      expect(armarConfig(filas, "x").aporte_tope).toBe(4509567.41);
    }
  });
});
