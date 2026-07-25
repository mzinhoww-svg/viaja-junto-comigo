// @vitest-environment jsdom
/**
 * Teste de regressão (VJT-017) para a decisão de anonimização em vez de
 * cascade em `savings_entries.created_by`: quando um membro não-owner
 * exclui a própria conta, a FK vira `ON DELETE SET NULL` (não apaga a
 * linha) — o valor do registro precisa continuar contando no acumulado da
 * trip, já que `calcularAcumulado` (trip-math.ts) soma os registros de
 * TODOS os membros, sem filtrar por autor. Este teste simula exatamente
 * esse estado pós-exclusão (uma linha com `created_by: null` ao lado de uma
 * com autor normal) e confirma que `useTripDashboard` soma as duas.
 */
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useTripDashboard } from "./useTripDashboard";

type FakeRow = Record<string, unknown>;

const { supabaseMock } = vi.hoisted(() => {
  const db = {
    trip: {
      id: "trip-1",
      nome: "Viagem Compartilhada",
      destino_pais: "Portugal",
      destino_cidade: null as string | null,
      data_viagem: "2027-01-01",
      cambio_manual: null as number | null,
    },
    // Um membro (não-owner) registrou 30000 e depois excluiu a conta —
    // created_by virou NULL via ON DELETE SET NULL, a linha permanece. O
    // owner registrou 20000 e continua com a conta ativa.
    savings: [
      { valor_brl_cents: 30_000, created_by: null },
      { valor_brl_cents: 20_000, created_by: "owner-1" },
    ] as FakeRow[],
  };

  function builder(tabela: string) {
    function executar() {
      if (tabela === "trips") return { data: { ...db.trip }, error: null };
      if (tabela === "budget_items") return { data: [], error: null };
      if (tabela === "savings_entries") return { data: db.savings, error: null };
      if (tabela === "checklists") return { data: [], error: null };
      return { data: [], error: null };
    }

    const chain = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      single: () => Promise.resolve(executar()),
      then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve(executar()).then(onFulfilled, onRejected),
    };
    return chain;
  }

  return { supabaseMock: { from: (tabela: string) => builder(tabela) } };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

function criarWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

describe("useTripDashboard — savings_entries com created_by anonimizado (VJT-017)", () => {
  it("o valor de um registro com created_by:null continua somado no acumulado da trip", async () => {
    const Wrapper = criarWrapper();
    const { result } = renderHook(() => useTripDashboard("trip-1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // 30000 (autor removido) + 20000 (owner) — a exclusão de conta do
    // membro não tirou o valor dele do total coletivo, só a atribuição.
    expect(result.current.data?.tripMath.acumuladoBrlCents).toBe(50_000);
  });
});
