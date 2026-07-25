import { describe, expect, it } from "vitest";
import {
  aiMsgLimit,
  canCreateAnotherTrip,
  canInviteMember,
  isAiQuotaExhausted,
  memberLimit,
  PAYWALL_TRIGGERS,
  PAYWALL_COPY,
  PREMIUM_PRICE_BRL_CENTS,
  resolveEntitlement,
} from "./entitlements";

const NOW = "2026-07-25T12:00:00.000Z";

describe("resolveEntitlement", () => {
  it("sem linha (nunca ativado) resolve para free", () => {
    expect(resolveEntitlement(null, NOW)).toEqual({ tier: "free", origem: null, isPremium: false });
  });

  it("linha free resolve para free, preservando origem se houver", () => {
    expect(resolveEntitlement({ plano: "free", origem: "manual", expiresAt: null }, NOW)).toEqual({
      tier: "free",
      origem: "manual",
      isPremium: false,
    });
  });

  it("premium sem expires_at resolve para premium", () => {
    expect(
      resolveEntitlement({ plano: "premium", origem: "pacote_visto", expiresAt: null }, NOW),
    ).toEqual({ tier: "premium", origem: "pacote_visto", isPremium: true });
  });

  it("premium com expires_at no futuro resolve para premium", () => {
    expect(
      resolveEntitlement(
        { plano: "premium", origem: "stripe", expiresAt: "2026-12-31T00:00:00.000Z" },
        NOW,
      ),
    ).toEqual({ tier: "premium", origem: "stripe", isPremium: true });
  });

  it("premium com expires_at vencido rebaixa para free (mesmo com plano='premium' gravado)", () => {
    expect(
      resolveEntitlement(
        { plano: "premium", origem: "stripe", expiresAt: "2026-01-01T00:00:00.000Z" },
        NOW,
      ),
    ).toEqual({ tier: "free", origem: "stripe", isPremium: false });
  });

  it("premium com expires_at igual ao momento atual conta como vencido", () => {
    expect(resolveEntitlement({ plano: "premium", origem: "manual", expiresAt: NOW }, NOW)).toEqual(
      { tier: "free", origem: "manual", isPremium: false },
    );
  });
});

describe("canCreateAnotherTrip (gatilho: criar 2ª viagem)", () => {
  it("free sem nenhuma viagem pode criar a 1ª", () => {
    expect(canCreateAnotherTrip("free", 0)).toBe(true);
  });

  it("free com 1 viagem não pode criar a 2ª", () => {
    expect(canCreateAnotherTrip("free", 1)).toBe(false);
  });

  it("premium sempre pode criar, independente da contagem", () => {
    expect(canCreateAnotherTrip("premium", 0)).toBe(true);
    expect(canCreateAnotherTrip("premium", 9)).toBe(true);
  });
});

describe("canInviteMember (gatilho: convidar membro)", () => {
  it("free já no limite (owner sozinho) não pode convidar", () => {
    expect(memberLimit("free")).toBe(1);
    expect(canInviteMember("free", 1)).toBe(false);
  });

  it("premium abaixo de 5 membros pode convidar", () => {
    expect(memberLimit("premium")).toBe(5);
    expect(canInviteMember("premium", 4)).toBe(true);
  });

  it("premium no limite de 5 não pode convidar mais", () => {
    expect(canInviteMember("premium", 5)).toBe(false);
  });
});

describe("cota de IA (gatilho: esgotar cota de IA)", () => {
  it("free tem limite de 10 msgs/mês", () => {
    expect(aiMsgLimit("free")).toBe(10);
    expect(isAiQuotaExhausted("free", 9)).toBe(false);
    expect(isAiQuotaExhausted("free", 10)).toBe(true);
  });

  it("premium tem limite de 100 msgs/mês", () => {
    expect(aiMsgLimit("premium")).toBe(100);
    expect(isAiQuotaExhausted("premium", 99)).toBe(false);
    expect(isAiQuotaExhausted("premium", 100)).toBe(true);
  });
});

describe("PAYWALL_COPY", () => {
  it("tem copy PT-BR não vazia para os 6 gatilhos, sem nenhum a mais ou a menos", () => {
    expect(PAYWALL_TRIGGERS).toHaveLength(6);
    for (const trigger of PAYWALL_TRIGGERS) {
      const copy = PAYWALL_COPY[trigger];
      expect(copy).toBeDefined();
      expect(copy.titulo.trim().length).toBeGreaterThan(0);
      expect(copy.descricao.trim().length).toBeGreaterThan(0);
    }
    expect(Object.keys(PAYWALL_COPY).sort()).toEqual([...PAYWALL_TRIGGERS].sort());
  });
});

describe("PREMIUM_PRICE_BRL_CENTS (VJT-012)", () => {
  it("é o preço de lançamento (R$ 67), em centavos", () => {
    expect(PREMIUM_PRICE_BRL_CENTS).toBe(6700);
  });
});
