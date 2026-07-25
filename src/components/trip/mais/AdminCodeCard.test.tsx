// @vitest-environment jsdom
/**
 * Teste de AdminCodeCard (VJT-011c) — o card só existe para quem ainda não é
 * Premium; "Usar código" revela o campo; Ativar manda o código digitado; os
 * callbacks de sucesso/erro viram toast (incluindo o caso "já era Premium").
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminCodeCard } from "./AdminCodeCard";

const { entitlementMock, redeemMock, mutateMock, toastMock } = vi.hoisted(() => ({
  entitlementMock: vi.fn(),
  redeemMock: vi.fn(),
  mutateMock: vi.fn(),
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/hooks/useEntitlement", () => ({ useEntitlement: entitlementMock }));
vi.mock("@/hooks/useRedeemAdminCode", () => ({ useRedeemAdminCode: redeemMock }));
vi.mock("sonner", () => ({ toast: toastMock }));

function abrirCampo() {
  render(<AdminCodeCard />);
  fireEvent.click(screen.getByRole("button", { name: "Usar código" }));
  return screen.getByLabelText("Código de acesso");
}

beforeEach(() => {
  entitlementMock.mockReturnValue({
    tier: "free",
    origem: null,
    isPremium: false,
    isLoading: false,
  });
  redeemMock.mockReturnValue({ mutate: mutateMock, isPending: false });
});

afterEach(() => {
  cleanup();
  mutateMock.mockClear();
  toastMock.success.mockClear();
  toastMock.error.mockClear();
});

describe("AdminCodeCard", () => {
  it("não renderiza nada para quem já é Premium", () => {
    entitlementMock.mockReturnValue({
      tier: "premium",
      origem: "stripe",
      isPremium: true,
      isLoading: false,
    });
    const { container } = render(<AdminCodeCard />);
    expect(container.innerHTML).toBe("");
  });

  it("não renderiza enquanto o plano ainda está carregando", () => {
    entitlementMock.mockReturnValue({
      tier: "free",
      origem: null,
      isPremium: false,
      isLoading: true,
    });
    const { container } = render(<AdminCodeCard />);
    expect(container.innerHTML).toBe("");
  });

  it("Ativar fica desabilitado até digitar algo", () => {
    const input = abrirCampo();
    const ativar = screen.getByRole("button", { name: "Ativar" });
    expect(ativar).toHaveProperty("disabled", true);

    fireEvent.change(input, { target: { value: "   " } });
    expect(ativar).toHaveProperty("disabled", true);

    fireEvent.change(input, { target: { value: "VJT-AAAA-BBBB-CCCC" } });
    expect(ativar).toHaveProperty("disabled", false);
  });

  it("envia o código digitado e avisa que ativou", () => {
    const input = abrirCampo();
    fireEvent.change(input, { target: { value: " vjt-aaaa-bbbb-cccc " } });
    fireEvent.click(screen.getByRole("button", { name: "Ativar" }));

    expect(mutateMock).toHaveBeenCalledTimes(1);
    const [codigo, options] = mutateMock.mock.calls[0];
    expect(codigo).toBe("vjt-aaaa-bbbb-cccc");

    options.onSuccess({ ok: true, already: false });
    expect(toastMock.success).toHaveBeenCalledWith("Premium ativado!");
  });

  it("Enter no campo dispara a ativação", () => {
    const input = abrirCampo();
    fireEvent.change(input, { target: { value: "VJT-AAAA-BBBB-CCCC" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mutateMock).toHaveBeenCalledTimes(1);
  });

  it("plano já ativo: mensagem específica em vez de 'Premium ativado'", () => {
    const input = abrirCampo();
    fireEvent.change(input, { target: { value: "VJT-AAAA-BBBB-CCCC" } });
    fireEvent.click(screen.getByRole("button", { name: "Ativar" }));

    mutateMock.mock.calls[0][1].onSuccess({ ok: true, already: true });
    expect(toastMock.success).toHaveBeenCalledWith("Seu plano Premium já estava ativo.");
  });

  it("erro do servidor vira toast com a mensagem recebida", () => {
    const input = abrirCampo();
    fireEvent.change(input, { target: { value: "VJT-ERRADO-ERRADO" } });
    fireEvent.click(screen.getByRole("button", { name: "Ativar" }));

    mutateMock.mock.calls[0][1].onError(new Error("Código inválido."));
    expect(toastMock.error).toHaveBeenCalledWith("Código inválido.");
    expect(toastMock.success).not.toHaveBeenCalled();
  });
});
