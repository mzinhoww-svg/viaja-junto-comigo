import { describe, expect, it } from "vitest";
import type { ItineraryDay } from "@/lib/itinerary";
import type { TemplateBudgetCategory } from "@/lib/trip-template";
import {
  fatiasDoOrcamento,
  passosDaContagem,
  periodosPreenchidos,
  tituloDoDia,
  tracoDoAnel,
} from "@/lib/trip-template-view";

function categoria(
  id: string,
  nome: string,
  itens: { brl?: number | null; usd?: number | null }[],
): TemplateBudgetCategory {
  return {
    id,
    nome,
    cor: "#000000",
    ordem: 0,
    itens: itens.map((i, n) => ({
      id: `${id}-${n}`,
      nome: `item ${n}`,
      estimadoBrlCents: i.brl ?? null,
      estimadoDestinoCents: i.usd ?? null,
      pagoBrlCents: 0,
      pagoDestinoCents: 0,
    })),
  };
}

describe("fatiasDoOrcamento", () => {
  it("consolida moeda de destino pelo câmbio, como o total ao lado do donut", () => {
    const { fatias, totalBrlCents } = fatiasDoOrcamento(
      [categoria("a", "Passagens", [{ brl: 100_00 }]), categoria("b", "Hotel", [{ usd: 20_00 }])],
      5,
    );
    // 100,00 BRL + (20,00 USD × 5) = 200,00
    expect(totalBrlCents).toBe(200_00);
    expect(fatias.map((f) => f.nome)).toEqual(["Passagens", "Hotel"]);
    expect(fatias[0].fracao).toBeCloseTo(0.5);
  });

  it("ordena da maior para a menor", () => {
    const { fatias } = fatiasDoOrcamento(
      [
        categoria("a", "Pequena", [{ brl: 10_00 }]),
        categoria("b", "Grande", [{ brl: 90_00 }]),
        categoria("c", "Média", [{ brl: 50_00 }]),
      ],
      null,
    );
    expect(fatias.map((f) => f.nome)).toEqual(["Grande", "Média", "Pequena"]);
  });

  it("os offsets encadeiam sem buraco nem sobreposição", () => {
    const { fatias } = fatiasDoOrcamento(
      [
        categoria("a", "A", [{ brl: 50_00 }]),
        categoria("b", "B", [{ brl: 30_00 }]),
        categoria("c", "C", [{ brl: 20_00 }]),
      ],
      null,
    );
    expect(fatias[0].offset).toBeCloseTo(0);
    expect(fatias[1].offset).toBeCloseTo(fatias[0].dash);
    expect(fatias[2].offset).toBeCloseTo(fatias[0].dash + fatias[1].dash);
    const soma = fatias.reduce((s, f) => s + f.dash, 0);
    expect(soma).toBeCloseTo(1);
  });

  it("descarta categoria zerada em vez de desenhar fatia invisível", () => {
    const { fatias } = fatiasDoOrcamento(
      [categoria("a", "Cheia", [{ brl: 10_00 }]), categoria("b", "Vazia", [])],
      null,
    );
    expect(fatias.map((f) => f.nome)).toEqual(["Cheia"]);
  });

  it("orçamento inteiramente zerado não vira NaN (edge case da Seção 2)", () => {
    const { fatias, totalBrlCents } = fatiasDoOrcamento([categoria("a", "Nada", [])], null);
    expect(totalBrlCents).toBe(0);
    expect(fatias).toEqual([]);
  });

  it("item em moeda de destino sem câmbio não inventa valor", () => {
    const { totalBrlCents } = fatiasDoOrcamento([categoria("a", "Hotel", [{ usd: 20_00 }])], null);
    expect(totalBrlCents).toBe(0);
  });
});

describe("tracoDoAnel", () => {
  it("progresso zero deixa o anel vazio", () => {
    const t = tracoDoAnel(0, 10);
    expect(t.dashOffset).toBeCloseTo(t.circunferencia);
  });

  it("progresso total fecha o anel", () => {
    const t = tracoDoAnel(1, 10);
    expect(t.dashOffset).toBeCloseTo(0);
  });

  it("metade deixa metade do traço", () => {
    const t = tracoDoAnel(0.5, 10);
    expect(t.dashOffset).toBeCloseTo(t.circunferencia / 2);
  });

  it("acima de 100% não vira offset negativo (quem pagou mais que o estimado)", () => {
    const t = tracoDoAnel(1.8, 10);
    expect(t.dashOffset).toBe(0);
  });

  it("NaN vira anel vazio em vez de traço quebrado", () => {
    const t = tracoDoAnel(Number.NaN, 10);
    expect(t.dashOffset).toBeCloseTo(t.circunferencia);
  });
});

function dia(slots: Partial<Record<"manha" | "tarde" | "noite", string>>): ItineraryDay {
  return {
    id: "d1",
    diaNumero: 1,
    ordem: 0,
    data: null,
    slots: (Object.keys(slots) as ("manha" | "tarde" | "noite")[]).map((p) => ({
      id: `s-${p}`,
      periodo: p,
      ondeIr: slots[p] ?? null,
      ondeComer: null,
      observacoes: null,
    })),
  };
}

describe("tituloDoDia", () => {
  it("usa o destino da manhã quando existe", () => {
    expect(tituloDoDia(dia({ manha: "Magic Kingdom", tarde: "Disney Springs" }))).toBe(
      "Magic Kingdom",
    );
  });

  it("cai para o próximo período preenchido, na ordem do dia", () => {
    expect(tituloDoDia(dia({ tarde: "Outlet", noite: "Jantar" }))).toBe("Outlet");
  });

  it("dia sem destino nenhum não inventa título", () => {
    expect(tituloDoDia(dia({}))).toBeNull();
  });

  it("destino em branco não conta como título", () => {
    expect(tituloDoDia(dia({ manha: "   ", tarde: "Epcot" }))).toBe("Epcot");
  });
});

describe("periodosPreenchidos", () => {
  it("devolve em ordem cronológica, ignorando os vazios", () => {
    expect(periodosPreenchidos(dia({ noite: "Show", manha: "Parque" }))).toEqual([
      "manha",
      "noite",
    ]);
  });
});

describe("passosDaContagem", () => {
  it("termina exatamente no alvo", () => {
    const passos = passosDaContagem(40, 20);
    expect(passos.at(-1)).toBe(40);
  });

  it("é monotônica e começa perto de zero", () => {
    const passos = passosDaContagem(100, 15);
    expect(passos[0]).toBeLessThan(passos[1]);
    for (let i = 1; i < passos.length; i++) {
      expect(passos[i]).toBeGreaterThanOrEqual(passos[i - 1]);
    }
  });

  it("alvo zero não gera animação", () => {
    expect(passosDaContagem(0, 30)).toEqual([0]);
  });

  it("um quadro só entrega o valor final direto", () => {
    expect(passosDaContagem(7, 1)).toEqual([7]);
  });
});
