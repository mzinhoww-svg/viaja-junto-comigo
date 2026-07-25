import { describe, expect, it } from "vitest";
import { findDestinationOption, tripVariablesFromTrip } from "./trip-destinations";

describe("findDestinationOption (destino salvo → opção curada)", () => {
  it("casa por país e cidade", () => {
    expect(findDestinationOption("Estados Unidos", "Orlando")?.id).toBe("orlando-us");
  });

  it("distingue duas cidades do mesmo país", () => {
    // Orlando tem pack; Nova York não. Casar só por país escolheria a errada.
    expect(findDestinationOption("Estados Unidos", "Nova York")?.destinoPack).toBeNull();
    expect(findDestinationOption("Estados Unidos", "Orlando")?.destinoPack).toBe("orlando");
  });

  it("tolera caixa, acento e espaço em volta", () => {
    expect(findDestinationOption(" mexico ", "CANCUN")?.id).toBe("cancun-mx");
  });

  it("país sem cidade não casa com opção que tem cidade", () => {
    expect(findDestinationOption("Estados Unidos", null)).toBeNull();
  });

  it("destino digitado à mão não casa", () => {
    expect(findDestinationOption("Cazaquistão", "Almaty")).toBeNull();
  });
});

describe("tripVariablesFromTrip (VJT-011b)", () => {
  it("resolve as variáveis do destino curado", () => {
    expect(
      tripVariablesFromTrip({
        destinoPais: "Estados Unidos",
        destinoCidade: "Orlando",
        numCriancas: 0,
      }),
    ).toEqual({
      regiao: "america_norte",
      clima: "quente",
      destinoPack: "orlando",
      comCriancas: false,
      duracaoDias: null,
    });
  });

  it("destino livre cai no catálogo geral (tudo nulo), igual à clonagem", () => {
    expect(
      tripVariablesFromTrip({
        destinoPais: "Cazaquistão",
        destinoCidade: "Almaty",
        numCriancas: 0,
      }),
    ).toEqual({
      regiao: null,
      clima: null,
      destinoPack: null,
      comCriancas: false,
      duracaoDias: null,
    });
  });

  it("qualquer criança na trip liga comCriancas", () => {
    const vars = tripVariablesFromTrip({
      destinoPais: "Chile",
      destinoCidade: "Santiago",
      numCriancas: 2,
    });
    expect(vars.comCriancas).toBe(true);
    expect(vars.regiao).toBe("america_sul");
  });

  it("duracaoDias segue null — o wizard não coleta duração nesta leva", () => {
    expect(
      tripVariablesFromTrip({ destinoPais: "França", destinoCidade: "Paris", numCriancas: 1 })
        .duracaoDias,
    ).toBeNull();
  });
});
