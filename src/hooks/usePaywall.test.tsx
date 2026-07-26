// @vitest-environment jsdom
/**
 * Teste do modal de paywall único (VJT-011): a mesma instância de
 * `<PaywallModal />`, montada uma vez, precisa abrir com o copy certo para
 * cada um dos 6 gatilhos e fechar ao interagir com o Close do Dialog. Os
 * testes de cada gatilho individual (CreateTripGate, InviteMemberCard,
 * AiAssistantCard, ItineraryBoard, PremiumChecklistTeaserRow) reaproveitam
 * esse mesmo par Provider+Modal via o mesmo harness Provider+Modal.
 *
 * Sem `@testing-library/jest-dom` no projeto (não é dependência) — as
 * asserções usam só `screen.query*`/`screen.get*` + matchers nativos do
 * Vitest (`toBeNull`/`not.toBeNull`/`toHaveLength`), nunca `toBeInTheDocument`.
 */
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PaywallModal } from "@/components/trip/paywall/PaywallModal";
import { PaywallProvider, usePaywall } from "@/hooks/usePaywall";
import { PAYWALL_COPY, PAYWALL_TRIGGERS, type PaywallTrigger } from "@/lib/entitlements";

function TriggerButtons() {
  const { openPaywall } = usePaywall();
  return (
    <>
      {PAYWALL_TRIGGERS.map((trigger) => (
        <button key={trigger} onClick={() => openPaywall(trigger)}>
          abrir-{trigger}
        </button>
      ))}
    </>
  );
}

function renderHarness() {
  return render(
    <PaywallProvider>
      <TriggerButtons />
      <PaywallModal />
    </PaywallProvider>,
  );
}

afterEach(() => cleanup());

describe("PaywallModal (modal único)", () => {
  it("começa fechado", () => {
    renderHarness();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it.each(PAYWALL_TRIGGERS)(
    "abre com o copy correto para o gatilho '%s'",
    (trigger: PaywallTrigger) => {
      renderHarness();
      fireEvent.click(screen.getByText(`abrir-${trigger}`));

      expect(screen.queryByRole("dialog")).not.toBeNull();
      expect(screen.getByText(PAYWALL_COPY[trigger].titulo)).toBeTruthy();
      expect(screen.getByText(PAYWALL_COPY[trigger].descricao)).toBeTruthy();
    },
  );

  it("é a MESMA instância reaproveitada entre dois gatilhos diferentes (só o copy muda)", () => {
    renderHarness();
    fireEvent.click(screen.getByText("abrir-segunda_viagem"));
    expect(screen.getByText(PAYWALL_COPY.segunda_viagem.titulo)).toBeTruthy();

    fireEvent.click(screen.getByText("abrir-exportar_pdf"));
    expect(screen.getByText(PAYWALL_COPY.exportar_pdf.titulo)).toBeTruthy();
    expect(screen.queryByText(PAYWALL_COPY.segunda_viagem.titulo)).toBeNull();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("fecha ao clicar no botão de fechar do Dialog", () => {
    renderHarness();
    fireEvent.click(screen.getByText("abrir-cota_ia"));
    expect(screen.queryByRole("dialog")).not.toBeNull();

    fireEvent.click(screen.getByText("Fechar"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
