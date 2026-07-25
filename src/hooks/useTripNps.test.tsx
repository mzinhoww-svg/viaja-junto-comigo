// @vitest-environment jsdom
/**
 * Teste de useTripNpsResponse/useSubmitTripNps (VJT-017) — cobre a
 * aceitação "NPS é coletado": nenhuma resposta antes do envio, envio grava
 * a nota, reenvio faz upsert (não duplica) e a leitura reflete o valor mais
 * recente sem reload.
 */
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";
import { useSubmitTripNps, useTripNpsResponse } from "./useTripNps";

const TRIP_ID = "trip-1";
const USER_ID = "user-1";

const { resetDb, supabaseMock, getUpsertCalls } = vi.hoisted(() => {
  let row: { trip_id: string; user_id: string; nota: number; comentario: string | null } | null =
    null;
  const upsertCalls: unknown[] = [];

  function resetDb() {
    row = null;
    upsertCalls.length = 0;
  }

  function getUpsertCalls() {
    return upsertCalls;
  }

  function builder() {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: () => Promise.resolve({ data: row, error: null }),
      upsert: (payload: typeof row, _opts: unknown) => {
        upsertCalls.push(payload);
        row = payload;
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

  return { resetDb, supabaseMock, getUpsertCalls };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

function criarWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

beforeEach(() => {
  resetDb();
});

describe("useTripNpsResponse", () => {
  it("sem resposta gravada retorna null", async () => {
    const Wrapper = criarWrapper();
    const { result } = renderHook(() => useTripNpsResponse(TRIP_ID), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeNull();
  });
});

describe("useSubmitTripNps", () => {
  it("envia a nota e o comentário, e a leitura passa a refletir sem reload", async () => {
    const Wrapper = criarWrapper();
    const { result: read } = renderHook(() => useTripNpsResponse(TRIP_ID), { wrapper: Wrapper });
    await waitFor(() => expect(read.current.isLoading).toBe(false));
    expect(read.current.data).toBeNull();

    const { result: submit } = renderHook(() => useSubmitTripNps(TRIP_ID), { wrapper: Wrapper });
    submit.current.mutate({ nota: 9, comentario: "Adorei o planejamento!" });

    await waitFor(() => expect(submit.current.isSuccess).toBe(true));
    expect(getUpsertCalls()).toEqual([
      { trip_id: TRIP_ID, user_id: USER_ID, nota: 9, comentario: "Adorei o planejamento!" },
    ]);

    await waitFor(() =>
      expect(read.current.data).toEqual({ nota: 9, comentario: "Adorei o planejamento!" }),
    );
  });

  it("reenviar atualiza a mesma linha (upsert), sem duplicar", async () => {
    const Wrapper = criarWrapper();
    const { result: submit } = renderHook(() => useSubmitTripNps(TRIP_ID), { wrapper: Wrapper });

    submit.current.mutate({ nota: 3, comentario: null });
    await waitFor(() => expect(submit.current.isSuccess).toBe(true));

    submit.current.mutate({ nota: 10, comentario: "Mudei de ideia" });
    await waitFor(() => expect(getUpsertCalls().length).toBe(2));

    const { result: read } = renderHook(() => useTripNpsResponse(TRIP_ID), { wrapper: Wrapper });
    await waitFor(() =>
      expect(read.current.data).toEqual({ nota: 10, comentario: "Mudei de ideia" }),
    );
  });

  it("comentário vazio é normalizado para null", async () => {
    const Wrapper = criarWrapper();
    const { result: submit } = renderHook(() => useSubmitTripNps(TRIP_ID), { wrapper: Wrapper });

    submit.current.mutate({ nota: 6, comentario: "   " });
    await waitFor(() => expect(submit.current.isSuccess).toBe(true));
    expect(getUpsertCalls()).toEqual([
      { trip_id: TRIP_ID, user_id: USER_ID, nota: 6, comentario: null },
    ]);
  });

  it("rejeita nota fora do intervalo 0-10 sem chamar o backend", async () => {
    const Wrapper = criarWrapper();
    const { result: submit } = renderHook(() => useSubmitTripNps(TRIP_ID), { wrapper: Wrapper });

    submit.current.mutate({ nota: 11, comentario: null });
    await waitFor(() => expect(submit.current.isError).toBe(true));
    expect(getUpsertCalls()).toHaveLength(0);
  });
});
