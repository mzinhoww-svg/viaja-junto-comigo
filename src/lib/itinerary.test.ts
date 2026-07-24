import { describe, expect, it } from "vitest";
import {
  canExportItineraryPdf,
  computeMovePlan,
  duplicateSlots,
  emptySlotsForNewDay,
  getItineraryDayLimit,
  isDayLimitReached,
  nextDayPosition,
  renumberAfterRemoval,
  type ItineraryDay,
} from "./itinerary";

function makeDay(diaNumero: number, id = `day-${diaNumero}`): ItineraryDay {
  return {
    id,
    diaNumero,
    ordem: diaNumero - 1,
    data: null,
    slots: [
      { id: `${id}-manha`, periodo: "manha", ondeIr: null, ondeComer: null, observacoes: null },
      { id: `${id}-tarde`, periodo: "tarde", ondeIr: null, ondeComer: null, observacoes: null },
      { id: `${id}-noite`, periodo: "noite", ondeIr: null, ondeComer: null, observacoes: null },
    ],
  };
}

describe("getItineraryDayLimit / isDayLimitReached", () => {
  it("limita o plano free a 5 dias", () => {
    expect(getItineraryDayLimit("free")).toBe(5);
  });

  it("não limita o plano premium", () => {
    expect(getItineraryDayLimit("premium")).toBeNull();
  });

  it("indica limite atingido no free com 5 dias", () => {
    expect(isDayLimitReached(5, "free")).toBe(true);
    expect(isDayLimitReached(4, "free")).toBe(false);
  });

  it("nunca atinge o limite no premium", () => {
    expect(isDayLimitReached(1000, "premium")).toBe(false);
  });
});

describe("canExportItineraryPdf", () => {
  it("permite export só no plano premium", () => {
    expect(canExportItineraryPdf("premium")).toBe(true);
    expect(canExportItineraryPdf("free")).toBe(false);
  });
});

describe("nextDayPosition", () => {
  it("começa em 1 numa lista vazia", () => {
    expect(nextDayPosition([])).toEqual({ diaNumero: 1, ordem: 0 });
  });

  it("continua a sequência numa lista não vazia", () => {
    const days = [makeDay(1), makeDay(2), makeDay(3)];
    expect(nextDayPosition(days)).toEqual({ diaNumero: 4, ordem: 3 });
  });

  it("usa o maior dia_numero mesmo fora de ordem", () => {
    const days = [makeDay(3), makeDay(1)];
    expect(nextDayPosition(days)).toEqual({ diaNumero: 4, ordem: 3 });
  });
});

describe("renumberAfterRemoval", () => {
  it("renumera os dias depois do removido", () => {
    const days = [makeDay(1), makeDay(2), makeDay(3), makeDay(4)];
    const updates = renumberAfterRemoval(days, 2);
    expect(updates).toEqual([
      { id: "day-3", diaNumero: 2, ordem: 1 },
      { id: "day-4", diaNumero: 3, ordem: 2 },
    ]);
  });

  it("não gera updates ao remover o último dia", () => {
    const days = [makeDay(1), makeDay(2)];
    expect(renumberAfterRemoval(days, 2)).toEqual([]);
  });

  it("renumera tudo ao remover o primeiro dia", () => {
    const days = [makeDay(1), makeDay(2), makeDay(3)];
    const updates = renumberAfterRemoval(days, 1);
    expect(updates).toEqual([
      { id: "day-2", diaNumero: 1, ordem: 0 },
      { id: "day-3", diaNumero: 2, ordem: 1 },
    ]);
  });
});

describe("computeMovePlan", () => {
  it("não move o primeiro dia para cima", () => {
    const days = [makeDay(1), makeDay(2)];
    expect(computeMovePlan(days, "day-1", "up")).toEqual([]);
  });

  it("não move o último dia para baixo", () => {
    const days = [makeDay(1), makeDay(2)];
    expect(computeMovePlan(days, "day-2", "down")).toEqual([]);
  });

  it("retorna [] para um id inexistente", () => {
    const days = [makeDay(1), makeDay(2)];
    expect(computeMovePlan(days, "day-999", "up")).toEqual([]);
  });

  it("troca dia 2 com dia 1 ao mover para cima, sem colidir dia_numero", () => {
    const days = [makeDay(1), makeDay(2), makeDay(3)];
    const plan = computeMovePlan(days, "day-2", "up");
    expect(plan).toEqual([
      { id: "day-2", diaNumero: 4, ordem: 3 },
      { id: "day-1", diaNumero: 2, ordem: 1 },
      { id: "day-2", diaNumero: 1, ordem: 0 },
    ]);

    const usedNumbers = new Set<number>();
    for (const step of plan) {
      expect(usedNumbers.has(step.diaNumero)).toBe(false);
    }
  });

  it("troca dia 2 com dia 3 ao mover para baixo", () => {
    const days = [makeDay(1), makeDay(2), makeDay(3)];
    const plan = computeMovePlan(days, "day-2", "down");
    expect(plan).toEqual([
      { id: "day-2", diaNumero: 4, ordem: 3 },
      { id: "day-3", diaNumero: 2, ordem: 1 },
      { id: "day-2", diaNumero: 3, ordem: 2 },
    ]);
  });
});

describe("emptySlotsForNewDay", () => {
  it("cria os 3 períodos vazios", () => {
    let n = 0;
    const slots = emptySlotsForNewDay(() => `id-${n++}`);
    expect(slots.map((s) => s.periodo)).toEqual(["manha", "tarde", "noite"]);
    expect(slots.every((s) => s.ondeIr === null && s.ondeComer === null)).toBe(true);
  });
});

describe("duplicateSlots", () => {
  it("copia o conteúdo preservando o período", () => {
    const source = makeDay(1).slots.map((s) =>
      s.periodo === "manha" ? { ...s, ondeIr: "Museu", ondeComer: "Café X" } : s,
    );
    let n = 0;
    const copy = duplicateSlots(source, () => `new-${n++}`);
    const manha = copy.find((s) => s.periodo === "manha");
    expect(manha?.ondeIr).toBe("Museu");
    expect(manha?.ondeComer).toBe("Café X");
    expect(manha?.id).toBe("new-0");
  });

  it("preserva os 3 períodos mesmo se a origem tiver menos slots", () => {
    const copy = duplicateSlots([], () => "x");
    expect(copy.map((s) => s.periodo)).toEqual(["manha", "tarde", "noite"]);
  });
});
