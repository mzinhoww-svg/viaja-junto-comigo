// @vitest-environment jsdom
/**
 * Teste de useLgpdConsent/useAcceptLgpdConsent (VJT-017) — sem linha ainda
 * = não consentiu; aceitar grava a linha e a leitura passa a refletir sem
 * reload (mesmo padrão de invalidação de useEntitlement.ts).
 */
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAcceptLgpdConsent, useLgpdConsent } from "./useLgpdConsent";

const USER_ID = "user-1";

const { resetDb, supabaseMock, getInsertCalls } = vi.hoisted(() => {
  let consented = false;
  const insertCalls: unknown[] = [];

  function resetDb() {
    consented = false;
    insertCalls.length = 0;
  }

  function getInsertCalls() {
    return insertCalls;
  }

  function builder() {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: () =>
        Promise.resolve({ data: consented ? { user_id: USER_ID } : null, error: null }),
      insert: (payload: unknown) => {
        insertCalls.push(payload);
        consented = true;
        return Promise.resolve({ data: null, error: null });
      },
    };
    return chain;
  }

  const supabaseMock = {
    from: (_tabela: string) => builder(),
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: USER_ID } }, error: null }),
    },
  };

  return { resetDb, supabaseMock, getInsertCalls };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

function criarWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

beforeEach(() => resetDb());

describe("useLgpdConsent", () => {
  it("sem linha gravada: retorna false", async () => {
    const Wrapper = criarWrapper();
    const { result } = renderHook(() => useLgpdConsent(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBe(false);
  });

  it("aceitar grava a linha e a leitura passa a true sem reload", async () => {
    const Wrapper = criarWrapper();
    const { result: read } = renderHook(() => useLgpdConsent(), { wrapper: Wrapper });
    await waitFor(() => expect(read.current.data).toBe(false));

    const { result: accept } = renderHook(() => useAcceptLgpdConsent(), { wrapper: Wrapper });
    accept.current.mutate();

    await waitFor(() => expect(accept.current.isSuccess).toBe(true));
    expect(getInsertCalls()).toEqual([{ user_id: USER_ID, versao_termos: "v1" }]);
    await waitFor(() => expect(read.current.data).toBe(true));
  });
});
