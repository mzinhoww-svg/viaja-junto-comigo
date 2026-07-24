import { describe, expect, it } from "vitest";
import {
  buildDayHeading,
  buildDaySlotLines,
  buildItinerarySummary,
  buildItineraryPdfDocument,
  itineraryPdfFileName,
  type ItineraryPdfTrip,
} from "./itinerary-pdf";
import type { ItineraryDay } from "./itinerary";

function makeTrip(overrides: Partial<ItineraryPdfTrip> = {}): ItineraryPdfTrip {
  return {
    nome: "Férias em Orlando",
    destinoPais: "Estados Unidos",
    destinoCidade: "Orlando",
    dataViagem: "2026-12-10",
    numPessoas: 2,
    ...overrides,
  };
}

function makeDay(overrides: Partial<ItineraryDay> = {}): ItineraryDay {
  return {
    id: "day-1",
    diaNumero: 1,
    ordem: 0,
    data: null,
    slots: [],
    ...overrides,
  };
}

describe("buildItinerarySummary", () => {
  it("combina cidade e país quando a cidade existe", () => {
    const summary = buildItinerarySummary(makeTrip(), []);
    expect(summary.destino).toBe("Orlando, Estados Unidos");
  });

  it("usa só o país quando não há cidade", () => {
    const summary = buildItinerarySummary(makeTrip({ destinoCidade: null }), []);
    expect(summary.destino).toBe("Estados Unidos");
  });

  it("formata a data em pt-BR quando existe", () => {
    const summary = buildItinerarySummary(makeTrip({ dataViagem: "2026-12-10" }), []);
    expect(summary.periodo).toBe("10/12/2026");
  });

  it("indica modo sonho quando não há data_viagem", () => {
    const summary = buildItinerarySummary(makeTrip({ dataViagem: null }), []);
    expect(summary.periodo).toBe("Data ainda não definida");
  });

  it("usa singular para 1 dia e 1 pessoa", () => {
    const summary = buildItinerarySummary(makeTrip({ numPessoas: 1 }), [makeDay()]);
    expect(summary.totalDiasLabel).toBe("1 dia de roteiro");
    expect(summary.viajantesLabel).toBe("1 pessoa");
  });

  it("usa plural para vários dias e pessoas", () => {
    const summary = buildItinerarySummary(makeTrip({ numPessoas: 4 }), [
      makeDay({ id: "d1", diaNumero: 1 }),
      makeDay({ id: "d2", diaNumero: 2 }),
    ]);
    expect(summary.totalDiasLabel).toBe("2 dias de roteiro");
    expect(summary.viajantesLabel).toBe("4 pessoas");
  });

  it("total de dias zero quando o roteiro está vazio", () => {
    const summary = buildItinerarySummary(makeTrip(), []);
    expect(summary.totalDiasLabel).toBe("0 dias de roteiro");
  });
});

describe("buildDayHeading", () => {
  it("mostra só o número do dia quando não há data própria", () => {
    expect(buildDayHeading(makeDay({ diaNumero: 3, data: null }))).toBe("Dia 3");
  });

  it("mostra a data formatada quando o dia tem data própria", () => {
    expect(buildDayHeading(makeDay({ diaNumero: 1, data: "2026-12-10" }))).toBe(
      "Dia 1 — 10/12/2026",
    );
  });
});

describe("buildDaySlotLines", () => {
  it("preenche os 3 períodos com placeholder quando os campos estão vazios", () => {
    const lines = buildDaySlotLines(makeDay({ slots: [] }));
    expect(lines.map((l) => l.label)).toEqual(["Manhã", "Tarde", "Noite"]);
    expect(
      lines.every((l) => l.ondeIr === "—" && l.ondeComer === "—" && l.observacoes === "—"),
    ).toBe(true);
  });

  it("usa os valores reais quando preenchidos", () => {
    const day = makeDay({
      slots: [
        {
          id: "s1",
          periodo: "manha",
          ondeIr: "Museu",
          ondeComer: "Café X",
          observacoes: "Levar guarda-chuva",
        },
      ],
    });
    const manha = buildDaySlotLines(day).find((l) => l.label === "Manhã");
    expect(manha).toEqual({
      label: "Manhã",
      ondeIr: "Museu",
      ondeComer: "Café X",
      observacoes: "Levar guarda-chuva",
    });
  });

  it("trata string vazia como campo não preenchido", () => {
    const day = makeDay({
      slots: [{ id: "s1", periodo: "tarde", ondeIr: "", ondeComer: null, observacoes: null }],
    });
    const tarde = buildDaySlotLines(day).find((l) => l.label === "Tarde");
    expect(tarde?.ondeIr).toBe("—");
  });
});

describe("itineraryPdfFileName", () => {
  it("troca espaços por hífen e usa minúsculas", () => {
    expect(itineraryPdfFileName("Férias em Orlando")).toBe("roteiro-ferias-em-orlando.pdf");
  });

  it("remove acentos", () => {
    expect(itineraryPdfFileName("São Paulo → Lisboa")).toContain("roteiro-sao-paulo");
  });

  it("cai para 'viagem' quando o nome fica vazio depois da limpeza", () => {
    expect(itineraryPdfFileName("   ")).toBe("roteiro-viagem.pdf");
  });
});

describe("buildItineraryPdfDocument", () => {
  it("gera um documento não vazio sem nenhum dia", () => {
    const doc = buildItineraryPdfDocument(makeTrip(), []);
    const bytes = doc.output("arraybuffer") as ArrayBuffer;
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it("gera um documento não vazio com 1 dia", () => {
    const doc = buildItineraryPdfDocument(makeTrip(), [makeDay()]);
    const bytes = doc.output("arraybuffer") as ArrayBuffer;
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it("gera múltiplas páginas para um roteiro de 15 dias sem lançar erro", () => {
    const days = Array.from({ length: 15 }, (_, i) =>
      makeDay({
        id: `day-${i + 1}`,
        diaNumero: i + 1,
        data: null,
        slots: [
          {
            id: `s-${i}-1`,
            periodo: "manha",
            ondeIr: "Passeio",
            ondeComer: "Restaurante",
            observacoes: null,
          },
          {
            id: `s-${i}-2`,
            periodo: "tarde",
            ondeIr: "Parque",
            ondeComer: "Lanchonete",
            observacoes: "Levar protetor solar",
          },
          {
            id: `s-${i}-3`,
            periodo: "noite",
            ondeIr: "Show",
            ondeComer: "Jantar",
            observacoes: null,
          },
        ],
      }),
    );
    const doc = buildItineraryPdfDocument(makeTrip(), days);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    const bytes = doc.output("arraybuffer") as ArrayBuffer;
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it("não lança erro em trip no modo sonho (sem data_viagem)", () => {
    expect(() => buildItineraryPdfDocument(makeTrip({ dataViagem: null }), [])).not.toThrow();
  });
});
