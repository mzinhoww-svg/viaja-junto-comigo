// @vitest-environment jsdom
/**
 * Teste de TripNpsForm (VJT-017) — cobre a aceitação "NPS é coletado":
 * formulário aparece sem resposta prévia, envia nota+comentário, mostra
 * agradecimento após responder, e permite alterar a resposta depois.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TripNpsForm } from "./TripNpsForm";

const { useTripNpsResponseMock, useSubmitTripNpsMock, mutateMock } = vi.hoisted(() => ({
  useTripNpsResponseMock: vi.fn(),
  useSubmitTripNpsMock: vi.fn(),
  mutateMock: vi.fn(),
}));

vi.mock("@/hooks/useTripNps", () => ({
  useTripNpsResponse: useTripNpsResponseMock,
  useSubmitTripNps: useSubmitTripNpsMock,
}));

afterEach(() => {
  cleanup();
  mutateMock.mockClear();
});

describe("TripNpsForm", () => {
  it("sem resposta prévia: mostra as 11 notas e desabilita o envio até escolher uma", () => {
    useTripNpsResponseMock.mockReturnValue({ data: null, isLoading: false });
    useSubmitTripNpsMock.mockReturnValue({ mutate: mutateMock, isPending: false });

    render(<TripNpsForm tripId="trip-1" />);

    for (let n = 0; n <= 10; n++) {
      expect(screen.getByRole("button", { name: String(n) })).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: /enviar avaliação/i })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("escolher uma nota e enviar chama a mutation com nota e comentário", () => {
    useTripNpsResponseMock.mockReturnValue({ data: null, isLoading: false });
    useSubmitTripNpsMock.mockReturnValue({ mutate: mutateMock, isPending: false });

    render(<TripNpsForm tripId="trip-1" />);

    fireEvent.click(screen.getByRole("button", { name: "9" }));
    fireEvent.change(screen.getByPlaceholderText(/quer contar mais/i), {
      target: { value: "Foi ótimo!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /enviar avaliação/i }));

    expect(mutateMock).toHaveBeenCalledWith(
      { nota: 9, comentario: "Foi ótimo!" },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("já respondeu: mostra agradecimento com a nota em vez do formulário", () => {
    useTripNpsResponseMock.mockReturnValue({
      data: { nota: 8, comentario: "Muito bom" },
      isLoading: false,
    });
    useSubmitTripNpsMock.mockReturnValue({ mutate: mutateMock, isPending: false });

    render(<TripNpsForm tripId="trip-1" />);

    expect(screen.getByText(/obrigado pelo feedback/i)).toBeTruthy();
    expect(screen.getByText(/8\/10/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /enviar avaliação/i })).toBeNull();
  });

  it("já respondeu: 'Alterar resposta' reabre o formulário pré-preenchido", () => {
    useTripNpsResponseMock.mockReturnValue({
      data: { nota: 8, comentario: "Muito bom" },
      isLoading: false,
    });
    useSubmitTripNpsMock.mockReturnValue({ mutate: mutateMock, isPending: false });

    render(<TripNpsForm tripId="trip-1" />);
    fireEvent.click(screen.getByText(/alterar resposta/i));

    expect(screen.getByRole("button", { name: /enviar avaliação/i })).toBeTruthy();
    expect(screen.getByDisplayValue("Muito bom")).toBeTruthy();
  });

  it("carregando: não renderiza nada (evita flash de formulário vazio)", () => {
    useTripNpsResponseMock.mockReturnValue({ data: undefined, isLoading: true });
    useSubmitTripNpsMock.mockReturnValue({ mutate: mutateMock, isPending: false });

    const { container } = render(<TripNpsForm tripId="trip-1" />);
    expect(container.firstChild).toBeNull();
  });
});
