// @vitest-environment jsdom
/**
 * Teste de useEntitlement() — fonte única de leitura de plano no client
 * (VJT-011, VIAJALY-TRIP.md Seção 2). Cobre: default free sem linha,
 * premium ativo, premium expirado (rebaixa para free), e a invalidação em
 * tempo real disparada por `postgres_changes` em `entitlements` (simula a
 * ativação manual/admin do bônus Pro+/Vip+ "sem reload").
 */
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEntitlement } from "./useEntitlement";

type FakeRow = Record<string, unknown> | null;

const { resetDb, seedEntitlement, supabaseMock, emitEntitlementsChange } = vi.hoisted(() => {
  let entitlementRow: FakeRow = null;
  let changeHandler: (() => void) | null = null;

  function resetDb() {
    entitlementRow = null;
    changeHandler = null;
  }

  function seedEntitlement(row: FakeRow) {
    entitlementRow = row;
  }

  function emitEntitlementsChange() {
    if (!changeHandler) throw new Error("canal de entitlements ainda não inscrito");
    changeHandler();
  }

  function builder(tabela: string) {
    const filtros: Record<string, unknown> = {};
    const chain = {
      select: () => chain,
      eq: (coluna: string, valor: unknown) => {
        filtros[coluna] = valor;
        return chain;
      },
      maybeSingle: () => {
        if (tabela !== "entitlements") return Promise.resolve({ data: null, error: null });
        return Promise.resolve({ data: entitlementRow, error: null });
      },
    };
    return chain;
  }

  const supabaseMock = {
    from: (tabela: string) => builder(tabela),
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: "user-1" } }, error: null }),
    },
    channel: (_name: string) => {
      const channelApi = {
        on: (_event: string, _filter: unknown, handler: () => void) => {
          changeHandler = handler;
          return channelApi;
        },
        subscribe: () => channelApi,
      };
      return channelApi;
    },
    removeChannel: () => {},
  };

  return { resetDb, seedEntitlement, supabaseMock, emitEntitlementsChange };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

function criarWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, Wrapper };
}

beforeEach(() => {
  resetDb();
});

describe("useEntitlement", () => {
  it("sem linha em entitlements resolve para free", async () => {
    const { Wrapper } = criarWrapper();
    const { result } = renderHook(() => useEntitlement(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tier).toBe("free");
    expect(result.current.isPremium).toBe(false);
  });

  it("linha premium sem expiração resolve para premium", async () => {
    seedEntitlement({ plano: "premium", origem: "pacote_visto", expires_at: null });
    const { Wrapper } = criarWrapper();
    const { result } = renderHook(() => useEntitlement(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isPremium).toBe(true));
    expect(result.current.origem).toBe("pacote_visto");
  });

  it("linha premium com expires_at vencido rebaixa para free", async () => {
    seedEntitlement({ plano: "premium", origem: "stripe", expires_at: "2020-01-01T00:00:00.000Z" });
    const { Wrapper } = criarWrapper();
    const { result } = renderHook(() => useEntitlement(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tier).toBe("free");
  });

  it("ativação manual/admin (mudança na linha) invalida e refaz a leitura sem reload", async () => {
    const { Wrapper } = criarWrapper();
    const { result } = renderHook(() => useEntitlement(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isPremium).toBe(false);

    // Simula um admin ativando o bônus Pro+/Vip+ via SQL Editor enquanto o
    // client está aberto — nenhuma chamada manual de refetch aqui.
    seedEntitlement({ plano: "premium", origem: "manual", expires_at: null });
    await waitFor(() => emitEntitlementsChange());

    await waitFor(() => expect(result.current.isPremium).toBe(true));
    expect(result.current.origem).toBe("manual");
  });
});
