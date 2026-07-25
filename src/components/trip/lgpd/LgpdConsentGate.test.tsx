// @vitest-environment jsdom
/**
 * Teste de LgpdConsentGate (VJT-017) — bloqueia o conteúdo até o
 * consentimento, exige o checkbox marcado antes de habilitar o botão, e
 * libera o conteúdo assim que `useLgpdConsent()` resolve para `true`.
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
    useLgpdConsentMock.mockReturnValue({ data: false, isLoading: false });
    useAcceptLgpdConsentMock.mockReturnValue({ mutate: mutateMock, isPending: false });

    render(
      <LgpdConsentGate>
        <div>conteudo-real</div>
      </LgpdConsentGate>,
    );

    expect(screen.queryByText("conteudo-real")).toBeNull();
    const botao = screen.getByRole("button", { name: /concordar e continuar/i });
    expect(botao).toHaveProperty("disabled", true);

    fireEvent.click(screen.getByRole("checkbox"));
    expect(botao).toHaveProperty("disabled", false);

    fireEvent.click(botao);
    expect(mutateMock).toHaveBeenCalled();
  });

  it("já consentiu: libera o conteúdo direto", () => {
    useLgpdConsentMock.mockReturnValue({ data: true, isLoading: false });
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
