// @vitest-environment jsdom
/**
 * Testes do TripLogin (VJT-011d) — a tela de entrada do Trip vendido
 * separado: Google como caminho principal, link por e-mail com cadastro
 * aberto, e o código da equipe escondido atrás de "Acesso da equipe".
 */
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TripLogin } from "./TripLogin";

const { oauthMock, otpMock, verifyOtpMock, adminLoginMock, toastMock } = vi.hoisted(() => ({
  /**
   * VJT-021b: o Google deixou de passar por `supabase.auth.signInWithOAuth` e
   * passa pelo helper gerenciado do Lovable Cloud, que já tem credenciais
   * provisionadas. O mock acompanhou a troca — este teste protege a garantia
   * ("o destino original sobrevive ao login"), não o mecanismo.
   */
  oauthMock: vi.fn(),
  otpMock: vi.fn(),
  verifyOtpMock: vi.fn(),
  adminLoginMock: vi.fn(),
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithOtp: otpMock,
      verifyOtp: verifyOtpMock,
    },
  },
}));
vi.mock("@/integrations/lovable", () => ({
  lovable: { auth: { signInWithOAuth: oauthMock } },
}));
vi.mock("sonner", () => ({ toast: toastMock }));
vi.mock("@/lib/admin-login.functions", () => ({ loginWithAdminCode: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => adminLoginMock }));

function Wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function renderLogin(next = "/trip") {
  return render(<TripLogin next={next} />, { wrapper: Wrapper });
}

beforeEach(() => {
  sessionStorage.clear();
  oauthMock.mockResolvedValue({ error: null, redirected: true });
  otpMock.mockResolvedValue({ error: null });
  verifyOtpMock.mockResolvedValue({ error: null });
  adminLoginMock.mockReset();
});

afterEach(() => {
  cleanup();
  oauthMock.mockReset();
  otpMock.mockReset();
  verifyOtpMock.mockReset();
  toastMock.success.mockClear();
  toastMock.error.mockClear();
});

describe("TripLogin", () => {
  it("Google guarda o `next` e usa redirect_uri same-origin, para voltar ao destino original", async () => {
    const destino = "/trip/aceitar-convite?token=abc";
    renderLogin(destino);
    fireEvent.click(screen.getByRole("button", { name: /continuar com google/i }));

    await waitFor(() => expect(oauthMock).toHaveBeenCalledTimes(1));
    expect(oauthMock.mock.calls[0][0]).toBe("google");
    // `redirect_uri` PRECISA ser a origem nua: apontá-lo direto para a rota
    // protegida (que é o que a versão anterior fazia com `redirectTo`) quebra
    // o fluxo do provider gerenciado. O destino real viaja no sessionStorage.
    expect(oauthMock.mock.calls[0][1]).toMatchObject({
      redirect_uri: window.location.origin,
    });
    expect(sessionStorage.getItem("viajaly:post-login-next")).toBe(destino);
  });

  it("link por e-mail cria a conta na hora (produto vendido separado)", async () => {
    renderLogin();
    fireEvent.change(screen.getByLabelText("Seu e-mail"), {
      target: { value: " Pessoa@Email.com " },
    });
    fireEvent.click(screen.getByRole("button", { name: /entrar com link por e-mail/i }));

    await waitFor(() => expect(otpMock).toHaveBeenCalledTimes(1));
    expect(otpMock.mock.calls[0][0]).toMatchObject({
      email: "pessoa@email.com",
      options: { shouldCreateUser: true },
    });
    expect(await screen.findByText(/link enviado para/i)).toBeTruthy();
  });

  it("e-mail inválido nem chega no Supabase", async () => {
    renderLogin();
    fireEvent.change(screen.getByLabelText("Seu e-mail"), { target: { value: "não-é-email" } });
    fireEvent.click(screen.getByRole("button", { name: /entrar com link por e-mail/i }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("Digite um e-mail válido."));
    expect(otpMock).not.toHaveBeenCalled();
  });

  it("o campo da equipe fica escondido até pedirem por ele", () => {
    renderLogin();
    expect(screen.queryByLabelText("Código da equipe")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /acesso da equipe/i }));
    expect(screen.getByLabelText("Código da equipe")).toBeTruthy();
  });

  it("código da equipe válido abre a sessão com o token devolvido pelo servidor", async () => {
    adminLoginMock.mockResolvedValue({
      ok: true,
      email: "equipe@viajaly.com",
      hashed_token: "hash-123",
    });
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: /acesso da equipe/i }));
    fireEvent.change(screen.getByLabelText("Código da equipe"), {
      target: { value: "VJT-AAAA-BBBB-CCCC" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(verifyOtpMock).toHaveBeenCalledTimes(1));
    expect(adminLoginMock).toHaveBeenCalledWith({ data: { code: "VJT-AAAA-BBBB-CCCC" } });
    expect(verifyOtpMock.mock.calls[0][0]).toMatchObject({
      email: "equipe@viajaly.com",
      token_hash: "hash-123",
      type: "magiclink",
    });
  });

  it("código recusado mostra a mensagem do servidor e não abre sessão", async () => {
    adminLoginMock.mockResolvedValue({ ok: false, error: "Código inválido." });
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: /acesso da equipe/i }));
    fireEvent.change(screen.getByLabelText("Código da equipe"), { target: { value: "ERRADO" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("Código inválido."));
    expect(verifyOtpMock).not.toHaveBeenCalled();
  });
});
