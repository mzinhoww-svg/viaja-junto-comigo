// @vitest-environment jsdom
/**
 * Testes de `useTripVariables` + `usePremiumChecklistCounts` (VJT-011b): a
 * contagem do teaser premium passa a depender das variáveis reais da trip.
 * Cobrem o que o teste do módulo puro não alcança — o mapeamento
 * snake_case→camelCase das colunas de variável (`com_crianca`/`destino_pack`/
 * `min_duracao`): se uma delas ficar de fora do `select` ou do `map`,
 * `templateAplica` recebe `null` e o número volta a inflar em silêncio.
 *
 * Mock mínimo do client Supabase, mesmo padrão de useTripMembers.test.tsx.
 */
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePremiumChecklistCounts, useTripVariables } from "./useTripChecklists";
import type { TripVariables } from "@/lib/trip-templates";

type TemplateRow = {
  id: string;
  tipo: string;
  titulo: string;
  marco: number | null;
  prazo_dias_antes: number | null;
  tier: string;
  regiao: string | null;
  clima: string | null;
  min_duracao: number | null;
  com_crianca: boolean | null;
  destino_pack: string | null;
  ordem: number;
};

type TripRow = {
  id: string;
  destino_pais: string;
  destino_cidade: string | null;
  num_criancas: number;
};

const { resetDb, seedTemplates, seedTrips, selectedColumns, supabaseMock } = vi.hoisted(() => {
  const rowsPorTabela: Record<string, Record<string, unknown>[]> = {};
  const selectedColumns: string[] = [];

  function resetDb() {
    for (const tabela of Object.keys(rowsPorTabela)) delete rowsPorTabela[tabela];
    selectedColumns.length = 0;
  }
  function seedTemplates(rows: TemplateRow[]) {
    rowsPorTabela.checklist_templates = rows as unknown as Record<string, unknown>[];
  }
  function seedTrips(rows: TripRow[]) {
    rowsPorTabela.trips = rows as unknown as Record<string, unknown>[];
  }

  function builder(tabela: string) {
    const filters: Record<string, unknown> = {};
    const matching = () =>
      (rowsPorTabela[tabela] ?? []).filter((row) =>
        Object.entries(filters).every(([k, v]) => row[k] === v),
      );

    const chain = {
      select: (cols: string) => {
        selectedColumns.push(cols);
        return chain;
      },
      eq: (col: string, val: unknown) => {
        filters[col] = val;
        return chain;
      },
      single: async () => {
        const rows = matching();
        return rows.length === 1
          ? { data: rows[0], error: null }
          : { data: null, error: { message: "no single row" } };
      },
      then: (resolve: (v: unknown) => void) => {
        resolve({ data: matching(), error: null });
      },
    };
    return chain;
  }

  return {
    resetDb,
    seedTemplates,
    seedTrips,
    selectedColumns,
    supabaseMock: { from: (tabela: string) => builder(tabela) },
  };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function template(overrides: Partial<TemplateRow> = {}): TemplateRow {
  return {
    id: "tpl-1",
    tipo: "mala",
    titulo: "Item premium",
    marco: null,
    prazo_dias_antes: null,
    tier: "premium",
    regiao: null,
    clima: null,
    min_duracao: null,
    com_crianca: null,
    destino_pack: null,
    ordem: 0,
    ...overrides,
  };
}

function vars(overrides: Partial<TripVariables> = {}): TripVariables {
  return {
    regiao: null,
    clima: null,
    destinoPack: null,
    comCriancas: false,
    duracaoDias: null,
    ...overrides,
  };
}

describe("useTripVariables (VJT-011b)", () => {
  beforeEach(() => {
    resetDb();
  });

  it("reconstrói as variáveis do destino salvo na trip da rota", async () => {
    seedTrips([
      { id: "trip-1", destino_pais: "Chile", destino_cidade: "Santiago", num_criancas: 0 },
      { id: "trip-2", destino_pais: "Estados Unidos", destino_cidade: "Orlando", num_criancas: 2 },
    ]);

    const { result } = renderHook(() => useTripVariables("trip-2"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // A trip da rota, não a primeira do usuário — quem já teve premium tem várias.
    expect(result.current.data).toEqual({
      regiao: "america_norte",
      clima: "quente",
      destinoPack: "orlando",
      comCriancas: true,
      duracaoDias: null,
    });
  });

  it("sem tripId a query fica desabilitada", () => {
    const { result } = renderHook(() => useTripVariables(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("usePremiumChecklistCounts (VJT-011b)", () => {
  beforeEach(() => {
    resetDb();
  });

  it("filtra pelas variáveis da trip — pack de outro destino não entra na conta", async () => {
    seedTemplates([
      template({ id: "gen", titulo: "Genérico" }),
      template({ id: "orlando", destino_pack: "orlando", titulo: "Poncho" }),
      template({ id: "europa", destino_pack: "europa", titulo: "Adaptador UE" }),
    ]);

    const { result } = renderHook(
      () => usePremiumChecklistCounts(vars({ regiao: "europa", destinoPack: "europa" })),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ mala: 2 });
  });

  it("respeita com_crianca, que só existe na coluna mapeada", async () => {
    seedTemplates([
      template({ id: "gen", titulo: "Genérico" }),
      template({ id: "crianca", com_crianca: true, titulo: "Carrinho" }),
    ]);

    const semCriancas = renderHook(() => usePremiumChecklistCounts(vars()), { wrapper });
    await waitFor(() => expect(semCriancas.result.current.isSuccess).toBe(true));
    expect(semCriancas.result.current.data).toEqual({ mala: 1 });

    const comCriancas = renderHook(() => usePremiumChecklistCounts(vars({ comCriancas: true })), {
      wrapper,
    });
    await waitFor(() => expect(comCriancas.result.current.isSuccess).toBe(true));
    expect(comCriancas.result.current.data).toEqual({ mala: 2 });
  });

  it("pede ao banco as colunas de variável usadas por templateAplica", async () => {
    seedTemplates([template()]);
    const { result } = renderHook(() => usePremiumChecklistCounts(vars()), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const colunas = selectedColumns.join(",");
    for (const coluna of [
      "tipo",
      "tier",
      "regiao",
      "clima",
      "min_duracao",
      "com_crianca",
      "destino_pack",
    ]) {
      expect(colunas).toContain(coluna);
    }
  });

  it("sem variáveis (trip ainda carregando) a query fica desabilitada", () => {
    seedTemplates([template()]);
    const { result } = renderHook(() => usePremiumChecklistCounts(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });
});
