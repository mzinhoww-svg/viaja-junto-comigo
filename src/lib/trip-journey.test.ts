import { describe, expect, it } from "vitest";
import {
  MARCOS_CONHECIDOS,
  calcularDiasRestantes,
  construirJourneySteps,
  type JourneyStepItem,
} from "./trip-journey";

const HOJE = new Date(2026, 0, 1); // 2026-01-01

describe("calcularDiasRestantes", () => {
  it("retorna null sem data de viagem (modo sonho)", () => {
    expect(calcularDiasRestantes(null, HOJE)).toBeNull();
  });

  it("retorna 0 quando a viagem é hoje", () => {
    expect(calcularDiasRestantes("2026-01-01", HOJE)).toBe(0);
  });

  it("retorna um número positivo para data futura", () => {
    expect(calcularDiasRestantes("2026-01-31", HOJE)).toBe(30);
  });

  it("retorna um número negativo para data no passado", () => {
    expect(calcularDiasRestantes("2025-12-22", HOJE)).toBe(-10);
  });

  it("aceita Date além de string", () => {
    expect(calcularDiasRestantes(new Date(2026, 0, 11), HOJE)).toBe(10);
  });
});

describe("construirJourneySteps", () => {
  const itensCompletos: JourneyStepItem[] = MARCOS_CONHECIDOS.flatMap((marco) => [
    { marco, done: false },
    { marco, done: false },
  ]);

  it("não gera step para marcos ausentes nos itens (ex.: mala/compras, marco null)", () => {
    const itens: JourneyStepItem[] = [
      { marco: null, done: false },
      { marco: null, done: true },
    ];
    expect(construirJourneySteps(itens, 40, "planejando")).toEqual([]);
  });

  it("ignora marcos que não fazem parte do catálogo conhecido", () => {
    const itens: JourneyStepItem[] = [{ marco: 45, done: false }];
    expect(construirJourneySteps(itens, 40, "planejando")).toEqual([]);
  });

  it("gera um step por marco presente, na ordem do mais distante ao mais próximo", () => {
    const steps = construirJourneySteps(itensCompletos, 100, "planejando");
    expect(steps.map((s) => s.marco)).toEqual([90, 60, 30, 15, 7]);
  });

  it("conta itensDone/itensTotal por marco", () => {
    const itens: JourneyStepItem[] = [
      { marco: 90, done: true },
      { marco: 90, done: false },
      { marco: 90, done: true },
    ];
    const [step] = construirJourneySteps(itens, 95, "planejando");
    expect(step.itensDone).toBe(2);
    expect(step.itensTotal).toBe(3);
  });

  it("marca 'concluido' quando todos os itens do marco estão feitos, mesmo fora da janela", () => {
    const itens: JourneyStepItem[] = [
      { marco: 90, done: true },
      { marco: 90, done: true },
    ];
    const [step] = construirJourneySteps(itens, 200, "planejando");
    expect(step.status).toBe("concluido");
  });

  it("modo sonho (sem data): status 'pendente' para itens não concluídos, sem marco atual", () => {
    const steps = construirJourneySteps(itensCompletos, null, "sonho");
    expect(steps.every((s) => s.status === "pendente")).toBe(true);
  });

  it("marco fora da janela ainda distante fica 'proximo'", () => {
    // dias restantes 200 > 90 (marco mais distante) => ainda não chegou a hora
    const [step90] = construirJourneySteps(itensCompletos, 200, "planejando");
    expect(step90.status).toBe("proximo");
  });

  it("marco cuja janela é a atual (dias_restantes <= marco e > próximo marco) fica 'atual'", () => {
    // janela do marco 60: dias_restantes <= 60 e > 30
    const steps = construirJourneySteps(itensCompletos, 45, "planejando");
    const step60 = steps.find((s) => s.marco === 60);
    expect(step60?.status).toBe("atual");
  });

  it("marco cuja janela já passou (dias_restantes <= próximo marco) e não concluído fica 'atrasado'", () => {
    // dias_restantes 20 já entrou na janela do marco 15 (<=15? não, 20>15 então marco 15 é atual);
    // o marco 30 já teve sua janela passada (20 <= 30, mas 20 <= próximo marco 15? não, 20>15).
    // Usamos dias_restantes = 10, que já passou a janela do marco 30 (próximo marco 15, 10<=15).
    const steps = construirJourneySteps(itensCompletos, 10, "planejando");
    const step30 = steps.find((s) => s.marco === 30);
    expect(step30?.status).toBe("atrasado");
  });

  it("último marco (7) sem próximo marco: janela vai até o dia da viagem", () => {
    const steps = construirJourneySteps(itensCompletos, 3, "planejando");
    const step7 = steps.find((s) => s.marco === 7);
    expect(step7?.status).toBe("atual");
  });

  it("modo concluída: itens não concluídos ficam 'atrasado', concluídos ficam 'concluido'", () => {
    const itens: JourneyStepItem[] = [
      { marco: 90, done: true },
      { marco: 90, done: true },
      { marco: 60, done: false },
      { marco: 60, done: true },
    ];
    const steps = construirJourneySteps(itens, -5, "concluida");
    expect(steps.find((s) => s.marco === 90)?.status).toBe("concluido");
    expect(steps.find((s) => s.marco === 60)?.status).toBe("atrasado");
  });
});
