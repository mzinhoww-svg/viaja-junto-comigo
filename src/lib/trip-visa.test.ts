import { describe, expect, it } from "vitest";
import {
  buildVisaConsultoriaLink,
  encontrarPaisVisto,
  exigeItemVisto,
  type PaisVistoRow,
} from "./trip-visa";

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
