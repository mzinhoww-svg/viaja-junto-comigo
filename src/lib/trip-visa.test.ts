// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  buildVisaConsultoriaLink,
  encontrarPaisVisto,
  exigeItemVisto,
  trackVisaCtaClick,
  type PaisVistoRow,
} from "./trip-visa";
import { resetAnalyticsStateForTests, setAnalyticsSink } from "./posthog";

function pais(overrides: Partial<PaisVistoRow> = {}): PaisVistoRow {
  return {
    paisIso: "US",
    paisNome: "Estados Unidos",
    exigeVistoBr: true,
    tipoVisto: "B1/B2",
    linkConsultoria: null,
    ...overrides,
  };
}

const CATALOGO: PaisVistoRow[] = [
  pais(),
  pais({
    paisIso: "PT",
    paisNome: "Portugal",
    exigeVistoBr: false,
    tipoVisto: null,
  }),
];

describe("encontrarPaisVisto", () => {
  it("encontra por nome exato", () => {
    expect(encontrarPaisVisto("Estados Unidos", CATALOGO)?.paisIso).toBe("US");
  });

  it("é insensível a maiúsculas/minúsculas e a espaços nas pontas", () => {
    expect(encontrarPaisVisto("  estados unidos  ", CATALOGO)?.paisIso).toBe("US");
  });

  it("é insensível a acentos", () => {
    expect(encontrarPaisVisto("estados unidos", CATALOGO)?.paisIso).toBe("US");
    const comAcento = [pais({ paisIso: "MX", paisNome: "México" })];
    expect(encontrarPaisVisto("Mexico", comAcento)?.paisIso).toBe("MX");
  });

  it("retorna null para destino fora do catálogo (ex. digitado livremente)", () => {
    expect(encontrarPaisVisto("Nárnia", CATALOGO)).toBeNull();
  });
});

describe("exigeItemVisto", () => {
  it("true quando o país exige visto para brasileiros", () => {
    expect(exigeItemVisto(pais({ exigeVistoBr: true }))).toBe(true);
  });

  it("false quando o país não exige visto (ex. Portugal)", () => {
    expect(exigeItemVisto(pais({ exigeVistoBr: false }))).toBe(false);
  });

  it("false quando não há país encontrado (null)", () => {
    expect(exigeItemVisto(null)).toBe(false);
  });
});

describe("buildVisaConsultoriaLink", () => {
  const tracking = { source: "trip_checklists", campaign: "visto_contextual", content: "US" };

  it("usa link_consultoria quando cadastrado, preservando query existente e anexando UTM", () => {
    const link = buildVisaConsultoriaLink(
      pais({ linkConsultoria: "https://viajaly.com/consultoria?ref=trip" }),
      tracking,
    );
    const url = new URL(link);
    expect(url.origin + url.pathname).toBe("https://viajaly.com/consultoria");
    expect(url.searchParams.get("ref")).toBe("trip");
    expect(url.searchParams.get("utm_source")).toBe("trip_checklists");
    expect(url.searchParams.get("utm_medium")).toBe("trip_app");
    expect(url.searchParams.get("utm_campaign")).toBe("visto_contextual");
    expect(url.searchParams.get("utm_content")).toBe("US");
  });

  it("cai no link de WhatsApp com UTM quando link_consultoria é malformado", () => {
    const link = buildVisaConsultoriaLink(pais({ linkConsultoria: "não é uma url" }), tracking);
    expect(link).toContain("https://wa.me/");
    expect(link).toContain("utm_source=trip_checklists");
    expect(link).toContain("utm_campaign=visto_contextual");
    expect(link).toContain("utm_content=US");
  });

  it("cai no link de WhatsApp com UTM quando link_consultoria é null (seed atual do VJT-001)", () => {
    const link = buildVisaConsultoriaLink(pais({ linkConsultoria: null }), tracking);
    expect(link).toContain("https://wa.me/");
    expect(link).toContain("utm_medium=whatsapp");
    expect(link).toContain("utm_content=US");
    expect(link).toContain("Estados+Unidos");
  });
});

/**
 * `visa_cta_click` é o único evento que já existia antes do VJT-015 (VJT-009,
 * via dataLayer/gtag). O ticket acrescenta a perna PostHog dentro da mesma
 * função — estes testes cobrem os dois riscos disso: perder o destino antigo,
 * ou o clique passar a contar duas vezes.
 */
describe("trackVisaCtaClick", () => {
  const tracking = { source: "trip_checklists", campaign: "visto_contextual", content: "US" };

  beforeEach(() => {
    resetAnalyticsStateForTests();
    delete (window as unknown as { dataLayer?: unknown[] }).dataLayer;
    delete (window as unknown as { gtag?: unknown }).gtag;
  });

  it("mantém o push para dataLayer/gtag do VJT-009 (regressão)", () => {
    const gtagCalls: unknown[][] = [];
    (window as unknown as { gtag: (...args: unknown[]) => void }).gtag = (...args) =>
      gtagCalls.push(args);

    trackVisaCtaClick(tracking);

    const dataLayer = (window as unknown as { dataLayer: Record<string, unknown>[] }).dataLayer;
    expect(dataLayer).toHaveLength(1);
    expect(dataLayer[0]).toMatchObject({
      event: "visa_cta_click",
      visa_source: "trip_checklists",
      visa_campaign: "visto_contextual",
      visa_content: "US",
    });
    expect(gtagCalls).toHaveLength(1);
    expect(gtagCalls[0][1]).toBe("visa_cta_click");
  });

  it("emite também para o PostHog, uma vez por clique", () => {
    const eventos: Array<{ event: string; properties?: Record<string, unknown> }> = [];
    setAnalyticsSink({
      capture: (event, properties) => eventos.push({ event, properties }),
      identify: () => {},
      reset: () => {},
    });

    trackVisaCtaClick(tracking);

    expect(eventos).toHaveLength(1);
    expect(eventos[0].event).toBe("visa_cta_click");
    expect(eventos[0].properties).toMatchObject({
      visa_source: "trip_checklists",
      visa_campaign: "visto_contextual",
      visa_content: "US",
    });
  });

  it("dois cliques = dois eventos em cada destino, sem duplicação cruzada", () => {
    const eventos: string[] = [];
    setAnalyticsSink({
      capture: (event) => eventos.push(event),
      identify: () => {},
      reset: () => {},
    });

    trackVisaCtaClick(tracking);
    trackVisaCtaClick(tracking);

    const dataLayer = (window as unknown as { dataLayer: Record<string, unknown>[] }).dataLayer;
    expect(eventos).toHaveLength(2);
    expect(dataLayer).toHaveLength(2);
  });
});
