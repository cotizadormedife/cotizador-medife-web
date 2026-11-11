import { describe, expect, it } from "vitest";
import { DESCRIPCION_LISTA_MAX, normalizarDescripcionLista } from "./descripcionLista";

describe("normalizarDescripcionLista (RF-122)", () => {
  it("vacío, solo espacios o ausente → null (el campo es opcional)", () => {
    expect(normalizarDescripcionLista("")).toEqual({ valor: null });
    expect(normalizarDescripcionLista("   ")).toEqual({ valor: null });
    expect(normalizarDescripcionLista(null)).toEqual({ valor: null });
    expect(normalizarDescripcionLista(undefined)).toEqual({ valor: null });
  });
  it("recorta y junta espacios", () => {
    expect(normalizarDescripcionLista("  Lista   actual ")).toEqual({ valor: "Lista actual" });
  });
  it("acepta exactamente 50 caracteres y rechaza 51", () => {
    expect(DESCRIPCION_LISTA_MAX).toBe(50);
    expect(normalizarDescripcionLista("a".repeat(50))).toEqual({ valor: "a".repeat(50) });
    expect(normalizarDescripcionLista("a".repeat(51))).toEqual({ error: "La descripción puede tener hasta 50 caracteres." });
  });
  it("cuenta caracteres, no bytes (tildes y ñ valen 1)", () => {
    expect(normalizarDescripcionLista("ñ".repeat(50))).toEqual({ valor: "ñ".repeat(50) });
  });
  it("los textos pedidos entran", () => {
    expect(normalizarDescripcionLista("Lista actual")).toEqual({ valor: "Lista actual" });
    expect(normalizarDescripcionLista("Es noviembre con descuentos visibles")).toEqual({ valor: "Es noviembre con descuentos visibles" });
  });
});
