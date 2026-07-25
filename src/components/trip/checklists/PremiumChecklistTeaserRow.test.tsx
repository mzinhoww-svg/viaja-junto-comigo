// @vitest-environment jsdom
/**
 * Teste do gatilho de paywall "abrir item de checklist premium" (VJT-011).
 * `PremiumChecklistTeaserRow` é a linha travada renderizada por
 * `ChecklistsDashboard` só para usuários free quando existem templates
 * premium para o tipo — aqui testamos isoladamente que o clique abre o
 * modal único com o copy certo (a contagem em si já é coberta em
 * trip-checklists.test.ts via `contarTemplatesPremiumPorTipo`).
 */
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PremiumChecklistTeaserRow } from "./PremiumChecklistTeaserRow";
import { PaywallModal } from "@/components/trip/paywall/PaywallModal";
import { PaywallProvider, usePaywall } from "@/hooks/usePaywall";
import { PAYWALL_COPY } from "@/lib/entitlements";

function Harness({ count }: { count: number }) {
  const { openPaywall } = usePaywall();
  return (
    <PremiumChecklistTeaserRow count={count} onOpen={() => openPaywall("checklist_premium")} />
  );
}

function renderHarness(count: number) {
  return render(
    <PaywallProvider>
      <Harness count={count} />
      <PaywallModal />
    </PaywallProvider>,
  );
}

afterEach(() => cleanup());

describe("PremiumChecklistTeaserRow (gatilho: abrir item de checklist premium)", () => {
  it("exibe a contagem no singular/plural corretamente", () => {
    renderHarness(1);
    expect(screen.getByText("+1 item completo no Premium")).toBeTruthy();
  });

  it("clicar na linha travada abre o paywall único com o copy certo", async () => {
    renderHarness(12);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByText("+12 itens completos no Premium"));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeNull());
    expect(screen.getByText(PAYWALL_COPY.checklist_premium.titulo)).toBeTruthy();
  });
});
