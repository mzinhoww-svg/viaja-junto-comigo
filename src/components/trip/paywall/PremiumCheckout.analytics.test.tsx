// @vitest-environment jsdom
/**
 * `upgrade_purchase` (VJT-015) — último passo do funil grátis→compra, e o
 * evento mais fácil de contar errado: a tela de retorno do checkout pode ser
 * recarregada, remontada, ou aberta por alguém que já era premium antes.
 * Só o primeiro caso é uma compra.
 */
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PremiumCheckout } from "./PremiumCheckout";
import { PREMIUM_PRICE_BRL_CENTS } from "@/lib/entitlements";

const { useEntitlementMock, captureOnceMock } = vi.hoisted(() => ({
  useEntitlementMock: vi.fn(),
  captureOnceMock: vi.fn(),
}));

vi.mock("@/hooks/useEntitlement", () => ({ useEntitlement: useEntitlementMock }));
vi.mock("@/lib/posthog", () => ({ capture: vi.fn(), captureOnce: captureOnceMock }));
vi.mock("@/lib/stripe", () => ({
  paymentsConfigured: () => true,
  getStripe: () => null,
  getStripeEnvironment: () => "sandbox",
}));
vi.mock("@/lib/payments-stripe.functions", () => ({ createPremiumCheckout: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
}));
vi.mock("@stripe/react-stripe-js", () => ({
  EmbeddedCheckout: () => <div />,
  EmbeddedCheckoutProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function irPara(search: string) {
  window.history.replaceState({}, "", `/trip/checkout${search}`);
}

afterEach(() => cleanup());

beforeEach(() => {
  vi.clearAllMocks();
  irPara("");
});

describe("upgrade_purchase", () => {
  it("dispara na volta do checkout, deduplicado pelo session_id do Stripe", async () => {
    irPara("?session_id=cs_test_123");
    useEntitlementMock.mockReturnValue({
      tier: "premium",
      isPremium: true,
      origem: "stripe",
      isLoading: false,
    });

    render(<PremiumCheckout />);

    await waitFor(() => expect(captureOnceMock).toHaveBeenCalledTimes(1));
    expect(captureOnceMock).toHaveBeenCalledWith(
      "upgrade_purchase:cs_test_123",
      "upgrade_purchase",
      { valor_brl_cents: PREMIUM_PRICE_BRL_CENTS, origem: "stripe" },
    );
  });

  it("não dispara enquanto o webhook ainda não ativou o entitlement", async () => {
    irPara("?session_id=cs_test_123");
    useEntitlementMock.mockReturnValue({
      tier: "free",
      isPremium: false,
      origem: null,
      isLoading: false,
    });

    render(<PremiumCheckout />);

    await waitFor(() => expect(captureOnceMock).not.toHaveBeenCalled());
  });

  it("premium que abre /trip/checkout sem session_id não gera compra", async () => {
    useEntitlementMock.mockReturnValue({
      tier: "premium",
      isPremium: true,
      origem: "manual",
      isLoading: false,
    });

    render(<PremiumCheckout />);

    await waitFor(() => expect(captureOnceMock).not.toHaveBeenCalled());
  });

  it("registra a origem real do entitlement (bônus Pro+/Vip+ não vira 'stripe')", async () => {
    irPara("?session_id=cs_test_9");
    useEntitlementMock.mockReturnValue({
      tier: "premium",
      isPremium: true,
      origem: "pacote_visto",
      isLoading: false,
    });

    render(<PremiumCheckout />);

    await waitFor(() => expect(captureOnceMock).toHaveBeenCalledTimes(1));
    expect(captureOnceMock.mock.calls[0][2]).toMatchObject({ origem: "pacote_visto" });
  });
});
