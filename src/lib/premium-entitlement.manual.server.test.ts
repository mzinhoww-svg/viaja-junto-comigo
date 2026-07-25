/**
 * Testes de `activateManualPremiumEntitlement` (VJT-011c) — ativação do
 * Premium pelo código de acesso admin. Fake próprio (e não o de
 * `premium-entitlement.server.test.ts`) porque esta função lê
 * `plano/origem/expires_at`, colunas que o fake do VJT-012 não devolve.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = {
  plano: string;
  origem: string | null;
  expires_at: string | null;
  stripe_payment_id: string | null;
};

const { resetDb, seed, getRow, upsertCalls, supabaseJsMock } = vi.hoisted(() => {
  let db = new Map<string, Row>();
  let calls: Record<string, unknown>[] = [];

  const fakeClient = {
    from: (table: string) => {
      if (table !== "entitlements") throw new Error(`unexpected table: ${table}`);
      return {
        select: () => ({
          eq: (_col: string, userId: string) => ({
            maybeSingle: () => {
              const row = db.get(userId);
              return Promise.resolve({
                data: row
                  ? { plano: row.plano, origem: row.origem, expires_at: row.expires_at }
                  : null,
                error: null,
              });
            },
          }),
        }),
        upsert: (values: Record<string, unknown>) => {
          calls.push(values);
          const anterior = db.get(values.user_id as string);
          db.set(values.user_id as string, {
            plano: values.plano as string,
            origem: values.origem as string,
            expires_at: (values.expires_at ?? null) as string | null,
            // PostgREST só atualiza as colunas enviadas — o fake reproduz isso
            // para o `stripe_payment_id` não "sumir" no teste.
            stripe_payment_id: anterior?.stripe_payment_id ?? null,
          });
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  return {
    resetDb: () => {
      db = new Map();
      calls = [];
    },
    seed: (userId: string, row: Row) => db.set(userId, row),
    getRow: (userId: string) => db.get(userId),
    upsertCalls: () => calls,
    supabaseJsMock: { createClient: () => fakeClient },
  };
});

vi.mock("@supabase/supabase-js", () => supabaseJsMock);

const userId = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  resetDb();
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
});

describe("activateManualPremiumEntitlement", () => {
  it("usuário sem entitlement: ativa premium/manual sem expiração", async () => {
    const { activateManualPremiumEntitlement } = await import("./premium-entitlement.server");
    const result = await activateManualPremiumEntitlement(userId);

    expect(result).toEqual({ activated: true, already: false });
    expect(getRow(userId)).toMatchObject({
      plano: "premium",
      origem: "manual",
      expires_at: null,
    });
  });

  it("já premium via stripe: não reescreve nem troca a origem", async () => {
    seed(userId, {
      plano: "premium",
      origem: "stripe",
      expires_at: null,
      stripe_payment_id: "pi_123",
    });
    const { activateManualPremiumEntitlement } = await import("./premium-entitlement.server");
    const result = await activateManualPremiumEntitlement(userId);

    expect(result).toEqual({ activated: false, already: true });
    expect(upsertCalls()).toHaveLength(0);
    expect(getRow(userId)?.origem).toBe("stripe");
  });

  it("premium expirado: reativa e preserva o stripe_payment_id anterior", async () => {
    seed(userId, {
      plano: "premium",
      origem: "stripe",
      expires_at: "2020-01-01T00:00:00.000Z",
      stripe_payment_id: "pi_123",
    });
    const { activateManualPremiumEntitlement } = await import("./premium-entitlement.server");
    const result = await activateManualPremiumEntitlement(userId);

    expect(result).toEqual({ activated: true, already: false });
    expect(getRow(userId)).toEqual({
      plano: "premium",
      origem: "manual",
      expires_at: null,
      stripe_payment_id: "pi_123",
    });
    expect(upsertCalls()[0]).not.toHaveProperty("stripe_payment_id");
  });

  it("linha free existente: sobe para premium/manual", async () => {
    seed(userId, { plano: "free", origem: null, expires_at: null, stripe_payment_id: null });
    const { activateManualPremiumEntitlement } = await import("./premium-entitlement.server");

    expect(await activateManualPremiumEntitlement(userId)).toEqual({
      activated: true,
      already: false,
    });
    expect(getRow(userId)?.plano).toBe("premium");
  });

  it("resgate repetido é idempotente: o segundo já encontra premium ativo", async () => {
    const { activateManualPremiumEntitlement } = await import("./premium-entitlement.server");
    await activateManualPremiumEntitlement(userId);
    const segundo = await activateManualPremiumEntitlement(userId);

    expect(segundo).toEqual({ activated: false, already: true });
    expect(upsertCalls()).toHaveLength(1);
  });
});
