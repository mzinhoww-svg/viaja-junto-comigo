// @vitest-environment jsdom
/**
 * Testes do fluxo compartilhado de login com Google (VJT-011d).
 * Cobre portal (sem role check) e console (requer admin), incluindo o
 * cenário em que o Google autentica mas o profile não é admin.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { oauthMock, getUserMock, fromMock, signOutMock, toastMock, maybeSingleMock } = vi.hoisted(
  () => {
    const maybeSingle = vi.fn();
    return {
      oauthMock: vi.fn(),
      getUserMock: vi.fn(),
      signOutMock: vi.fn(),
      maybeSingleMock: maybeSingle,
      fromMock: vi.fn(() => ({
        select: () => ({
          eq: () => ({ maybeSingle }),
        }),
      })),
      toastMock: { success: vi.fn(), error: vi.fn() },
    };
  },
);

vi.mock("@/integrations/lovable", () => ({
  lovable: { auth: { signInWithOAuth: oauthMock } },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: getUserMock, signOut: signOutMock },
    from: fromMock,
  },
}));
vi.mock("sonner", () => ({ toast: toastMock }));

import { loginWithGoogle } from "./google-login";

beforeEach(() => {
  oauthMock.mockResolvedValue({ error: null, redirected: false });
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
  maybeSingleMock.mockResolvedValue({ data: { role: "admin" } });
  signOutMock.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("loginWithGoogle — portal (sem role)", () => {
  it("chama Google com o redirect_uri e navega para `next` no sucesso", async () => {
    const nav = vi.fn();
    await loginWithGoogle({
      redirectTo: "http://x/portal/login",
      next: "/portal",
      nav,
    });
    expect(oauthMock).toHaveBeenCalledWith("google", {
      redirect_uri: "http://x/portal/login",
    });
    expect(nav).toHaveBeenCalledWith({ to: "/portal" });
    expect(toastMock.success).toHaveBeenCalled();
    // sem requireAdmin não deve consultar profile nem deslogar
    expect(fromMock).not.toHaveBeenCalled();
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it("quando o provider redireciona (popup fechou), não navega nem mostra sucesso", async () => {
    oauthMock.mockResolvedValueOnce({ error: null, redirected: true });
    const nav = vi.fn();
    await loginWithGoogle({ redirectTo: "http://x", next: "/portal", nav });
    expect(nav).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it("erro do provider mostra toast e chama onDone", async () => {
    oauthMock.mockResolvedValueOnce({ error: new Error("boom"), redirected: false });
    const nav = vi.fn();
    const onDone = vi.fn();
    await loginWithGoogle({ redirectTo: "http://x", next: "/portal", nav, onDone });
    expect(toastMock.error).toHaveBeenCalledWith(
      "Não conseguimos entrar com o Google. Tente novamente.",
    );
    expect(nav).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
  });

  it("exceção inesperada não vaza — mostra toast genérico", async () => {
    oauthMock.mockRejectedValueOnce(new Error("network"));
    const nav = vi.fn();
    await loginWithGoogle({ redirectTo: "http://x", next: "/portal", nav });
    expect(toastMock.error).toHaveBeenCalled();
    expect(nav).not.toHaveBeenCalled();
  });
});

describe("loginWithGoogle — console (requireAdmin)", () => {
  it("profile admin: navega para `next`", async () => {
    const nav = vi.fn();
    await loginWithGoogle({
      redirectTo: "http://x/console/login",
      next: "/console",
      nav,
      requireAdmin: true,
    });
    expect(fromMock).toHaveBeenCalledWith("profiles");
    expect(signOutMock).not.toHaveBeenCalled();
    expect(nav).toHaveBeenCalledWith({ to: "/console" });
  });

  it("role != admin: desloga, mostra erro e NÃO navega", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: { role: "cliente" } });
    const nav = vi.fn();
    await loginWithGoogle({
      redirectTo: "http://x",
      next: "/console",
      nav,
      requireAdmin: true,
    });
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(toastMock.error).toHaveBeenCalledWith("Esta conta não tem acesso ao console.");
    expect(nav).not.toHaveBeenCalled();
  });

  it("profile inexistente também é tratado como sem acesso", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null });
    const nav = vi.fn();
    await loginWithGoogle({
      redirectTo: "http://x",
      next: "/console",
      nav,
      requireAdmin: true,
    });
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(nav).not.toHaveBeenCalled();
  });

  it("sem sessão após o OAuth: erro claro, sem navegar", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } });
    const nav = vi.fn();
    await loginWithGoogle({
      redirectTo: "http://x",
      next: "/console",
      nav,
      requireAdmin: true,
    });
    expect(toastMock.error).toHaveBeenCalledWith("Sessão não encontrada.");
    expect(nav).not.toHaveBeenCalled();
    expect(signOutMock).not.toHaveBeenCalled();
  });
});
