// @vitest-environment jsdom
/**
 * Teste de regressão (VJT-006b, VIAJALY-TRIP.md Seção 7) para a
 * cross-invalidation corrigida no VJT-006/PR #33: budget_items e
 * trips.cambio_manual alimentam três hooks independentes —
 * useTripBudget (Orçamento por Categoria), useTripSavings (Economia
 * Mensal, VJT-005) e useTripDashboard (Sua Jornada, VJT-004). Este teste
 * monta os três sob o mesmo QueryClient e confirma, via refetch
 * automático (nunca chamado manualmente), que mutações em useTripBudget
 * propagam para os outros dois. Se algum dia alguém remover uma das
 * invalidações de `invalidateFinanceiro` (useTripBudget.ts), este teste
 * quebra.
 */
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAddBudgetItem, useTripBudget, useUpdateCambioManual } from "./useTripBudget";
import { useTripSavings } from "./useTripSavings";
import { useTripDashboard } from "./useTripDashboard";

type FakeRow = Record<string, unknown>;

const { resetDb, seedDb, supabaseMock } = vi.hoisted(() => {
  function novoBanco() {
    return {
      trip: {
        id: "trip-1",
        nome: "Viagem de Teste",
        destino_pais: "Estados Unidos",
        destino_cidade: null as string | null,
        data_viagem: "2026-11-24",
        num_pessoas: 2,
        moeda_destino: null as string | null,
        cambio_manual: null as number | null,
      },
      categories: [
        {
          id: "cat-1",
          trip_id: "trip-1",
          nome: "Geral",
          cor: "#000000",
          ordem: 0,
          is_default: true,
        },
      ] as FakeRow[],
      budgetItems: [] as FakeRow[],
      savings: [] as FakeRow[],
      checklists: [] as FakeRow[],
    };
  }

  let db = novoBanco();

  function resetDb() {
    db = novoBanco();
  }

  function seedDb(patch: Partial<ReturnType<typeof novoBanco>>) {
    db = { ...db, ...patch };
  }

  function filtrar(filtros: Record<string, unknown>, linhas: FakeRow[]) {
    return linhas.filter((linha) => Object.entries(filtros).every(([k, v]) => linha[k] === v));
  }

  function builder(tabela: string) {
    let modo: "select" | "insert" | "update" = "select";
    let payload: FakeRow | FakeRow[] | null = null;
    const filtros: Record<string, unknown> = {};

    function executar() {
      if (tabela === "trips") {
        if (modo === "update") {
          Object.assign(db.trip, payload);
          return { data: null, error: null };
        }
        return { data: { ...db.trip }, error: null };
      }
      if (tabela === "budget_categories") {
        return { data: filtrar(filtros, db.categories), error: null };
      }
      if (tabela === "budget_items") {
        if (modo === "insert") {
          const linhas = Array.isArray(payload) ? payload : [payload as FakeRow];
          linhas.forEach((linha) => {
            db.budgetItems.push({
              id: `item-${db.budgetItems.length + 1}`,
              valor_estimado_brl_cents: null,
              valor_estimado_destino_cents: null,
              valor_pago_brl_cents: 0,
              valor_pago_destino_cents: 0,
              ...linha,
            });
          });
          return { data: null, error: null };
        }
        return { data: filtrar(filtros, db.budgetItems), error: null };
      }
      if (tabela === "savings_entries") return { data: db.savings, error: null };
      if (tabela === "checklists") return { data: db.checklists, error: null };
      return { data: [], error: null };
    }

    const chain = {
      select: () => chain,
      insert: (rows: FakeRow | FakeRow[]) => {
        modo = "insert";
        payload = rows;
        return chain;
      },
      update: (patch: FakeRow) => {
        modo = "update";
        payload = patch;
        return chain;
      },
      eq: (coluna: string, valor: unknown) => {
        filtros[coluna] = valor;
        return chain;
      },
      order: () => chain,
      single: () => Promise.resolve(executar()),
      then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve(executar()).then(onFulfilled, onRejected),
    };

    return chain;
  }

  return { resetDb, seedDb, supabaseMock: { from: (tabela: string) => builder(tabela) } };
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

describe("cross-invalidation do Financeiro (VJT-006b)", () => {
  it("adicionar um budget_item em useTripBudget propaga para useTripSavings e useTripDashboard", async () => {
    const { Wrapper } = criarWrapper();
    const tripId = "trip-1";

    const budget = renderHook(() => useTripBudget(tripId), { wrapper: Wrapper });
    const savings = renderHook(() => useTripSavings(tripId), { wrapper: Wrapper });
    const dashboard = renderHook(() => useTripDashboard(tripId), { wrapper: Wrapper });
    const addItem = renderHook(() => useAddBudgetItem(tripId), { wrapper: Wrapper });

    await waitFor(() => expect(budget.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(savings.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(dashboard.result.current.isSuccess).toBe(true));

    expect(savings.result.current.data?.tripMath.metaBrlCents).toBe(0);
    expect(dashboard.result.current.data?.tripMath.metaBrlCents).toBe(0);

    addItem.result.current.mutate({
      categoryId: "cat-1",
      nome: "Hotel",
      estimadoBrlCents: 120_000,
      estimadoDestinoCents: 0,
    });
    await waitFor(() => expect(addItem.result.current.isSuccess).toBe(true));

    // Nenhuma chamada manual de refetch/invalidate aqui — só a invalidação
    // automática disparada por useAddBudgetItem (invalidateFinanceiro).
    await waitFor(() => expect(savings.result.current.data?.tripMath.metaBrlCents).toBe(120_000));
    await waitFor(() => expect(dashboard.result.current.data?.tripMath.metaBrlCents).toBe(120_000));
  });

  it("alterar o câmbio manual em useTripBudget propaga e recalcula item em moeda destino nos outros hooks", async () => {
    seedDb({
      budgetItems: [
        {
          id: "item-x",
          trip_id: "trip-1",
          category_id: "cat-1",
          nome: "Ingresso do parque",
          valor_estimado_brl_cents: null,
          valor_estimado_destino_cents: 10_000,
          valor_pago_brl_cents: 0,
          valor_pago_destino_cents: 0,
        },
      ],
    });

    const { Wrapper } = criarWrapper();
    const tripId = "trip-1";

    const savings = renderHook(() => useTripSavings(tripId), { wrapper: Wrapper });
    const dashboard = renderHook(() => useTripDashboard(tripId), { wrapper: Wrapper });
    const updateCambio = renderHook(() => useUpdateCambioManual(tripId), { wrapper: Wrapper });

    await waitFor(() => expect(savings.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(dashboard.result.current.isSuccess).toBe(true));

    // Sem câmbio manual, o item só em moeda destino consolida como 0.
    expect(savings.result.current.data?.tripMath.metaBrlCents).toBe(0);
    expect(dashboard.result.current.data?.tripMath.metaBrlCents).toBe(0);

    updateCambio.result.current.mutate({ moedaDestino: "USD", cambioManual: 5 });
    await waitFor(() => expect(updateCambio.result.current.isSuccess).toBe(true));

    await waitFor(() => expect(savings.result.current.data?.tripMath.metaBrlCents).toBe(50_000));
    await waitFor(() => expect(dashboard.result.current.data?.tripMath.metaBrlCents).toBe(50_000));
  });
});
