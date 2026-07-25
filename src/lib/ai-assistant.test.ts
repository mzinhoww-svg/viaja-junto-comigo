import { describe, expect, it } from "vitest";
import {
  AI_MAX_MESSAGE_LENGTH,
  buildSystemPrompt,
  buildTripContextBlock,
  isAiEnabled,
  isMessageValid,
  isVisaQuestion,
  type TripAiContext,
} from "./ai-assistant";

const baseContext: TripAiContext = {
  nome: "Lua de mel",
  destinoPais: "Estados Unidos",
  destinoCidade: "Orlando",
  modo: "planejando",
  dataViagemFormatada: "10/12/2026",
  mesesRestantes: 5,
  numPessoas: 2,
};

describe("isMessageValid", () => {
  it("rejeita mensagem vazia ou só espaços", () => {
    expect(isMessageValid("")).toBe(false);
    expect(isMessageValid("   ")).toBe(false);
  });

  it("aceita mensagem normal", () => {
    expect(isMessageValid("Quais documentos preciso levar?")).toBe(true);
  });

  it("rejeita mensagem acima do limite", () => {
    expect(isMessageValid("a".repeat(AI_MAX_MESSAGE_LENGTH + 1))).toBe(false);
  });

  it("aceita mensagem exatamente no limite", () => {
    expect(isMessageValid("a".repeat(AI_MAX_MESSAGE_LENGTH))).toBe(true);
  });
});

describe("isAiEnabled (kill switch com fail-safe)", () => {
  it("secret ausente ou vazio mantém o assistente ligado (default documentado)", () => {
    expect(isAiEnabled(undefined)).toBe(true);
    expect(isAiEnabled(null)).toBe(true);
    expect(isAiEnabled("")).toBe(true);
    expect(isAiEnabled("   ")).toBe(true);
  });

  it.each(["false", "False", "FALSE", "0", "no", "NO", "off", "Off", "disabled", "nao", "não"])(
    "desliga com o valor falsy %j (case-insensitive)",
    (valor) => {
      expect(isAiEnabled(valor)).toBe(false);
    },
  );

  it.each(["true", "True", "1", "yes", "on", "ON", "enabled", "sim"])(
    "mantém ligado com o valor truthy %j",
    (valor) => {
      expect(isAiEnabled(valor)).toBe(true);
    },
  );

  it("ignora espaços em volta", () => {
    expect(isAiEnabled("  0  ")).toBe(false);
    expect(isAiEnabled("\tFalse\n")).toBe(false);
    expect(isAiEnabled(" true ")).toBe(true);
  });

  it("valor não reconhecido DESLIGA (fail-safe) — inclusive erros de digitação", () => {
    // O caso que motiva a regra: alguém tentando desligar às pressas durante
    // um incidente e errando a grafia não pode acabar deixando ligado.
    expect(isAiEnabled("flase")).toBe(false);
    expect(isAiEnabled("desligado")).toBe(false);
    expect(isAiEnabled("OFF!")).toBe(false);
    expect(isAiEnabled("banana")).toBe(false);
  });
});

describe("isVisaQuestion", () => {
  it("detecta perguntas óbvias sobre visto", () => {
    expect(isVisaQuestion("Preciso de visto para os EUA?")).toBe(true);
    expect(isVisaQuestion("Como funciona a entrevista de visto?")).toBe(true);
    expect(isVisaQuestion("O que é o DS-160?")).toBe(true);
    expect(isVisaQuestion("Preciso de VISTO para viajar")).toBe(true);
  });

  it("ignora acentuação/maiúsculas na detecção", () => {
    expect(isVisaQuestion("Preciso ir à embaixada?")).toBe(true);
  });

  it("não detecta perguntas de planejamento comuns", () => {
    expect(isVisaQuestion("Quantos dias de roteiro faltam?")).toBe(false);
    expect(isVisaQuestion("Qual a melhor época pra ir?")).toBe(false);
  });
});

describe("buildTripContextBlock", () => {
  it("inclui destino, status e contadores quando presentes", () => {
    const bloco = buildTripContextBlock(baseContext);
    expect(bloco).toContain("Orlando, Estados Unidos");
    expect(bloco).toContain("em planejamento");
    expect(bloco).toContain("10/12/2026");
    expect(bloco).toContain("Meses restantes até a viagem: 5");
    expect(bloco).toContain("Número de pessoas na viagem: 2");
  });

  it("modo sonho omite data e meses restantes", () => {
    const bloco = buildTripContextBlock({
      ...baseContext,
      modo: "sonho",
      dataViagemFormatada: null,
      mesesRestantes: null,
    });
    expect(bloco).toContain("modo sonho");
    expect(bloco).not.toContain("Data da viagem");
    expect(bloco).not.toContain("Meses restantes");
  });

  it("modo concluída reflete o status", () => {
    const bloco = buildTripContextBlock({ ...baseContext, modo: "concluida" });
    expect(bloco).toContain("modo concluída");
  });

  it("omite cidade quando destinoCidade é null", () => {
    const bloco = buildTripContextBlock({ ...baseContext, destinoCidade: null });
    expect(bloco).toContain("Destino: Estados Unidos");
    expect(bloco).not.toContain(", Estados Unidos");
  });
});

describe("buildSystemPrompt", () => {
  it("inclui o contexto da trip e as regras de escopo fechado", () => {
    const prompt = buildSystemPrompt(baseContext);
    expect(prompt).toContain("Orlando, Estados Unidos");
    expect(prompt).toContain("recuse educadamente");
    expect(prompt).toContain("WhatsApp");
    expect(prompt).toContain("português do Brasil");
  });
});
