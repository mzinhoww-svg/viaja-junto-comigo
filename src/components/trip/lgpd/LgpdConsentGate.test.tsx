// @vitest-environment jsdom
/**
 * Teste de LgpdConsentGate (VJT-017, versionamento no VJT-017b) — bloqueia o
 * conteúdo até o consentimento da versão vigente, exige o checkbox marcado
 * antes de habilitar o botão, e libera assim que `useLgpdConsent()` diz que a
 * versão vigente foi aceita. Cobre também o caso central do VJT-017b: quem
 * aceitou uma versão ANTIGA é re-apresentado ao gate, com copy de
 * atualização de termos em vez da copy de primeiro acesso.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LgpdConsentGate } from "./LgpdConsentGate";

const { useLgpdConsentMock, useAcceptLgpdConsentMock, mutateMock } = vi.hoisted(() => ({
  useLgpdConsentMock: vi.fn(),
  useAcceptLgpdConsentMock: vi.fn(),
  mutateMock: vi.fn(),
}));

vi.mock("@/hooks/useLgpdConsent", () => ({
  useLgpdConsent: useLgpdConsentMock,
  useAcceptLgpdConsent: useAcceptLgpdConsentMock,
}));

afterEach(() => {
  cleanup();
  mutateMock.mockClear();
});

describe("LgpdConsentGate", () => {
  it("carregando: não mostra o conteúdo nem o gate ainda", () => {
    useLgpdConsentMock.mockReturnValue({ data: undefined, isLoading: true });
    useAcceptLgpdConsentMock.mockReturnValue({ mutate: mutateMock, isPending: false });

    render(
      <LgpdConsentGate>
        <div>conteudo-real</div>
      </LgpdConsentGate>,
    );

    expect(screen.queryByText("conteudo-real")).toBeNull();
    expect(screen.queryByRole("button", { name: /concordar e continuar/i })).toBeNull();
  });

  it("sem consentimento: bloqueia o conteúdo e desabilita o botão até marcar o checkbox", () => {
    useLgpdConsentMock.mockReturnValue({
      data: { consentido: false, versaoAceita: null },
      isLoading: false,
    });
    useAcceptLgpdConsentMock.mockReturnValue({ mutate: mutateMock, isPending: false });

    render(
      <LgpdConsentGate>
        <div>conteudo-real</div>
      </LgpdConsentGate>,
    );

    expect(screen.queryByText("conteudo-real")).toBeNull();
    expect(screen.getByText("Antes de continuar")).toBeTruthy();
    const botao = screen.getByRole("button", { name: /concordar e continuar/i });
    expect(botao).toHaveProperty("disabled", true);

    fireEvent.click(screen.getByRole("checkbox"));
    expect(botao).toHaveProperty("disabled", false);

    fireEvent.click(botao);
    expect(mutateMock).toHaveBeenCalled();
  });

  it("consentiu numa versão antiga: é re-apresentado ao gate, com copy de termos atualizados", () => {
    useLgpdConsentMock.mockReturnValue({
      data: { consentido: false, versaoAceita: "v1" },
      isLoading: false,
    });
    useAcceptLgpdConsentMock.mockReturnValue({ mutate: mutateMock, isPending: false });

    render(
      <LgpdConsentGate>
        <div>conteudo-real</div>
      </LgpdConsentGate>,
    );

    expect(screen.queryByText("conteudo-real")).toBeNull();
    expect(screen.getByText("Atualizamos nossos termos")).toBeTruthy();
    expect(screen.queryByText("Antes de continuar")).toBeNull();
    // o texto do aceite nomeia os subprocessadores de IA (VJT-017b)
    expect(screen.getByText(/OpenRouter/)).toBeTruthy();
    expect(screen.getByText(/DeepSeek/)).toBeTruthy();

    const botao = screen.getByRole("button", { name: /concordar e continuar/i });
    expect(botao).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(botao);
    expect(mutateMock).toHaveBeenCalled();
  });

  it("já consentiu na versão vigente: libera o conteúdo direto", () => {
    useLgpdConsentMock.mockReturnValue({
      data: { consentido: true, versaoAceita: "v2" },
      isLoading: false,
    });
    useAcceptLgpdConsentMock.mockReturnValue({ mutate: mutateMock, isPending: false });

    render(
      <LgpdConsentGate>
        <div>conteudo-real</div>
      </LgpdConsentGate>,
    );

    expect(screen.getByText("conteudo-real")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /concordar e continuar/i })).toBeNull();
  });
});
