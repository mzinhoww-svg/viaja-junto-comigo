import { describe, expect, it } from "vitest";
import { formatBRL } from "./money";
import {
  calcularDicaEconomia,
  calcularValorRegistradoNoMes,
  entryAutorLabel,
  formatMesAnoLabel,
  inputMonthFromMesAno,
  mesAnoAtual,
  mesAnoFromInputMonth,
} from "./trip-savings";

describe("entryAutorLabel", () => {
  it("retorna 'Membro removido' quando created_by é null (conta excluída, VJT-017)", () => {
    expect(entryAutorLabel(null)).toBe("Membro removido");
  });

  it("retorna null quando o autor ainda existe (nenhum rótulo extra a mostrar)", () => {
    expect(entryAutorLabel("11111111-1111-1111-1111-111111111111")).toBeNull();
  });
});

describe("mesAnoAtual", () => {
  it("retorna o primeiro dia do mês corrente", () => {
    expect(mesAnoAtual(new Date(2026, 6, 24))).toBe("2026-07-01");
  });

  it("preenche o mês com zero à esquerda", () => {
    expect(mesAnoAtual(new Date(2026, 0, 5))).toBe("2026-01-01");
  });
});

describe("mesAnoFromInputMonth / inputMonthFromMesAno", () => {
  it("converte 'YYYY-MM' para 'YYYY-MM-01'", () => {
    expect(mesAnoFromInputMonth("2026-07")).toBe("2026-07-01");
  });

  it("converte 'YYYY-MM-DD' de volta para 'YYYY-MM'", () => {
    expect(inputMonthFromMesAno("2026-07-01")).toBe("2026-07");
  });
});

describe("formatMesAnoLabel", () => {
  it("formata mês e ano por extenso em pt-BR", () => {
    expect(formatMesAnoLabel("2026-07-01")).toBe("Julho de 2026");
  });

  it("capitaliza corretamente meses com acento", () => {
    expect(formatMesAnoLabel("2026-03-01")).toBe("Março de 2026");
  });
});

describe("calcularValorRegistradoNoMes", () => {
  it("soma apenas os registros do mês pedido", () => {
    const total = calcularValorRegistradoNoMes(
      [
        { mesAno: "2026-07-01", valorBrlCents: 10_000 },
        { mesAno: "2026-07-01", valorBrlCents: 5_000 },
        { mesAno: "2026-08-01", valorBrlCents: 99_999 },
      ],
      "2026-07-01",
    );
    expect(total).toBe(15_000);
  });

  it("retorna 0 quando não há registros no mês", () => {
    expect(calcularValorRegistradoNoMes([], "2026-07-01")).toBe(0);
  });
});

describe("calcularDicaEconomia", () => {
  it("modo concluída: dica retrospectiva, ignora meta/sugestão", () => {
    const dica = calcularDicaEconomia({
      modo: "concluida",
      metaBrlCents: 100_000,
      acumuladoBrlCents: 30_000,
      sugestaoMensalBrlCents: null,
      valorRegistradoNoMesBrlCents: 0,
    });
    expect(dica.tom).toBe("neutro");
    expect(dica.mensagem).toMatch(/concluída/i);
  });

  it("meta zero: orienta a definir orçamento", () => {
    const dica = calcularDicaEconomia({
      modo: "planejando",
      metaBrlCents: 0,
      acumuladoBrlCents: 0,
      sugestaoMensalBrlCents: null,
      valorRegistradoNoMesBrlCents: 0,
    });
    expect(dica.tom).toBe("neutro");
    expect(dica.mensagem).toMatch(/orçamento/i);
  });

  it("acumulado já bate ou passa a meta: comemora, mesmo com sugestão pendente", () => {
    const dica = calcularDicaEconomia({
      modo: "planejando",
      metaBrlCents: 100_000,
      acumuladoBrlCents: 120_000,
      sugestaoMensalBrlCents: 0,
      valorRegistradoNoMesBrlCents: 0,
    });
    expect(dica.tom).toBe("positivo");
    expect(dica.mensagem).toMatch(/meta batida/i);
  });

  it("modo sonho sem meta batida: orienta a definir data de viagem", () => {
    const dica = calcularDicaEconomia({
      modo: "sonho",
      metaBrlCents: 100_000,
      acumuladoBrlCents: 10_000,
      sugestaoMensalBrlCents: null,
      valorRegistradoNoMesBrlCents: 0,
    });
    expect(dica.tom).toBe("neutro");
    expect(dica.mensagem).toMatch(/data de viagem/i);
  });

  it("sugestão mensal zerada (arredondamento) sem meta batida: considera em dia", () => {
    const dica = calcularDicaEconomia({
      modo: "planejando",
      metaBrlCents: 100_000,
      acumuladoBrlCents: 99_995,
      sugestaoMensalBrlCents: 0,
      valorRegistradoNoMesBrlCents: 0,
    });
    expect(dica.tom).toBe("positivo");
    expect(dica.mensagem).toMatch(/em dia/i);
  });

  it("já guardou o suficiente este mês: parabeniza", () => {
    const dica = calcularDicaEconomia({
      modo: "planejando",
      metaBrlCents: 100_000,
      acumuladoBrlCents: 10_000,
      sugestaoMensalBrlCents: 5_000,
      valorRegistradoNoMesBrlCents: 5_000,
    });
    expect(dica.tom).toBe("positivo");
    expect(dica.mensagem).toMatch(/mandou bem/i);
  });

  it("ainda falta guardar este mês: mostra quanto falta formatado em BRL", () => {
    const dica = calcularDicaEconomia({
      modo: "planejando",
      metaBrlCents: 100_000,
      acumuladoBrlCents: 10_000,
      sugestaoMensalBrlCents: 5_000,
      valorRegistradoNoMesBrlCents: 2_000,
    });
    expect(dica.tom).toBe("atencao");
    expect(dica.mensagem).toBe(`Faltam ${formatBRL(3_000)} este mês para ficar em dia com a meta.`);
  });
});
