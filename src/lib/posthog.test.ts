// @vitest-environment jsdom
/**
 * Testes do adaptador do PostHog (VJT-015). Foco nas garantias que o ticket
 * promete e que não dá para verificar olhando o painel: analytics nunca
 * quebra a UX, nada é enviado com analytics desligado, e `upgrade_purchase`
 * não conta duas vezes se o usuário recarregar a tela de retorno do checkout.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  capture,
  captureOnce,
  identifyUser,
  resetAnalytics,
  resetAnalyticsStateForTests,
  resetCaptureOnceForTests,
  setAnalyticsSink,
  type AnalyticsSink,
} from "./posthog";
import { TRIP_EVENTS } from "./trip-analytics";

function sinkFalso() {
  const sink: AnalyticsSink & {
    eventos: Array<{ event: string; properties?: Record<string, unknown> }>;
    identificados: string[];
    resets: number;
  } = {
    eventos: [],
    identificados: [],
    resets: 0,
    capture: (event, properties) => sink.eventos.push({ event, properties }),
    identify: (distinctId) => sink.identificados.push(distinctId),
    reset: () => (sink.resets += 1),
  };
  return sink;
}

beforeEach(() => {
  resetAnalyticsStateForTests();
  resetCaptureOnceForTests();
  sessionStorage.clear();
});

describe("capture", () => {
  it("envia o evento com as propriedades para o sink ativo", () => {
    const sink = sinkFalso();
    setAnalyticsSink(sink);

    capture(TRIP_EVENTS.inviteAccepted, { trip_id: "trip-1" });

    expect(sink.eventos).toEqual([{ event: "invite_accepted", properties: { trip_id: "trip-1" } }]);
  });

  it("é no-op silencioso com analytics desligado (sem chave, sem init)", () => {
    // Nenhum sink e nenhum init: a chamada não pode lançar nem acumular nada.
    expect(() => capture(TRIP_EVENTS.pdfExported, { trip_id: "t", dias: 3 })).not.toThrow();

    const sink = sinkFalso();
    setAnalyticsSink(sink);
    // Ao ligar um sink depois, o evento perdido NÃO é reenviado: sem init não
    // houve fila, e reenviar aqui inflaria a contagem no primeiro carregamento.
    expect(sink.eventos).toEqual([]);
  });

  it("não deixa exceção do PostHog vazar para quem chamou", () => {
    setAnalyticsSink({
      capture: () => {
        throw new Error("bloqueador de anúncio derrubou o posthog");
      },
      identify: () => {},
      reset: () => {},
    });

    expect(() =>
      capture(TRIP_EVENTS.tripCreated, {
        trip_id: "trip-1",
        destino_pais: "Estados Unidos",
        tem_data_viagem: true,
        status: "planejando",
        num_pessoas: 2,
        num_criancas: 0,
        tier: "free",
      }),
    ).not.toThrow();
  });

  it("remove propriedades nulas antes de enviar", () => {
    const sink = sinkFalso();
    setAnalyticsSink(sink);

    capture(TRIP_EVENTS.upgradePurchase, {
      valor_brl_cents: 6700,
      origem: null as unknown as string,
    });

    expect(sink.eventos[0].properties).toEqual({ valor_brl_cents: 6700 });
  });
});

describe("identifyUser / resetAnalytics", () => {
  it("identifica pelo id do usuário, sem nenhum dado pessoal junto", () => {
    const sink = sinkFalso();
    setAnalyticsSink(sink);

    identifyUser("user-1");

    expect(sink.identificados).toEqual(["user-1"]);
  });

  it("reset desassocia a identidade (logout no mesmo device)", () => {
    const sink = sinkFalso();
    setAnalyticsSink(sink);

    resetAnalytics();

    expect(sink.resets).toBe(1);
  });

  it("identify antes do sink existir não lança e não é reenviado sem init", () => {
    expect(() => identifyUser("user-1")).not.toThrow();
    const sink = sinkFalso();
    setAnalyticsSink(sink);
    expect(sink.identificados).toEqual([]);
  });
});

describe("captureOnce", () => {
  it("dispara uma vez e ignora repetições com a mesma chave", () => {
    const sink = sinkFalso();
    setAnalyticsSink(sink);

    const props = { valor_brl_cents: 6700, origem: "stripe" };
    captureOnce("upgrade_purchase:cs_123", TRIP_EVENTS.upgradePurchase, props);
    captureOnce("upgrade_purchase:cs_123", TRIP_EVENTS.upgradePurchase, props);
    captureOnce("upgrade_purchase:cs_123", TRIP_EVENTS.upgradePurchase, props);

    expect(sink.eventos).toHaveLength(1);
  });

  it("sobrevive a reload da página: a dedup fica em sessionStorage", () => {
    const sink = sinkFalso();
    setAnalyticsSink(sink);
    captureOnce("upgrade_purchase:cs_123", TRIP_EVENTS.upgradePurchase, {
      valor_brl_cents: 6700,
      origem: "stripe",
    });

    // Simula o reload: memória zerada, sessionStorage preservado.
    resetCaptureOnceForTests();
    const depois = sinkFalso();
    setAnalyticsSink(depois);
    captureOnce("upgrade_purchase:cs_123", TRIP_EVENTS.upgradePurchase, {
      valor_brl_cents: 6700,
      origem: "stripe",
    });

    expect(sink.eventos).toHaveLength(1);
    expect(depois.eventos).toHaveLength(0);
  });

  it("compras diferentes (session_id diferente) contam separado", () => {
    const sink = sinkFalso();
    setAnalyticsSink(sink);

    captureOnce("upgrade_purchase:cs_1", TRIP_EVENTS.upgradePurchase, {
      valor_brl_cents: 6700,
      origem: "stripe",
    });
    captureOnce("upgrade_purchase:cs_2", TRIP_EVENTS.upgradePurchase, {
      valor_brl_cents: 6700,
      origem: "stripe",
    });

    expect(sink.eventos).toHaveLength(2);
  });

  it("sessionStorage indisponível não impede o disparo nem a dedup em memória", () => {
    const sink = sinkFalso();
    setAnalyticsSink(sink);
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage bloqueado");
    });

    captureOnce("k", TRIP_EVENTS.inviteSent, { trip_id: "trip-1" });
    captureOnce("k", TRIP_EVENTS.inviteSent, { trip_id: "trip-1" });

    expect(sink.eventos).toHaveLength(1);
    getItem.mockRestore();
  });
});
