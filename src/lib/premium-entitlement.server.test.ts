/**
 * Testes de `premium-entitlement.server.ts` (VJT-012) — ativação do plano
 * Premium a partir do webhook do Stripe. Cobre os cenários pedidos para
 * este ticket: sessão completada válida ativa o premium; evento duplicado
 * (mesmo `stripe_payment_id`) não reescreve/duplica; pagamento de um
 * usuário que já era premium por outra origem é aplicado sem duplicar a
 * linha (chave primária é `user_id`).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = { plano: string; origem: string | null; stripe_payment_id: string | null };

const { resetDb, seedEntitlement, getRow, upsertCalls, supabaseJsMock } = vi.hoisted(() => {
  let db = new Map<string, Row>();
  let upsertCalls: unknown[] = [];

  function resetDb() {
    db = new Map();
    upsertCalls = [];
  }

  function seedEntitlement(userId: string, row: Row) {
    db.set(userId, row);
  }

  function getRow(userId: string): Row | undefined {
    return db.get(userId);
  }

  const fakeClient = {
    from: (table: string) => {
      if (table !== "entitlements") throw new Error(`unexpected table: ${table}`);
      return {
        select: () => ({
          eq: (_col: string, userId: string) => ({
            maybeSingle: () => {
              const row = db.get(userId);
              return Promise.resolve({
                data: row ? { stripe_payment_id: row.stripe_payment_id } : null,
                error: null,
              });
            },
          }),
        }),
        upsert: (values: {
          user_id: string;
          plano: string;
          origem: string;
          stripe_payment_id: string;
        }) => {
          upsertCalls.push(values);
          db.set(values.user_id, {
            plano: values.plano,
            origem: values.origem,
            stripe_payment_id: values.stripe_payment_id,
          });
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  const supabaseJsMock = { createClient: () => fakeClient };

  return {
    resetDb,
    seedEntitlement,
    getRow,
    upsertCalls: () => upsertCalls,
    supabaseJsMock,
  };
});

vi.mock("@supabase/supabase-js", () => supabaseJsMock);

beforeEach(() => {
  resetDb();
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
});

describe("readPremiumUserId", () => {
  it("aceita um user_id em formato uuid", async () => {
    const { readPremiumUserId } = await import("./premium-entitlement.server");
    expect(readPremiumUserId({ user_id: "11111111-1111-1111-1111-111111111111" })).toBe(
      "11111111-1111-1111-1111-111111111111",
    );
  });

  it("rejeita metadata sem user_id ou com formato inválido", async () => {
    const { readPremiumUserId } = await import("./premium-entitlement.server");
    expect(readPremiumUserId(null)).toBeNull();
    expect(readPremiumUserId({})).toBeNull();
    expect(readPremiumUserId({ user_id: "not-a-uuid" })).toBeNull();
    expect(readPremiumUserId({ user_id: 123 })).toBeNull();
  });
});

describe("activatePremiumEntitlement", () => {
  const userId = "11111111-1111-1111-1111-111111111111";

  it("sessão completada válida: ativa premium/stripe para quem nunca teve entitlement", async () => {
    const { activatePremiumEntitlement } = await import("./premium-entitlement.server");
    const result = await activatePremiumEntitlement(userId, "pi_123");

    expect(result).toEqual({ activated: true });
    expect(getRow(userId)).toEqual({
      plano: "premium",
      origem: "stripe",
      stripe_payment_id: "pi_123",
    });
  });

  it("evento duplicado: o mesmo stripe_payment_id não reescreve a linha", async () => {
    const { activatePremiumEntitlement } = await import("./premium-entitlement.server");

    const first = await activatePremiumEntitlement(userId, "pi_123");
    const second = await activatePremiumEntitlement(userId, "pi_123");

    expect(first).toEqual({ activated: true });
    expect(second).toEqual({ activated: false });
    expect(upsertCalls()).toHaveLength(1);
  });

  it("pagamento de usuário já premium (outra origem): aplica sem duplicar a linha", async () => {
    seedEntitlement(userId, { plano: "premium", origem: "manual", stripe_payment_id: null });

    const { activatePremiumEntitlement } = await import("./premium-entitlement.server");
    const result = await activatePremiumEntitlement(userId, "pi_456");

    expect(result).toEqual({ activated: true });
    expect(getRow(userId)).toEqual({
      plano: "premium",
      origem: "stripe",
      stripe_payment_id: "pi_456",
    });
  });
});
