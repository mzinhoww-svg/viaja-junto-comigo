// @vitest-environment jsdom
/**
 * Teste do gatilho de paywall "esgotar cota de IA" (VJT-011) e do
 * lançamento do chat real (VJT-014). Cobre free/premium na cota e fora dela,
 * e que dentro da cota o clique abre o chat (não o paywall).
 */
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiAssistantCard } from "./AiAssistantCard";
import { PaywallModal } from "@/components/trip/paywall/PaywallModal";
import { PaywallProvider } from "@/hooks/usePaywall";
import { PAYWALL_COPY } from "@/lib/entitlements";

const { useEntitlementMock, useAiUsageMock, useAiChatMock } = vi.hoisted(() => ({
  useEntitlementMock: vi.fn(),
  useAiUsageMock: vi.fn(),
  useAiChatMock: vi.fn(),
}));

vi.mock("@/hooks/useEntitlement", () => ({ useEntitlement: useEntitlementMock }));
vi.mock("@/hooks/useAiUsage", () => ({ useAiUsage: useAiUsageMock }));
vi.mock("@/hooks/useAiChat", () => ({ useAiChat: useAiChatMock }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

function renderCard() {
  useAiChatMock.mockReturnValue({ mutate: vi.fn(), isPending: false });
  return render(
    <PaywallProvider>
      <AiAssistantCard tripId="trip-1" />
      <PaywallModal />
    </PaywallProvider>,
  );
}

afterEach(() => cleanup());

describe("AiAssistantCard (gatilho: esgotar cota de IA + chat real)", () => {
  it("free com cota esgotada (10/10): clicar em 'Perguntar' abre o paywall, não o chat", async () => {
    useEntitlementMock.mockReturnValue({
      tier: "free",
      isPremium: false,
      origem: null,
      isLoading: false,
    });
    useAiUsageMock.mockReturnValue({ data: 10, isLoading: false });

    renderCard();
    expect(screen.getByText("10/10 mensagens este mês")).toBeTruthy();

    fireEvent.click(screen.getByText("Perguntar"));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeNull());
    expect(screen.getByText(PAYWALL_COPY.cota_ia.titulo)).toBeTruthy();
    expect(screen.queryByPlaceholderText("Pergunte sobre sua viagem...")).toBeNull();
  });

  it("free dentro da cota: clicar abre o chat (não o paywall)", async () => {
    useEntitlementMock.mockReturnValue({
      tier: "free",
      isPremium: false,
      origem: null,
      isLoading: false,
    });
    useAiUsageMock.mockReturnValue({ data: 3, isLoading: false });

    renderCard();
    fireEvent.click(screen.getByText("Perguntar"));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeNull());
    expect(screen.queryByText(PAYWALL_COPY.cota_ia.titulo)).toBeNull();
    expect(screen.getByPlaceholderText("Pergunte sobre sua viagem...")).toBeTruthy();
  });

  it("premium com 100 mensagens usadas: cota maior, abre paywall só ao esgotar as 100", async () => {
    useEntitlementMock.mockReturnValue({
      tier: "premium",
      isPremium: true,
      origem: "manual",
      isLoading: false,
    });
    useAiUsageMock.mockReturnValue({ data: 100, isLoading: false });

    renderCard();
    expect(screen.getByText("100/100 mensagens este mês")).toBeTruthy();

    fireEvent.click(screen.getByText("Perguntar"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeNull());
    expect(screen.getByText(PAYWALL_COPY.cota_ia.titulo)).toBeTruthy();
  });
});
