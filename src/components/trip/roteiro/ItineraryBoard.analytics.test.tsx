// @vitest-environment jsdom
/**
 * `pdf_exported` (VJT-015). O botão "Exportar PDF" tem três desfechos —
 * paywall (free), PDF gerado, e falha na geração — e só um deles é uma
 * exportação. Estes testes fixam isso: o evento acompanha o arquivo gerado,
 * não o clique.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ItineraryBoard } from "./ItineraryBoard";
import { PaywallModal } from "@/components/trip/paywall/PaywallModal";
import { PaywallProvider } from "@/hooks/usePaywall";
import type { ItineraryDay } from "@/lib/itinerary";

const { useEntitlementMock, useItineraryMocks, captureMock, exportPdfMock } = vi.hoisted(() => ({
  useEntitlementMock: vi.fn(),
  captureMock: vi.fn(),
  exportPdfMock: vi.fn(),
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
vi.mock("@/lib/itinerary-pdf", () => ({ exportItineraryPdf: exportPdfMock }));
vi.mock("@/lib/posthog", () => ({ capture: captureMock, captureOnce: vi.fn() }));

const TRIP = {
  id: "trip-1",
  nome: "Viagem de Teste",
  destinoPais: "Estados Unidos",
  destinoCidade: null,
  dataViagem: "2027-12-01",
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

function eventos(nome: string) {
  return captureMock.mock.calls.filter(([evento]) => evento === nome);
}

afterEach(() => cleanup());

beforeEach(() => {
  vi.clearAllMocks();
  useItineraryMocks.useCurrentTrip.mockReturnValue({ isLoading: false, data: TRIP });
  useItineraryMocks.useItineraryDays.mockReturnValue({ isLoading: false, data: buildDays(4) });
  useItineraryMocks.useAddItineraryDay.mockReturnValue({ mutate: vi.fn(), isPending: false });
  useItineraryMocks.useDuplicateItineraryDay.mockReturnValue({ mutate: vi.fn(), isPending: false });
  useItineraryMocks.useRemoveItineraryDay.mockReturnValue({ mutate: vi.fn(), isPending: false });
  useItineraryMocks.useMoveItineraryDay.mockReturnValue({ mutate: vi.fn(), isPending: false });
  useItineraryMocks.useUpdateItinerarySlot.mockReturnValue({ mutate: vi.fn(), isPending: false });
});

describe("pdf_exported", () => {
  it("premium: dispara uma vez, com a contagem de dias exportados", () => {
    useEntitlementMock.mockReturnValue({
      tier: "premium",
      isPremium: true,
      origem: "stripe",
      isLoading: false,
    });

    renderBoard();
    fireEvent.click(screen.getByText("Exportar PDF"));

    expect(exportPdfMock).toHaveBeenCalledTimes(1);
    expect(eventos("pdf_exported")).toEqual([["pdf_exported", { trip_id: "trip-1", dias: 4 }]]);
  });

  it("free: o clique vira upgrade_view, nunca pdf_exported", async () => {
    useEntitlementMock.mockReturnValue({
      tier: "free",
      isPremium: false,
      origem: null,
      isLoading: false,
    });

    renderBoard();
    fireEvent.click(screen.getByText("Exportar PDF"));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeNull());
    expect(exportPdfMock).not.toHaveBeenCalled();
    expect(eventos("pdf_exported")).toHaveLength(0);
    expect(eventos("upgrade_view")).toEqual([["upgrade_view", { trigger: "exportar_pdf" }]]);
  });

  it("falha ao gerar o PDF não conta exportação", () => {
    useEntitlementMock.mockReturnValue({
      tier: "premium",
      isPremium: true,
      origem: "stripe",
      isLoading: false,
    });
    exportPdfMock.mockImplementation(() => {
      throw new Error("jsPDF explodiu");
    });

    renderBoard();
    fireEvent.click(screen.getByText("Exportar PDF"));

    expect(eventos("pdf_exported")).toHaveLength(0);
  });
});
