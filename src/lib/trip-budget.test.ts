import { describe, expect, it } from "vitest";
import {
  algumItemPrecisaCambio,
  calcularFaltaPagar,
  calcularResumoCategoria,
  calcularTotaisGerais,
  itemPrecisaCambio,
  montarDadosDonut,
  validarNovaCategoria,
  validarNovoItem,
  type BudgetCategoryRow,
  type BudgetItemRow,
} from "./trip-budget";

function categoria(overrides: Partial<BudgetCategoryRow> = {}): BudgetCategoryRow {
  return {
    id: "cat-1",
    nome: "Hospedagem",
    cor: "#0EA5E9",
    ordem: 0,
    isDefault: true,
    ...overrides,
  };
}

function item(overrides: Partial<BudgetItemRow> = {}): BudgetItemRow {
  return {
    id: "item-1",
    categoryId: "cat-1",
    nome: "Hotel",
    nota: null,
    valorEstimadoBrlCents: null,
    valorEstimadoDestinoCents: null,
    valorPagoBrlCents: 0,
    valorPagoDestinoCents: 0,
    ...overrides,
  };
}

describe("calcularResumoCategoria", () => {
  it("consolida itens só em BRL", () => {
    const cat = categoria();
    const itens = [
      item({ id: "i1", valorEstimadoBrlCents: 100_000, valorPagoBrlCents: 40_000 }),
      item({ id: "i2", valorEstimadoBrlCents: 50_000, valorPagoBrlCents: 50_000 }),
    ];
    const resumo = calcularResumoCategoria(cat, itens, null);
    expect(resumo.totalEstimadoBrlCents).toBe(150_000);
    expect(resumo.totalPagoBrlCents).toBe(90_000);
    expect(resumo.estourada).toBe(false);
    expect(resumo.itens).toHaveLength(2);
  });

  it("consolida item estimado em moeda destino usando o câmbio manual", () => {
    const cat = categoria();
    const itens = [item({ valorEstimadoDestinoCents: 10_000 })];
    const resumo = calcularResumoCategoria(cat, itens, 5);
    expect(resumo.totalEstimadoBrlCents).toBe(50_000);
  });

  it("valor pago já convertido em BRL na escrita é somado diretamente (valor_pago_brl_cents é not null, sem fallback para destino)", () => {
    const cat = categoria();
    const itens = [item({ valorPagoBrlCents: 50_000, valorPagoDestinoCents: 10_000 })];
    const resumo = calcularResumoCategoria(cat, itens, 5);
    expect(resumo.totalPagoBrlCents).toBe(50_000);
  });

  it("sem câmbio manual, item só em moeda destino consolida como 0", () => {
    const cat = categoria();
    const itens = [item({ valorEstimadoDestinoCents: 10_000 })];
    const resumo = calcularResumoCategoria(cat, itens, null);
    expect(resumo.totalEstimadoBrlCents).toBe(0);
  });

  it("ignora itens de outras categorias", () => {
    const cat = categoria({ id: "cat-1" });
    const itens = [
      item({ id: "i1", categoryId: "cat-1", valorEstimadoBrlCents: 100_00 }),
      item({ id: "i2", categoryId: "cat-2", valorEstimadoBrlCents: 999_00 }),
    ];
    const resumo = calcularResumoCategoria(cat, itens, null);
    expect(resumo.itens).toHaveLength(1);
    expect(resumo.totalEstimadoBrlCents).toBe(100_00);
  });

  it("sinaliza estouro quando o total pago excede o total estimado", () => {
    const cat = categoria();
    const itens = [item({ valorEstimadoBrlCents: 100_00, valorPagoBrlCents: 150_00 })];
    const resumo = calcularResumoCategoria(cat, itens, null);
    expect(resumo.estourada).toBe(true);
  });

  it("categoria sem itens não estoura e totaliza 0", () => {
    const resumo = calcularResumoCategoria(categoria(), [], null);
    expect(resumo.totalEstimadoBrlCents).toBe(0);
    expect(resumo.totalPagoBrlCents).toBe(0);
    expect(resumo.estourada).toBe(false);
  });
});

describe("calcularTotaisGerais", () => {
  it("soma os totais de todas as categorias", () => {
    const resumos = [
      calcularResumoCategoria(
        categoria({ id: "cat-1" }),
        [item({ categoryId: "cat-1", valorEstimadoBrlCents: 100_00, valorPagoBrlCents: 50_00 })],
        null,
      ),
      calcularResumoCategoria(
        categoria({ id: "cat-2" }),
        [item({ categoryId: "cat-2", valorEstimadoBrlCents: 200_00, valorPagoBrlCents: 200_00 })],
        null,
      ),
    ];
    const totais = calcularTotaisGerais(resumos);
    expect(totais.totalEstimadoBrlCents).toBe(300_00);
    expect(totais.totalPagoBrlCents).toBe(250_00);
  });

  it("retorna zero para lista vazia", () => {
    expect(calcularTotaisGerais([])).toEqual({ totalEstimadoBrlCents: 0, totalPagoBrlCents: 0 });
  });
});

describe("calcularFaltaPagar", () => {
  it("calcula a diferença quando ainda falta pagar", () => {
    expect(calcularFaltaPagar(100_00, 40_00)).toBe(60_00);
  });

  it("nunca retorna negativo quando o pago excede o estimado (vira estouro, não falta negativa)", () => {
    expect(calcularFaltaPagar(100_00, 150_00)).toBe(0);
  });

  it("retorna 0 quando estimado e pago são iguais", () => {
    expect(calcularFaltaPagar(100_00, 100_00)).toBe(0);
  });
});

describe("montarDadosDonut", () => {
  it("mapeia cada categoria com estimado > 0 para uma fatia", () => {
    const resumos = [
      calcularResumoCategoria(
        categoria({ id: "cat-1", nome: "Hospedagem", cor: "#111" }),
        [item({ categoryId: "cat-1", valorEstimadoBrlCents: 100_00 })],
        null,
      ),
    ];
    expect(montarDadosDonut(resumos)).toEqual([
      { categoryId: "cat-1", nome: "Hospedagem", cor: "#111", valorBrlCents: 100_00 },
    ]);
  });

  it("exclui categorias com estimado total 0 (evita fatia de largura zero)", () => {
    const resumos = [calcularResumoCategoria(categoria(), [], null)];
    expect(montarDadosDonut(resumos)).toEqual([]);
  });
});

describe("itemPrecisaCambio / algumItemPrecisaCambio", () => {
  it("item só com estimado em moeda destino precisa de câmbio", () => {
    expect(itemPrecisaCambio(item({ valorEstimadoDestinoCents: 10_00 }))).toBe(true);
  });

  it("item só com pago em moeda destino precisa de câmbio", () => {
    expect(itemPrecisaCambio(item({ valorPagoDestinoCents: 10_00, valorPagoBrlCents: 0 }))).toBe(
      true,
    );
  });

  it("item totalmente em BRL não precisa de câmbio", () => {
    expect(
      itemPrecisaCambio(item({ valorEstimadoBrlCents: 10_00, valorPagoBrlCents: 10_00 })),
    ).toBe(false);
  });

  it("algumItemPrecisaCambio é falso quando já há câmbio manual definido", () => {
    const itens = [item({ valorEstimadoDestinoCents: 10_00 })];
    expect(algumItemPrecisaCambio(itens, 5)).toBe(false);
  });

  it("algumItemPrecisaCambio é verdadeiro sem câmbio e com item dependente", () => {
    const itens = [item({ valorEstimadoDestinoCents: 10_00 })];
    expect(algumItemPrecisaCambio(itens, null)).toBe(true);
  });

  it("algumItemPrecisaCambio é falso quando nenhum item depende de câmbio", () => {
    const itens = [item({ valorEstimadoBrlCents: 10_00 })];
    expect(algumItemPrecisaCambio(itens, null)).toBe(false);
  });
});

describe("validarNovaCategoria", () => {
  it("rejeita nome vazio", () => {
    expect(validarNovaCategoria("")).toBe("Nome da categoria é obrigatório.");
  });

  it("rejeita nome só com espaços", () => {
    expect(validarNovaCategoria("   ")).toBe("Nome da categoria é obrigatório.");
  });

  it("aceita nome válido", () => {
    expect(validarNovaCategoria("Passeios")).toBeNull();
  });
});

describe("validarNovoItem", () => {
  it("rejeita nome vazio", () => {
    expect(validarNovoItem({ nome: "", estimadoBrlCents: 100_00, estimadoDestinoCents: 0 })).toBe(
      "Nome do item é obrigatório.",
    );
  });

  it("rejeita quando nenhum valor estimado foi informado", () => {
    expect(validarNovoItem({ nome: "Hotel", estimadoBrlCents: 0, estimadoDestinoCents: 0 })).toBe(
      "Informe um valor estimado em pelo menos uma moeda.",
    );
  });

  it("aceita valor estimado só em BRL", () => {
    expect(
      validarNovoItem({ nome: "Hotel", estimadoBrlCents: 100_00, estimadoDestinoCents: 0 }),
    ).toBeNull();
  });

  it("aceita valor estimado só na moeda destino", () => {
    expect(
      validarNovoItem({ nome: "Hotel", estimadoBrlCents: 0, estimadoDestinoCents: 50_00 }),
    ).toBeNull();
  });
});
