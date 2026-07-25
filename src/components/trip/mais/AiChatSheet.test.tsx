// @vitest-environment jsdom
/**
 * Testes do chat do assistente IA (VJT-014): resposta com contexto real
 * (mockada aqui — a injeção de contexto real é testada em
 * ai-assistant.test.ts), redirecionamento de pergunta de visto para
 * WhatsApp, cota esgotada (resposta do servidor) abre o paywall, e recusa
 * educada de pergunta fora de escopo é só mais uma mensagem de texto normal.
 */
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiChatSheet } from "./AiChatSheet";
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

function renderSheet(mutate: ReturnType<typeof vi.fn>) {
  useEntitlementMock.mockReturnValue({
    tier: "free",
    isPremium: false,
    origem: null,
    isLoading: false,
  });
  useAiUsageMock.mockReturnValue({ data: 3, isLoading: false });
  useAiChatMock.mockReturnValue({ mutate, isPending: false });

  return render(
    <PaywallProvider>
      <AiChatSheet tripId="trip-1" open onOpenChange={() => {}} />
      <PaywallModal />
    </PaywallProvider>,
  );
}

function typeAndSend(text: string) {
  fireEvent.change(screen.getByPlaceholderText("Pergunte sobre sua viagem..."), {
    target: { value: text },
  });
  fireEvent.click(screen.getByLabelText("Enviar"));
}

afterEach(() => cleanup());

describe("AiChatSheet", () => {
  it("resposta do assistente (contexto da trip) aparece na conversa", async () => {
    const mutate = vi.fn((_message, { onSuccess }) => {
      onSuccess({
        conversation_id: "conv-1",
        message: "Sua viagem para Orlando está em planejando, faltam 3 meses.",
        usage: { used: 4, limit: 10 },
      });
    });
    renderSheet(mutate);

    typeAndSend("Como está minha viagem?");

    await waitFor(() =>
      expect(
        screen.getByText("Sua viagem para Orlando está em planejando, faltam 3 meses."),
      ).toBeTruthy(),
    );
  });

  it("pergunta de visto vem com link de redirecionamento para o WhatsApp", async () => {
    const waUrl = "https://wa.me/5565996076018?text=ola";
    const mutate = vi.fn((_message, { onSuccess }) => {
      onSuccess({
        conversation_id: "conv-1",
        message: "Fale com a consultoria sobre o visto.",
        usage: { used: 4, limit: 10 },
        redirect: { whatsapp_url: waUrl },
      });
    });
    renderSheet(mutate);

    typeAndSend("Preciso de visto para os EUA?");

    await waitFor(() => expect(screen.getByText("Falar no WhatsApp")).toBeTruthy());
    expect(screen.getByText("Falar no WhatsApp").closest("a")).toHaveProperty("href", waUrl);
  });

  it("pergunta fora de escopo: a recusa do modelo aparece como mensagem normal", async () => {
    const mutate = vi.fn((_message, { onSuccess }) => {
      onSuccess({
        conversation_id: "conv-1",
        message: "Posso ajudar só com o planejamento desta viagem — sobre o que você quer saber?",
        usage: { used: 4, limit: 10 },
      });
    });
    renderSheet(mutate);

    typeAndSend("Qual o resultado do jogo de ontem?");

    await waitFor(() =>
      expect(
        screen.getByText(
          "Posso ajudar só com o planejamento desta viagem — sobre o que você quer saber?",
        ),
      ).toBeTruthy(),
    );
  });

  it("cota esgotada no servidor fecha o chat e abre o paywall", async () => {
    const mutate = vi.fn((_message, { onError }) => {
      onError(new Error("quota_exhausted"));
    });
    renderSheet(mutate);

    typeAndSend("Mais uma pergunta");

    await waitFor(() => expect(screen.getByText(PAYWALL_COPY.cota_ia.titulo)).toBeTruthy());
  });
});
