import { describe, expect, it } from "vitest";
import { categorizarNota, notaValida, NPS_NOTAS, NPS_NOTA_MAX, NPS_NOTA_MIN } from "./trip-nps";

describe("categorizarNota", () => {
  it.each([
    [0, "detrator"],
    [6, "detrator"],
    [7, "neutro"],
    [8, "neutro"],
    [9, "promotor"],
    [10, "promotor"],
  ])("nota %i é categorizada como %s", (nota, esperado) => {
    expect(categorizarNota(nota)).toBe(esperado);
  });
});

describe("notaValida", () => {
  it("aceita inteiros entre 0 e 10", () => {
    expect(notaValida(0)).toBe(true);
    expect(notaValida(10)).toBe(true);
    expect(notaValida(5)).toBe(true);
  });

  it("rejeita fora do intervalo", () => {
    expect(notaValida(-1)).toBe(false);
    expect(notaValida(11)).toBe(false);
  });

  it("rejeita não-inteiros", () => {
    expect(notaValida(5.5)).toBe(false);
  });
});

describe("NPS_NOTAS", () => {
  it("contém exatamente 11 notas, de 0 a 10 em ordem", () => {
    expect(NPS_NOTAS).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(NPS_NOTAS[0]).toBe(NPS_NOTA_MIN);
    expect(NPS_NOTAS[NPS_NOTAS.length - 1]).toBe(NPS_NOTA_MAX);
  });
});
