// @vitest-environment jsdom
/**
 * Teste do gatilho de paywall "convidar membro" (VJT-011). O convite real
 * (VJT-013) ainda não existe — aqui só a regra de limite por plano.
 */
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InviteMemberCard } from "./InviteMemberCard";
import { PaywallModal } from "@/components/trip/paywall/PaywallModal";
import { PaywallProvider } from "@/hooks/usePaywall";
import { PAYWALL_COPY } from "@/lib/entitlements";

const { useEntitlementMock, useTripMemberCountMock } = vi.hoisted(() => ({
  useEntitlementMock: vi.fn(),
  useTripMemberCountMock: vi.fn(),
}));

vi.mock("@/hooks/useEntitlement", () => ({ useEntitlement: useEntitlementMock }));
vi.mock("@/hooks/useTripMembers", () => ({ useTripMemberCount: useTripMemberCountMock }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

function renderCard() {
  return render(
    <PaywallProvider>
      <InviteMemberCard tripId="trip-1" />
      <PaywallModal />
    </PaywallProvider>,
  );
}

afterEach(() => cleanup());

describe("InviteMemberCard (gatilho: convidar membro)", () => {
  it("free (solo, 1/1): clicar em 'Convidar pessoa' abre o paywall", async () => {
    useEntitlementMock.mockReturnValue({
      tier: "free",
      isPremium: false,
      origem: null,
      isLoading: false,
    });
    useTripMemberCountMock.mockReturnValue({ data: 1, isLoading: false });

    renderCard();
    expect(screen.getByText("1/1 membro")).toBeTruthy();

    fireEvent.click(screen.getByText("Convidar pessoa"));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeNull());
    expect(screen.getByText(PAYWALL_COPY.convidar_membro.titulo)).toBeTruthy();
  });

  it("premium abaixo do limite: clicar não abre paywall (fluxo real é VJT-013)", () => {
    useEntitlementMock.mockReturnValue({
      tier: "premium",
      isPremium: true,
      origem: "stripe",
      isLoading: false,
    });
    useTripMemberCountMock.mockReturnValue({ data: 2, isLoading: false });

    renderCard();
    expect(screen.getByText("2/5 membros")).toBeTruthy();

    fireEvent.click(screen.getByText("Convidar pessoa"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
