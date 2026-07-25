// @vitest-environment jsdom
/**
 * Teste do gatilho de paywall "criar 2ª viagem" (VJT-011). `TripWizard` e
 * `@tanstack/react-router` (`Link`) são mockados para isolar só a lógica do
 * gate — o wizard em si já tem sua própria cobertura de testes.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateTripGate } from "./CreateTripGate";
import { PaywallModal } from "@/components/trip/paywall/PaywallModal";
import { PaywallProvider } from "@/hooks/usePaywall";
import { PAYWALL_COPY } from "@/lib/entitlements";

const { useEntitlementMock, useOwnedTripCountMock } = vi.hoisted(() => ({
  useEntitlementMock: vi.fn(),
  useOwnedTripCountMock: vi.fn(),
}));

vi.mock("@/hooks/useEntitlement", () => ({ useEntitlement: useEntitlementMock }));
vi.mock("@/hooks/useOwnedTripCount", () => ({ useOwnedTripCount: useOwnedTripCountMock }));
vi.mock("@/components/trip/wizard/TripWizard", () => ({
  TripWizard: () => <div>wizard-real</div>,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

function renderGate() {
  return render(
    <PaywallProvider>
      <CreateTripGate />
      <PaywallModal />
    </PaywallProvider>,
  );
}

afterEach(() => cleanup());

describe("CreateTripGate (gatilho: criar 2ª viagem)", () => {
  it("free com 1 viagem já criada: bloqueia o wizard e abre o paywall", async () => {
    useEntitlementMock.mockReturnValue({
      tier: "free",
      isPremium: false,
      origem: null,
      isLoading: false,
    });
    useOwnedTripCountMock.mockReturnValue({ data: 1, isLoading: false });

    renderGate();

    expect(screen.queryByText("wizard-real")).toBeNull();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeNull());
    expect(screen.getByText(PAYWALL_COPY.segunda_viagem.titulo)).toBeTruthy();
  });

  it("free sem nenhuma viagem ainda: libera o wizard, sem paywall", async () => {
    useEntitlementMock.mockReturnValue({
      tier: "free",
      isPremium: false,
      origem: null,
      isLoading: false,
    });
    useOwnedTripCountMock.mockReturnValue({ data: 0, isLoading: false });

    renderGate();

    await waitFor(() => expect(screen.queryByText("wizard-real")).not.toBeNull());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("premium com várias viagens: sempre libera o wizard", async () => {
    useEntitlementMock.mockReturnValue({
      tier: "premium",
      isPremium: true,
      origem: "stripe",
      isLoading: false,
    });
    useOwnedTripCountMock.mockReturnValue({ data: 4, isLoading: false });

    renderGate();

    await waitFor(() => expect(screen.queryByText("wizard-real")).not.toBeNull());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("enquanto carrega, não bloqueia nem abre o paywall precocemente", () => {
    useEntitlementMock.mockReturnValue({
      tier: "free",
      isPremium: false,
      origem: null,
      isLoading: true,
    });
    useOwnedTripCountMock.mockReturnValue({ data: undefined, isLoading: true });

    renderGate();

    expect(screen.queryByText("wizard-real")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
