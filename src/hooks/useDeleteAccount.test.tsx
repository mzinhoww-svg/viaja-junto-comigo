// @vitest-environment jsdom
/**
 * Teste de useDeleteAccount (VJT-017) — chama o server function
 * `deleteAccount` e encerra a sessão local em caso de sucesso; propaga o erro
 * (e NÃO desloga) quando o server function rejeita.
 *
 * Mocka `@/lib/delete-account.functions`, não `supabase.functions.invoke`: a
 * Edge Function foi substituída por server function porque nunca chegou a ser
 * deployada (404 em produção). O transporte novo resolve o payload direto e
 * rejeita em erro, então os casos de falha usam `mockRejectedValue`.
 */
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDeleteAccount } from "./useDeleteAccount";

const { deleteAccountMock, signOutMock } = vi.hoisted(() => ({
  deleteAccountMock: vi.fn(),
  signOutMock: vi.fn(() => Promise.resolve({ error: null })),
}));

vi.mock("@/lib/delete-account.functions", () => ({
  deleteAccount: deleteAccountMock,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
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
  deleteAccountMock.mockReset();
  signOutMock.mockClear();
});

describe("useDeleteAccount", () => {
  it("sucesso: chama o server function e desloga em seguida", async () => {
    deleteAccountMock.mockResolvedValue({ success: true });
    const Wrapper = criarWrapper();
    const { result } = renderHook(() => useDeleteAccount(), { wrapper: Wrapper });

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteAccountMock).toHaveBeenCalledTimes(1);
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });

  it("não passa user_id nenhum: quem é excluído sai do JWT, no servidor", async () => {
    // Propriedade de segurança do ticket: o client não escolhe a conta. Se um
    // dia alguém adicionar um parâmetro aqui, este teste quebra.
    deleteAccountMock.mockResolvedValue({ success: true });
    const Wrapper = criarWrapper();
    const { result } = renderHook(() => useDeleteAccount(), { wrapper: Wrapper });

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteAccountMock).toHaveBeenCalledWith();
  });

  it("erro do servidor: propaga o erro e não desloga", async () => {
    deleteAccountMock.mockRejectedValue(new Error("network_error"));
    const Wrapper = criarWrapper();
    const { result } = renderHook(() => useDeleteAccount(), { wrapper: Wrapper });

    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("network_error");
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it("erro de autorização: propaga e não desloga", async () => {
    deleteAccountMock.mockRejectedValue(new Error("Unauthorized: Invalid token"));
    const Wrapper = criarWrapper();
    const { result } = renderHook(() => useDeleteAccount(), { wrapper: Wrapper });

    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("Unauthorized: Invalid token");
    expect(signOutMock).not.toHaveBeenCalled();
  });
});
