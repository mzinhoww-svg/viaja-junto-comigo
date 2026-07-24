import { describe, expect, it } from "vitest";
import {
  PESO_PROGRESSO_CHECKLISTS,
  PESO_PROGRESSO_FINANCEIRO,
  calcularAcumulado,
  calcularMesesRestantes,
  calcularMeta,
  calcularProgressoChecklists,
  calcularProgressoFinanceiro,
  calcularProgressoJornada,
  calcularSugestaoMensal,
  calcularTripMath,
  categoriaEstourada,
  consolidarValorBRL,
  determinarModoTrip,
} from "./trip-math";

describe("consolidarValorBRL", () => {
  it("usa valor_brl quando presente", () => {
    expect(consolidarValorBRL({ brlCents: 10_000, destinoCents: 999_999 }, 5)).toBe(10_000);
  });

  it("usa valor_brl mesmo quando é zero (0 não é null)", () => {
    expect(consolidarValorBRL({ brlCents: 0, destinoCents: 500 }, 5)).toBe(0);
  });

  it("cai para valor_destino × cambio_manual quando valor_brl é null", () => {
    expect(consolidarValorBRL({ brlCents: null, destinoCents: 2_000 }, 5.5)).toBe(11_000);
  });

  it("arredonda o resultado de valor_destino × cambio_manual", () => {
    expect(consolidarValorBRL({ brlCents: null, destinoCents: 1_000 }, 5.333)).toBe(5_333);
  });

  it("retorna 0 (nunca NaN) quando falta o câmbio manual", () => {
    expect(consolidarValorBRL({ brlCents: null, destinoCents: 2_000 }, null)).toBe(0);
    expect(consolidarValorBRL({ brlCents: null, destinoCents: 2_000 }, undefined)).toBe(0);
  });

  it("retorna 0 quando câmbio manual é zero ou negativo", () => {
    expect(consolidarValorBRL({ brlCents: null, destinoCents: 2_000 }, 0)).toBe(0);
    expect(consolidarValorBRL({ brlCents: null, destinoCents: 2_000 }, -3)).toBe(0);
  });

  it("retorna 0 quando não há nenhum valor definido", () => {
    expect(consolidarValorBRL({ brlCents: null, destinoCents: null }, 5)).toBe(0);
  });
});

describe("calcularMeta", () => {
  it("soma o valor consolidado de todos os budget_items", () => {
    const meta = calcularMeta(
      [
        { brlCents: 100_000, destinoCents: null },
        { brlCents: null, destinoCents: 1_000 },
      ],
      5,
    );
    expect(meta).toBe(100_000 + 5_000);
  });

  it("retorna 0 para lista vazia", () => {
    expect(calcularMeta([], 5)).toBe(0);
  });
});

describe("calcularAcumulado", () => {
  it("soma savings_entries + valor_pago consolidado", () => {
    const acumulado = calcularAcumulado(
      [{ brlCents: 20_000, destinoCents: null }],
      [10_000, 5_000],
      5,
    );
    expect(acumulado).toBe(20_000 + 10_000 + 5_000);
  });

  it("retorna 0 quando não há pagamentos nem economias", () => {
    expect(calcularAcumulado([], [], null)).toBe(0);
  });
});

describe("calcularProgressoFinanceiro", () => {
  it("calcula acumulado / meta no caso normal", () => {
    expect(calcularProgressoFinanceiro(50_000, 100_000)).toBe(0.5);
  });

  it("edge case: meta zero retorna 0 (não NaN/Infinity)", () => {
    expect(calcularProgressoFinanceiro(0, 0)).toBe(0);
    expect(calcularProgressoFinanceiro(50_000, 0)).toBe(0);
  });

  it("permite ultrapassar 100% quando o acumulado excede a meta", () => {
    expect(calcularProgressoFinanceiro(150_000, 100_000)).toBe(1.5);
  });
});

describe("determinarModoTrip", () => {
  const hoje = new Date(2026, 6, 24);

  it("edge case: sem data de viagem → modo sonho", () => {
    expect(determinarModoTrip(null, hoje)).toBe("sonho");
  });

  it("edge case: data no passado → modo concluída", () => {
    expect(determinarModoTrip(new Date(2026, 5, 1), hoje)).toBe("concluida");
  });

  it("data futura → modo planejando", () => {
    expect(determinarModoTrip(new Date(2026, 9, 1), hoje)).toBe("planejando");
  });

  it("data igual a hoje → modo planejando (viagem começa hoje)", () => {
    expect(determinarModoTrip(new Date(2026, 6, 24), hoje)).toBe("planejando");
  });

  it("aceita data como string ISO", () => {
    expect(determinarModoTrip("2026-10-01T00:00:00.000Z", hoje)).toBe("planejando");
  });
});

describe("calcularMesesRestantes", () => {
  const hoje = new Date(2026, 6, 24);

  it("edge case: sem data de viagem (modo sonho) → null, sem countdown", () => {
    expect(calcularMesesRestantes(null, hoje)).toBeNull();
  });

  it("edge case: data no passado (modo concluída) → null, sem countdown", () => {
    expect(calcularMesesRestantes(new Date(2026, 0, 1), hoje)).toBeNull();
  });

  it("nunca retorna menos que 1 mês quando a viagem está próxima", () => {
    const daquiA10Dias = new Date(hoje.getTime() + 10 * 24 * 60 * 60 * 1000);
    expect(calcularMesesRestantes(daquiA10Dias, hoje)).toBe(1);
  });

  it("viagem hoje também conta como 1 mês restante (nunca 0)", () => {
    expect(calcularMesesRestantes(hoje, hoje)).toBe(1);
  });

  it("faz floor dos meses completos para datas mais distantes", () => {
    const daquiA95Dias = new Date(hoje.getTime() + 95 * 24 * 60 * 60 * 1000);
    expect(calcularMesesRestantes(daquiA95Dias, hoje)).toBe(3);
  });
});

describe("calcularSugestaoMensal", () => {
  it("calcula max(0, (meta - acumulado) / meses_restantes) no caso normal", () => {
    expect(calcularSugestaoMensal(120_000, 20_000, 4)).toBe(25_000);
  });

  it("edge case: sem meses_restantes (sonho/concluída) → null, sem sugestão mensal", () => {
    expect(calcularSugestaoMensal(120_000, 20_000, null)).toBeNull();
  });

  it("nunca sugere valor negativo quando o acumulado já superou a meta", () => {
    expect(calcularSugestaoMensal(50_000, 80_000, 3)).toBe(0);
  });
});

describe("calcularProgressoChecklists", () => {
  it("calcula itens done / itens totais no caso normal", () => {
    expect(calcularProgressoChecklists(3, 12)).toBe(0.25);
  });

  it("edge case: divisão por zero (nenhum item ainda) retorna 0", () => {
    expect(calcularProgressoChecklists(0, 0)).toBe(0);
  });
});

describe("calcularProgressoJornada", () => {
  it("usa pesos 0.5/0.5 por padrão (constantes, não hardcoded)", () => {
    expect(PESO_PROGRESSO_CHECKLISTS).toBe(0.5);
    expect(PESO_PROGRESSO_FINANCEIRO).toBe(0.5);
    expect(calcularProgressoJornada(0.4, 0.6)).toBeCloseTo(0.5);
  });

  it("aceita pesos customizados", () => {
    expect(calcularProgressoJornada(1, 0, 0.3, 0.7)).toBeCloseTo(0.3);
  });

  it("edge case: ambos os progressos zerados retorna 0", () => {
    expect(calcularProgressoJornada(0, 0)).toBe(0);
  });
});

describe("categoriaEstourada", () => {
  it("edge case: valor pago > estimado → true (sinaliza, nunca bloqueia)", () => {
    expect(categoriaEstourada(15_000, 10_000)).toBe(true);
  });

  it("valor pago <= estimado → false", () => {
    expect(categoriaEstourada(10_000, 10_000)).toBe(false);
    expect(categoriaEstourada(5_000, 10_000)).toBe(false);
  });

  it("sem estimativa definida → false (não há como estourar)", () => {
    expect(categoriaEstourada(5_000, null)).toBe(false);
  });
});

describe("calcularTripMath (integração)", () => {
  const hoje = new Date(2026, 6, 24);

  it("modo sonho: sem countdown nem sugestão mensal", () => {
    const resultado = calcularTripMath({
      budgetItemsEstimado: [{ brlCents: 100_000, destinoCents: null }],
      budgetItemsPago: [{ brlCents: 20_000, destinoCents: null }],
      savingsEntriesBrlCents: [10_000],
      cambioManual: null,
      dataViagem: null,
      checklistItensDone: 3,
      checklistItensTotal: 12,
      hoje,
    });

    expect(resultado.modo).toBe("sonho");
    expect(resultado.mesesRestantes).toBeNull();
    expect(resultado.sugestaoMensalBrlCents).toBeNull();
    expect(resultado.metaBrlCents).toBe(100_000);
    expect(resultado.acumuladoBrlCents).toBe(30_000);
    expect(resultado.progressoFinanceiro).toBe(0.3);
    expect(resultado.progressoChecklists).toBe(0.25);
    expect(resultado.progressoJornada).toBeCloseTo(0.5 * 0.25 + 0.5 * 0.3);
  });

  it("modo concluída (data no passado): sem countdown nem sugestão mensal", () => {
    const resultado = calcularTripMath({
      budgetItemsEstimado: [{ brlCents: 100_000, destinoCents: null }],
      budgetItemsPago: [{ brlCents: 100_000, destinoCents: null }],
      savingsEntriesBrlCents: [],
      cambioManual: null,
      dataViagem: new Date(2026, 0, 1),
      checklistItensDone: 12,
      checklistItensTotal: 12,
      hoje,
    });

    expect(resultado.modo).toBe("concluida");
    expect(resultado.mesesRestantes).toBeNull();
    expect(resultado.sugestaoMensalBrlCents).toBeNull();
    expect(resultado.progressoChecklists).toBe(1);
  });

  it("modo planejando com meta zero: progresso financeiro fica em 0 (indicador oculto no caller)", () => {
    const resultado = calcularTripMath({
      budgetItemsEstimado: [],
      budgetItemsPago: [],
      savingsEntriesBrlCents: [],
      cambioManual: null,
      dataViagem: new Date(2026, 9, 1),
      checklistItensDone: 0,
      checklistItensTotal: 0,
      hoje,
    });

    expect(resultado.modo).toBe("planejando");
    expect(resultado.metaBrlCents).toBe(0);
    expect(resultado.progressoFinanceiro).toBe(0);
    expect(resultado.progressoChecklists).toBe(0);
    expect(resultado.mesesRestantes).toBeGreaterThanOrEqual(1);
  });

  it("consolida valores em moeda destino via câmbio manual em meta e acumulado", () => {
    const resultado = calcularTripMath({
      budgetItemsEstimado: [{ brlCents: null, destinoCents: 1_000 }],
      budgetItemsPago: [{ brlCents: null, destinoCents: 500 }],
      savingsEntriesBrlCents: [1_000],
      cambioManual: 5,
      dataViagem: new Date(2026, 9, 1),
      checklistItensDone: 1,
      checklistItensTotal: 2,
      hoje,
    });

    expect(resultado.metaBrlCents).toBe(5_000);
    expect(resultado.acumuladoBrlCents).toBe(2_500 + 1_000);
  });
});
