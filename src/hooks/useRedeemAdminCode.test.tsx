// @vitest-environment jsdom
/**
 * Teste de useRedeemAdminCode (VJT-011c) — sucesso invalida a query de
 * entitlement (para o Premium aparecer na hora, sem depender do Realtime);
 * resposta `ok: false` vira erro com a mensagem do servidor e não invalida.
 */
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRedeemAdminCode } from "./useRedeemAdminCode";

const { serverFnMock } = vi.hoisted(() => ({ serverFnMock: vi.fn() }));

vi.mock("@tanstack/react-start", () => ({ useServerFn: () => serverFnMock }));
vi.mock("@/lib/trip-admin-code.functions", () => ({ redeemAdminCode: vi.fn() }));

function criarWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { Wrapper, invalidate };
}

beforeEach(() => {
  serverFnMock.mockReset();
});

describe("useRedeemAdminCode", () => {
  it("sucesso: repassa o código ao server fn e invalida o entitlement", async () => {
    serverFnMock.mockResolvedValue({ ok: true, already: false });
    const { Wrapper, invalidate } = criarWrapper();
    const { result } = renderHook(() => useRedeemAdminCode(), { wrapper: Wrapper });

    result.current.mutate("VJT-AAAA-BBBB-CCCC");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(serverFnMock).toHaveBeenCalledWith({ data: { code: "VJT-AAAA-BBBB-CCCC" } });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["entitlement"] });
  });

  it("ok: false vira erro com a mensagem do servidor e não invalida nada", async () => {
    serverFnMock.mockResolvedValue({ ok: false, error: "Código inválido." });
    const { Wrapper, invalidate } = criarWrapper();
    const { result } = renderHook(() => useRedeemAdminCode(), { wrapper: Wrapper });

    result.current.mutate("VJT-ERRADO");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Código inválido.");
    expect(invalidate).not.toHaveBeenCalled();
  });
});
