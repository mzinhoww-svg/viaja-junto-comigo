// @vitest-environment jsdom
/**
 * Teste de DeleteAccountCard (VJT-017) — botão abre o diálogo; confirmar
 * fica desabilitado até digitar "EXCLUIR"; confirmar chama a mutation;
 * sucesso navega para o login (sessão já foi encerrada por useDeleteAccount).
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeleteAccountCard } from "./DeleteAccountCard";

const { useDeleteAccountMock, mutateMock, navigateMock } = vi.hoisted(() => ({
  useDeleteAccountMock: vi.fn(),
  mutateMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock("@/hooks/useDeleteAccount", () => ({ useDeleteAccount: useDeleteAccountMock }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigateMock }));

afterEach(() => {
  cleanup();
  mutateMock.mockClear();
  navigateMock.mockClear();
});

describe("DeleteAccountCard", () => {
  it("abre o diálogo de confirmação ao clicar em 'Excluir minha conta'", () => {
    useDeleteAccountMock.mockReturnValue({ mutate: mutateMock, isPending: false });
    render(<DeleteAccountCard />);

    fireEvent.click(screen.getByRole("button", { name: /excluir minha conta/i }));
    expect(screen.getByText(/excluir sua conta\?/i)).toBeTruthy();
  });

  it("botão de confirmação fica desabilitado até digitar EXCLUIR", () => {
    useDeleteAccountMock.mockReturnValue({ mutate: mutateMock, isPending: false });
    render(<DeleteAccountCard />);
    fireEvent.click(screen.getByRole("button", { name: /excluir minha conta/i }));

    const confirmar = screen.getByRole("button", { name: /excluir permanentemente/i });
    expect(confirmar).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByPlaceholderText("EXCLUIR"), { target: { value: "excluir" } });
    expect(confirmar).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByPlaceholderText("EXCLUIR"), { target: { value: "EXCLUIR" } });
    expect(confirmar).toHaveProperty("disabled", false);
  });

  it("confirmar chama a mutation e navega ao suceder", () => {
    useDeleteAccountMock.mockReturnValue({ mutate: mutateMock, isPending: false });
    render(<DeleteAccountCard />);
    fireEvent.click(screen.getByRole("button", { name: /excluir minha conta/i }));
    fireEvent.change(screen.getByPlaceholderText("EXCLUIR"), { target: { value: "EXCLUIR" } });
    fireEvent.click(screen.getByRole("button", { name: /excluir permanentemente/i }));

    expect(mutateMock).toHaveBeenCalledTimes(1);
    const [, options] = mutateMock.mock.calls[0];
    options.onSuccess();
    expect(navigateMock).toHaveBeenCalledWith({ to: "/portal/login" });
  });
});
