/**
 * Testes do contrato de instrumentação (VJT-015). O que este arquivo protege
 * não é comportamento de UI, é o *vocabulário*: renomear um evento sem querer
 * ou tirar um passo de funil quebra a métrica em silêncio no dia seguinte —
 * o app continua funcionando e o painel simplesmente para de contar.
 */
import { describe, expect, it } from "vitest";
import {
  analyticsConfigFromEnv,
  FUNNEL_FREE_TO_PURCHASE,
  FUNNEL_VISA_TO_LEAD,
  limparPropriedades,
  POSTHOG_DEFAULT_HOST,
  TRIP_EVENTS,
  TRIP_EVENT_NAMES,
  TRIP_FUNNELS,
} from "./trip-analytics";

describe("TRIP_EVENTS", () => {
  it("declara exatamente os 12 eventos do PRD §2, com os nomes exatos", () => {
    expect([...TRIP_EVENT_NAMES].sort()).toEqual(
      [
        "ai_message_sent",
        "budget_item_created",
        "checklist_item_done",
        "invite_accepted",
        "invite_sent",
        "pdf_exported",
        "savings_entry_created",
        "signup",
        "trip_created",
        "upgrade_purchase",
        "upgrade_view",
        "visa_cta_click",
      ].sort(),
    );
    expect(TRIP_EVENT_NAMES).toHaveLength(12);
  });

  it("não repete nome de evento", () => {
    expect(new Set(TRIP_EVENT_NAMES).size).toBe(TRIP_EVENT_NAMES.length);
  });

  it("mantém o nome do evento já existente desde o VJT-009", () => {
    // `visa_cta_click` já era disparado para dataLayer/gtag antes deste
    // ticket — renomear aqui quebraria o histórico do funil visto→lead.
    expect(TRIP_EVENTS.visaCtaClick).toBe("visa_cta_click");
  });
});

describe("funis", () => {
  it("todo passo de funil é um dos 12 eventos", () => {
    for (const funil of TRIP_FUNNELS) {
      for (const passo of funil.passos) {
        expect(TRIP_EVENT_NAMES).toContain(passo);
      }
    }
  });

  it("grátis→compra vai do primeiro acesso à compra, nessa ordem", () => {
    expect(FUNNEL_FREE_TO_PURCHASE.passos).toEqual([
      "signup",
      "trip_created",
      "upgrade_view",
      "upgrade_purchase",
    ]);
  });

  it("visto→lead termina no clique do CTA da consultoria", () => {
    expect(FUNNEL_VISA_TO_LEAD.passos).toEqual(["signup", "trip_created", "visa_cta_click"]);
  });

  it("nenhum funil repete um passo (etapa repetida quebra a taxa de conversão)", () => {
    for (const funil of TRIP_FUNNELS) {
      expect(new Set(funil.passos).size).toBe(funil.passos.length);
    }
  });

  it("os dois funis são declarados e têm id único", () => {
    expect(TRIP_FUNNELS).toHaveLength(2);
    expect(new Set(TRIP_FUNNELS.map((f) => f.id)).size).toBe(2);
  });
});

describe("analyticsConfigFromEnv", () => {
  it("desliga sem chave (default de dev/preview, igual ao Sentry)", () => {
    expect(analyticsConfigFromEnv({})).toBeNull();
    expect(analyticsConfigFromEnv({ VITE_POSTHOG_KEY: "" })).toBeNull();
    expect(analyticsConfigFromEnv({ VITE_POSTHOG_KEY: "   " })).toBeNull();
  });

  it("liga com chave e usa o host default quando nenhum é informado", () => {
    expect(analyticsConfigFromEnv({ VITE_POSTHOG_KEY: "phc_abc" })).toEqual({
      apiKey: "phc_abc",
      apiHost: POSTHOG_DEFAULT_HOST,
    });
  });

  it("respeita host próprio (proxy/self-hosted)", () => {
    expect(
      analyticsConfigFromEnv({
        VITE_POSTHOG_KEY: "phc_abc",
        VITE_POSTHOG_HOST: "https://eu.i.posthog.com",
      })?.apiHost,
    ).toBe("https://eu.i.posthog.com");
  });

  it("host em branco cai no default em vez de virar host vazio", () => {
    expect(
      analyticsConfigFromEnv({ VITE_POSTHOG_KEY: "phc_abc", VITE_POSTHOG_HOST: "  " })?.apiHost,
    ).toBe(POSTHOG_DEFAULT_HOST);
  });

  it("kill switch desliga mesmo com a chave configurada", () => {
    expect(
      analyticsConfigFromEnv({ VITE_POSTHOG_KEY: "phc_abc", VITE_ANALYTICS_ENABLED: "false" }),
    ).toBeNull();
  });

  it("kill switch só desliga com o literal 'false' — nada de desligar por engano", () => {
    for (const valor of ["true", "1", "", "False", "no"]) {
      expect(
        analyticsConfigFromEnv({ VITE_POSTHOG_KEY: "phc_abc", VITE_ANALYTICS_ENABLED: valor }),
      ).not.toBeNull();
    }
  });
});

describe("limparPropriedades", () => {
  it("remove undefined/null e preserva zero, false e string vazia", () => {
    expect(limparPropriedades({ a: undefined, b: null, c: 0, d: false, e: "", f: "ok" })).toEqual({
      c: 0,
      d: false,
      e: "",
      f: "ok",
    });
  });
});
