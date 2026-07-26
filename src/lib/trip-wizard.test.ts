import { describe, expect, it } from "vitest";
import {
  limparOrcamento,
  orcamentoInicialSugerido,
  ORCAMENTO_OUTRO,
  ORCAMENTO_SUGESTOES,
  tripVariablesFromInput,
  validarNovaTripInput,
  type NovaTripInput,
} from "./trip-wizard";

function input(overrides: Partial<NovaTripInput> = {}): NovaTripInput {
  return {
    destino: {
      pais: "Estados Unidos",
      cidade: "Orlando",
      regiao: "america_norte",
      clima: "quente",
      destinoPack: "orlando",
    },
    dataViagem: "2027-01-10",
    viajantes: { numPessoas: 2, numCriancas: 0 },
    orcamento: [],
    ...overrides,
  };
}

describe("validarNovaTripInput", () => {
  it("input válido não gera erros", () => {
    expect(validarNovaTripInput(input())).toEqual([]);
  });

  it("destino vazio gera erro", () => {
    const erros = validarNovaTripInput(
      input({
        destino: { pais: "  ", cidade: null, regiao: null, clima: null, destinoPack: null },
      }),
    );
    expect(erros).toContain("Informe o destino da viagem.");
  });

  it("modo sonho (sem data) é válido", () => {
    expect(validarNovaTripInput(input({ dataViagem: null }))).toEqual([]);
  });

  it("data inválida gera erro", () => {
    expect(validarNovaTripInput(input({ dataViagem: "não é uma data" }))).toContain(
      "Data da viagem inválida.",
    );
  });

  it("data no passado gera erro (não cria trip 'concluída' silenciosamente)", () => {
    const hoje = new Date(2026, 6, 24);
    const erros = validarNovaTripInput(input({ dataViagem: "2026-07-01" }), hoje);
    expect(erros).toContain(
      "Data da viagem não pode estar no passado. Escolha uma data futura ou ative o modo sonho.",
    );
  });

  it("data igual a hoje não é considerada passado", () => {
    const hoje = new Date(2026, 6, 24);
    expect(validarNovaTripInput(input({ dataViagem: "2026-07-24" }), hoje)).toEqual([]);
  });

  it("data futura não gera erro de data passada", () => {
    const hoje = new Date(2026, 6, 24);
    expect(validarNovaTripInput(input({ dataViagem: "2027-01-10" }), hoje)).toEqual([]);
  });

  it.each([0, 11])("número de viajantes fora de 1-10 (%i) gera erro", (numPessoas) => {
    const erros = validarNovaTripInput(input({ viajantes: { numPessoas, numCriancas: 0 } }));
    expect(erros).toContain("O número de viajantes deve ser entre 1 e 10.");
  });

  it("crianças negativas geram erro", () => {
    const erros = validarNovaTripInput(input({ viajantes: { numPessoas: 2, numCriancas: -1 } }));
    expect(erros).toContain("O número de crianças não pode ser negativo.");
  });

  it("crianças maior que o total de viajantes gera erro", () => {
    const erros = validarNovaTripInput(input({ viajantes: { numPessoas: 2, numCriancas: 3 } }));
    expect(erros).toContain("O número de crianças não pode ser maior que o total de viajantes.");
  });

  it("item de orçamento sem nome gera erro", () => {
    const erros = validarNovaTripInput(
      input({ orcamento: [{ nome: "  ", valorEstimadoBrlCents: 1000 }] }),
    );
    expect(erros).toContain("Todo item de orçamento precisa de um nome.");
  });

  it("item de orçamento com valor zero ou negativo gera erro", () => {
    const erros = validarNovaTripInput(
      input({ orcamento: [{ nome: "Hospedagem", valorEstimadoBrlCents: 0 }] }),
    );
    expect(erros).toContain('O valor estimado de "Hospedagem" deve ser maior que zero.');
  });

  it("orçamento vazio (passo pulado) é válido", () => {
    expect(validarNovaTripInput(input({ orcamento: [] }))).toEqual([]);
  });
});

describe("tripVariablesFromInput", () => {
  it("deriva as variáveis do destino e marca comCriancas quando há crianças", () => {
    const vars = tripVariablesFromInput(input({ viajantes: { numPessoas: 4, numCriancas: 2 } }));
    expect(vars).toEqual({
      regiao: "america_norte",
      clima: "quente",
      destinoPack: "orlando",
      comCriancas: true,
      duracaoDias: null,
    });
  });

  it("comCriancas é false quando numCriancas é 0", () => {
    const vars = tripVariablesFromInput(input({ viajantes: { numPessoas: 2, numCriancas: 0 } }));
    expect(vars.comCriancas).toBe(false);
  });

  it("destino livre (sem regiao/clima/pack) propaga nulls", () => {
    const vars = tripVariablesFromInput(
      input({
        destino: {
          pais: "Groenlândia",
          cidade: null,
          regiao: null,
          clima: null,
          destinoPack: null,
        },
      }),
    );
    expect(vars.regiao).toBeNull();
    expect(vars.clima).toBeNull();
    expect(vars.destinoPack).toBeNull();
  });
});

describe("orçamento com sugestões (VJT-021)", () => {
  it("abre o passo com três sugestões nomeadas e sem valor", () => {
    const inicial = orcamentoInicialSugerido();
    expect(inicial).toHaveLength(3);
    expect(inicial.every((i) => i.nome !== "")).toBe(true);
    expect(inicial.every((i) => i.valorEstimadoBrlCents === 0)).toBe(true);
    expect(inicial.every((i) => ORCAMENTO_SUGESTOES.includes(i.nome))).toBe(true);
  });

  it("descarta sugestão que o usuário não preencheu", () => {
    const limpo = limparOrcamento([
      { nome: "Passagens aéreas", valorEstimadoBrlCents: 500000 },
      { nome: "Hospedagem", valorEstimadoBrlCents: 0 },
      { nome: "", valorEstimadoBrlCents: 0 },
    ]);
    expect(limpo).toEqual([{ nome: "Passagens aéreas", valorEstimadoBrlCents: 500000 }]);
  });

  it("o estado inicial do wizard passa na validação sem o usuário tocar em nada", () => {
    // A regressão que este teste guarda: sem `limparOrcamento`, as três
    // sugestões com valor zero virariam "o valor estimado deve ser maior que
    // zero" e travariam o botão de criar viagem.
    const erros = validarNovaTripInput({
      destino: {
        pais: "Estados Unidos",
        cidade: "Orlando",
        regiao: null,
        clima: null,
        destinoPack: null,
      },
      dataViagem: null,
      viajantes: { numPessoas: 2, numCriancas: 0 },
      orcamento: limparOrcamento(orcamentoInicialSugerido()),
    });
    expect(erros).toEqual([]);
  });

  it("item digitado à mão sobrevive à limpeza", () => {
    const limpo = limparOrcamento([
      { nome: "Estacionamento no aeroporto", valorEstimadoBrlCents: 12000 },
    ]);
    expect(limpo).toHaveLength(1);
    expect(ORCAMENTO_SUGESTOES).not.toContain("Estacionamento no aeroporto");
  });

  it("a sentinela de 'Outro' não colide com nenhuma sugestão", () => {
    expect(ORCAMENTO_SUGESTOES).not.toContain(ORCAMENTO_OUTRO);
  });
});
