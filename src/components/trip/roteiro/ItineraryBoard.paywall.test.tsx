// @vitest-environment jsdom
/**
 * Testes dos gatilhos de paywall "adicionar 6º dia de roteiro" e
 * "exportar PDF" (VJT-011), em `ItineraryBoard.tsx`. Os hooks de dados
 * (`useItinerary.ts`) e `useEntitlement` são mockados — a lógica de dados
 * já tem cobertura própria; aqui o foco é confirmar que free bate no
 * paywall certo e premium nunca bate.
 */
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { ItineraryBoard } from "./ItineraryBoard";
import { PaywallModal } from "@/components/trip/paywall/PaywallModal";
import { PaywallProvider } from "@/hooks/usePaywall";
import { PAYWALL_COPY } from "@/lib/entitlements";
import type { ItineraryDay } from "@/lib/itinerary";

const { useEntitlementMock, useItineraryMocks } = vi.hoisted(() => ({
  useEntitlementMock: vi.fn(),
  useItineraryMocks: {
    useCurrentTrip: vi.fn(),
    useItineraryDays: vi.fn(),
    useAddItineraryDay: vi.fn(),
    useDuplicateItineraryDay: vi.fn(),
    useRemoveItineraryDay: vi.fn(),
    useMoveItineraryDay: vi.fn(),
    useUpdateItinerarySlot: vi.fn(),
  },
}));

vi.mock("@/hooks/useEntitlement", () => ({ useEntitlement: useEntitlementMock }));
vi.mock("@/hooks/useItinerary", () => useItineraryMocks);
vi.mock("@/lib/itinerary-pdf", () => ({ exportItineraryPdf: vi.fn() }));

const TRIP = {
  id: "trip-1",
  nome: "Viagem de Teste",
  destinoPais: "Estados Unidos",
  destinoCidade: null,
  dataViagem: "2026-12-01",
  numPessoas: 2,
};

function buildDays(count: number): ItineraryDay[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `day-${i + 1}`,
    diaNumero: i + 1,
    ordem: i,
    data: null,
    slots: [],
  }));
}

function renderBoard() {
  return render(
    <PaywallProvider>
      <ItineraryBoard />
      <PaywallModal />
    </PaywallProvider>,
  );
}

afterEach(() => cleanup());

beforeEach(() => {
  vi.clearAllMocks();
  useItineraryMocks.useCurrentTrip.mockReturnValue({ isLoading: false, data: TRIP });
  useItineraryMocks.useAddItineraryDay.mockReturnValue({ mutate: vi.fn(), isPending: false });
  useItineraryMocks.useDuplicateItineraryDay.mockReturnValue({ mutate: vi.fn(), isPending: false });
  useItineraryMocks.useRemoveItineraryDay.mockReturnValue({ mutate: vi.fn(), isPending: false });
  useItineraryMocks.useMoveItineraryDay.mockReturnValue({ mutate: vi.fn(), isPending: false });
  useItineraryMocks.useUpdateItinerarySlot.mockReturnValue({ mutate: vi.fn(), isPending: false });
});

describe("gatilho: adicionar 6º dia de roteiro", () => {
  it("free com 5 dias: clicar em 'Adicionar dia' abre o paywall, sem chamar a mutation", async () => {
    useEntitlementMock.mockReturnValue({
      tier: "free",
      isPremium: false,
      origem: null,
      isLoading: false,
    });
    useItineraryMocks.useItineraryDays.mockReturnValue({ isLoading: false, data: buildDays(5) });

    renderBoard();
    fireEvent.click(screen.getByText("Adicionar dia"));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeNull());
    expect(screen.getByText(PAYWALL_COPY.roteiro_dia_6.titulo)).toBeTruthy();
    expect(
      useItineraryMocks.useAddItineraryDay.mock.results[0].value.mutate,
    ).not.toHaveBeenCalled();
  });

  it("free com menos de 5 dias: adiciona normalmente, sem paywall", () => {
    useEntitlementMock.mockReturnValue({
      tier: "free",
      isPremium: false,
      origem: null,
      isLoading: false,
    });
    useItineraryMocks.useItineraryDays.mockReturnValue({ isLoading: false, data: buildDays(3) });

    renderBoard();
    fireEvent.click(screen.getByText("Adicionar dia"));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(useItineraryMocks.useAddItineraryDay.mock.results[0].value.mutate).toHaveBeenCalled();
  });

  it("premium com 5 dias: adiciona o 6º normalmente, sem paywall", () => {
    useEntitlementMock.mockReturnValue({
      tier: "premium",
      isPremium: true,
      origem: "stripe",
      isLoading: false,
    });
    useItineraryMocks.useItineraryDays.mockReturnValue({ isLoading: false, data: buildDays(5) });

    renderBoard();
    fireEvent.click(screen.getByText("Adicionar dia"));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(useItineraryMocks.useAddItineraryDay.mock.results[0].value.mutate).toHaveBeenCalled();
  });
});

describe("gatilho: exportar PDF", () => {
  it("free: clicar em 'Exportar PDF' abre o paywall, sem gerar o arquivo", async () => {
    useEntitlementMock.mockReturnValue({
      tier: "free",
      isPremium: false,
      origem: null,
      isLoading: false,
    });
    useItineraryMocks.useItineraryDays.mockReturnValue({ isLoading: false, data: buildDays(2) });

    renderBoard();
    fireEvent.click(screen.getByText("Exportar PDF"));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeNull());
    expect(screen.getByText(PAYWALL_COPY.exportar_pdf.titulo)).toBeTruthy();
  });

  it("premium: clicar em 'Exportar PDF' gera o arquivo, sem paywall", async () => {
    const { exportItineraryPdf } = await import("@/lib/itinerary-pdf");
    useEntitlementMock.mockReturnValue({
      tier: "premium",
      isPremium: true,
      origem: "manual",
      isLoading: false,
    });
    useItineraryMocks.useItineraryDays.mockReturnValue({ isLoading: false, data: buildDays(2) });

    renderBoard();
    fireEvent.click(screen.getByText("Exportar PDF"));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(exportItineraryPdf).toHaveBeenCalled();
  });
});
