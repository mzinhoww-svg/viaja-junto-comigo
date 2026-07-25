// @vitest-environment jsdom
/**
 * Teste de useDeleteAccount (VJT-017) — chama a Edge Function e encerra a
 * sessão local em caso de sucesso; propaga o erro (e NÃO desloga) se a
 * function retornar erro de transporte ou `success` != true.
 */
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDeleteAccount } from "./useDeleteAccount";

const { invokeMock, signOutMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  signOutMock: vi.fn(() => Promise.resolve({ error: null })),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: invokeMock },
    auth: { signOut: signOutMock },
  },
}));

function criarWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

beforeEach(() => {
  invokeMock.mockReset();
  signOutMock.mockClear();
});

describe("useDeleteAccount", () => {
  it("sucesso: chama a function e desloga em seguida", async () => {
    invokeMock.mockResolvedValue({ data: { success: true }, error: null });
    const Wrapper = criarWrapper();
    const { result } = renderHook(() => useDeleteAccount(), { wrapper: Wrapper });

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invokeMock).toHaveBeenCalledWith("delete-account", { method: "POST" });
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });

  it("erro de transporte: propaga o erro e não desloga", async () => {
    invokeMock.mockResolvedValue({ data: null, error: { message: "network_error" } });
    const Wrapper = criarWrapper();
    const { result } = renderHook(() => useDeleteAccount(), { wrapper: Wrapper });

    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("network_error");
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it("function retorna success:false: propaga o erro e não desloga", async () => {
    invokeMock.mockResolvedValue({ data: { error: "unauthorized" }, error: null });
    const Wrapper = criarWrapper();
    const { result } = renderHook(() => useDeleteAccount(), { wrapper: Wrapper });

    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("unauthorized");
    expect(signOutMock).not.toHaveBeenCalled();
  });
});
