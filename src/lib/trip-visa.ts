/**
 * Item de visto contextual (VJT-009, VIAJALY-TRIP.md Seção 7).
 * Sem I/O, sem acesso a Supabase — mesma convenção de trip-math.ts/trip-budget.ts.
 * Casa `trips.destino_pais` (texto livre, escolhido na lista curada do wizard
 * ou digitado em "outro destino") contra `paises_visto.pais_nome` por nome
 * normalizado — não há FK entre as duas tabelas.
 */
import { waLink, type WaTracking } from "./whatsapp";

export type PaisVistoRow = {
  paisIso: string;
  paisNome: string;
  exigeVistoBr: boolean;
  tipoVisto: string | null;
  linkConsultoria: string | null;
};

export type VisaTracking = {
  source: string;
  campaign: string;
  content: string;
};

function nomeNormalizado(nome: string): string {
  return nome
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Encontra o país da trip em `paises_visto` por nome normalizado (trim +
 * lowercase + acentos). `null` quando o destino não está no catálogo (ex.
 * destino digitado livremente que não bate com nenhuma linha seedada) — nunca
 * lança erro, o item de visto simplesmente não aparece.
 */
export function encontrarPaisVisto(
  destinoPais: string,
  paises: readonly PaisVistoRow[],
): PaisVistoRow | null {
  const alvo = nomeNormalizado(destinoPais);
  return paises.find((p) => nomeNormalizado(p.paisNome) === alvo) ?? null;
}

/**
 * Regra da Seção 2: o item "Visto" só existe quando o destino exige visto
 * para brasileiros. Nunca bloqueante — ausência do item não impede nada.
 */
export function exigeItemVisto(pais: PaisVistoRow | null): pais is PaisVistoRow {
  return pais != null && pais.exigeVistoBr;
}

function mensagemWhatsAppVisto(paisNome: string): string {
  return `Olá! Vim pelo Viajaly Trip e minha viagem para ${paisNome} exige visto — quero saber mais sobre a consultoria.`;
}

/**
 * Link do card de visto, sempre com UTM (Seção 2: "card com link com UTM
 * para a consultoria"). Usa `link_consultoria` da linha quando cadastrado
 * (preservando query string existente), ou cai no WhatsApp padrão
 * (`@/lib/whatsapp`, mesma fonte única de canal de contato) — necessário
 * porque as linhas seedadas do VJT-001 não têm `link_consultoria` preenchido.
 */
export function buildVisaConsultoriaLink(pais: PaisVistoRow, tracking: VisaTracking): string {
  const waTracking: WaTracking = {
    source: tracking.source,
    campaign: tracking.campaign,
    content: tracking.content,
  };

  if (pais.linkConsultoria) {
    try {
      const url = new URL(pais.linkConsultoria);
      url.searchParams.set("utm_source", tracking.source);
      url.searchParams.set("utm_medium", "trip_app");
      url.searchParams.set("utm_campaign", tracking.campaign);
      url.searchParams.set("utm_content", tracking.content);
      return url.toString();
    } catch {
      // link_consultoria malformado — cai no fallback de WhatsApp abaixo
    }
  }

  return waLink(null, mensagemWhatsAppVisto(pais.paisNome), waTracking);
}

/**
 * Rastreia clique no CTA do card de visto (evento `visa_cta_click`, Seção 7).
 * Mesmo padrão de `trackWhatsAppClick` (dataLayer/gtag), evento distinto para
 * o funil visto→lead mapeado no VJT-015. Seguro para SSR (no-op fora do browser).
 */
export function trackVisaCtaClick(tracking: VisaTracking) {
  if (typeof window === "undefined") return;
  const payload = {
    event: "visa_cta_click",
    visa_source: tracking.source,
    visa_campaign: tracking.campaign,
    visa_content: tracking.content,
    visa_page: typeof location !== "undefined" ? location.pathname : "",
  };
  try {
    const w = window as unknown as {
      dataLayer?: Record<string, unknown>[];
      gtag?: (...args: unknown[]) => void;
    };
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push(payload);
    if (typeof w.gtag === "function") {
      w.gtag("event", "visa_cta_click", payload);
    }
  } catch {
    /* analytics nunca deve quebrar a UX */
  }
}
