// @vitest-environment jsdom
/**
 * Teste do gatilho de paywall "convidar membro" (VJT-011) + fluxo real de
 * convite (VJT-013): criar convite, exibir/copiar o link, e o kill switch
 * INVITES_ENABLED.
 */
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InviteMemberCard } from "./InviteMemberCard";
import { PaywallModal } from "@/components/trip/paywall/PaywallModal";
import { PaywallProvider } from "@/hooks/usePaywall";
import { PAYWALL_COPY } from "@/lib/entitlements";

const { useEntitlementMock, useTripMemberCountMock, useCreateTripInviteMock } = vi.hoisted(() => ({
  useEntitlementMock: vi.fn(),
  useTripMemberCountMock: vi.fn(),
  useCreateTripInviteMock: vi.fn(),
}));

vi.mock("@/hooks/useEntitlement", () => ({ useEntitlement: useEntitlementMock }));
vi.mock("@/hooks/useTripMembers", () => ({
  useTripMemberCount: useTripMemberCountMock,
  useCreateTripInvite: useCreateTripInviteMock,
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });

function renderCard() {
  return render(
    <PaywallProvider>
      <InviteMemberCard tripId="trip-1" />
      <PaywallModal />
    </PaywallProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("InviteMemberCard (gatilho: convidar membro + convite real)", () => {
  it("free (solo, 1/1): clicar em 'Convidar pessoa' abre o paywall", async () => {
    useEntitlementMock.mockReturnValue({
      tier: "free",
      isPremium: false,
      origem: null,
      isLoading: false,
    });
    useTripMemberCountMock.mockReturnValue({ data: 1, isLoading: false });
    useCreateTripInviteMock.mockReturnValue({ mutate: vi.fn(), isPending: false });

    renderCard();
    expect(screen.getByText("1/1 membro")).toBeTruthy();

    fireEvent.click(screen.getByText("Convidar pessoa"));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeNull());
    expect(screen.getByText(PAYWALL_COPY.convidar_membro.titulo)).toBeTruthy();
  });

  it("premium acima do limite: clicar não abre paywall, mostra erro", () => {
    useEntitlementMock.mockReturnValue({
      tier: "premium",
      isPremium: true,
      origem: "stripe",
      isLoading: false,
    });
    useTripMemberCountMock.mockReturnValue({ data: 5, isLoading: false });
    useCreateTripInviteMock.mockReturnValue({ mutate: vi.fn(), isPending: false });

    renderCard();
    expect(screen.getByText("5/5 membros")).toBeTruthy();

    fireEvent.click(screen.getByText("Convidar pessoa"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("premium abaixo do limite: cria o convite e mostra o link para copiar", () => {
    useEntitlementMock.mockReturnValue({
      tier: "premium",
      isPremium: true,
      origem: "stripe",
      isLoading: false,
    });
    useTripMemberCountMock.mockReturnValue({ data: 2, isLoading: false });

    const mutate = vi.fn((_vars, opts) => opts.onSuccess({ token: "abc123" }));
    useCreateTripInviteMock.mockReturnValue({ mutate, isPending: false });

    renderCard();
    fireEvent.click(screen.getByText("Convidar pessoa"));

    expect(mutate).toHaveBeenCalled();
    const input = screen.getByDisplayValue(/\/trip\/aceitar-convite\?token=abc123$/);
    expect(input).toBeTruthy();
    expect(screen.getByText("Válido por 7 dias, uso único.")).toBeTruthy();
  });

  it("copia o link ao clicar no botão de copiar", async () => {
    useEntitlementMock.mockReturnValue({
      tier: "free",
      isPremium: false,
      origem: null,
      isLoading: false,
    });
    useTripMemberCountMock.mockReturnValue({ data: 0, isLoading: false });

    const mutate = vi.fn((_vars, opts) => opts.onSuccess({ token: "xyz789" }));
    useCreateTripInviteMock.mockReturnValue({ mutate, isPending: false });

    renderCard();
    fireEvent.click(screen.getByText("Convidar pessoa"));
    fireEvent.click(screen.getByLabelText("Copiar link"));

    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining("token=xyz789"),
      ),
    );
  });

  it("INVITES_ENABLED=false: esconde a ação de convidar", () => {
    vi.stubEnv("VITE_INVITES_ENABLED", "false");
    useEntitlementMock.mockReturnValue({
      tier: "free",
      isPremium: false,
      origem: null,
      isLoading: false,
    });
    useTripMemberCountMock.mockReturnValue({ data: 1, isLoading: false });
    useCreateTripInviteMock.mockReturnValue({ mutate: vi.fn(), isPending: false });

    renderCard();
    expect(screen.queryByText("Convidar pessoa")).toBeNull();
    expect(screen.getByText("Convites estão temporariamente indisponíveis.")).toBeTruthy();
  });
});
