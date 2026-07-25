/**
 * Instrumentação de produto do Viajaly Trip (VJT-015, VIAJALY-TRIP.md Seção 7).
 * Módulo PURO: nomes de evento, formato das propriedades, definição dos funis e
 * leitura da config de ambiente — sem I/O, sem `posthog-js`, sem `window`.
 * Mesma convenção de `trip-math.ts`/`entitlements.ts`. O adaptador com efeito
 * colateral vive em `posthog.ts` e importa daqui; nenhum nome de evento é
 * escrito como string literal fora deste arquivo.
 */

/**
 * Os 12 eventos do PRD §2. A chave é o identificador usado no código; o valor
 * é o nome exato que chega ao PostHog (e que os funis do painel referenciam).
 */
export const TRIP_EVENTS = {
  signup: "signup",
  tripCreated: "trip_created",
  checklistItemDone: "checklist_item_done",
  savingsEntryCreated: "savings_entry_created",
  budgetItemCreated: "budget_item_created",
  aiMessageSent: "ai_message_sent",
  upgradeView: "upgrade_view",
  upgradePurchase: "upgrade_purchase",
  visaCtaClick: "visa_cta_click",
  inviteSent: "invite_sent",
  inviteAccepted: "invite_accepted",
  pdfExported: "pdf_exported",
} as const;

export type TripEventKey = keyof typeof TRIP_EVENTS;
export type TripEventName = (typeof TRIP_EVENTS)[TripEventKey];

/** Lista dos 12 nomes, na ordem declarada — usada por testes de contrato. */
export const TRIP_EVENT_NAMES: readonly TripEventName[] = Object.values(TRIP_EVENTS);

/**
 * Propriedades por evento. Regra da Seção 2 aplicada aqui: **nada de PII** —
 * só uuid, enum, contador e valor em centavos. Nunca e-mail, nome, título de
 * item, nota ou mensagem de IA (texto livre digitado pelo usuário).
 */
export type TripEventProperties = {
  /**
   * Entrada do usuário no produto — dispara no PRIMEIRO consentimento LGPD e
   * nunca mais. `versao_termos` é a versão aceita naquele momento, útil para
   * datar coortes; não é o que decide o disparo (ver `useLgpdConsent.ts`).
   */
  signup: { source: "lgpd_consent"; versao_termos: string };
  trip_created: {
    trip_id: string;
    destino_pais: string;
    tem_data_viagem: boolean;
    status: string;
    num_pessoas: number;
    num_criancas: number;
    tier: string;
  };
  checklist_item_done: { trip_id: string; item_id: string };
  savings_entry_created: { trip_id: string; mes_ano: string; valor_brl_cents: number };
  budget_item_created: { trip_id: string; category_id: string; tem_valor_destino: boolean };
  /**
   * Sem `tier`: `msgs_limite` já é a cota do plano (10 free / 100 premium,
   * `entitlements.ts`), então o plano é derivável sem duplicar a fonte de
   * verdade de plano dentro do payload.
   */
  ai_message_sent: {
    trip_id: string;
    msgs_usadas: number;
    msgs_limite: number;
    redirecionou_visto: boolean;
  };
  upgrade_view: { trigger: string };
  upgrade_purchase: { valor_brl_cents: number; origem: string };
  visa_cta_click: {
    visa_source: string;
    visa_campaign: string;
    visa_content: string;
    visa_page: string;
  };
  /**
   * "Enviado" = link mágico gerado. O envio de fato (copiar e mandar por
   * WhatsApp/e-mail) acontece fora do app e não é observável; `invite_accepted`
   * é quem fecha o par e mede a conversão real do convite.
   */
  invite_sent: { trip_id: string };
  invite_accepted: { trip_id: string };
  pdf_exported: { trip_id: string; dias: number };
};

/** Payload de um evento, amarrado ao nome — erro de typecheck se não bater. */
export type TripEventPayload<N extends TripEventName> = TripEventProperties[N];

// ---------------------------------------------------------------------------
// Funis (VJT-015: "funis grátis→compra e visto→lead")
// ---------------------------------------------------------------------------

export type TripFunnel = {
  id: string;
  nome: string;
  descricao: string;
  /** Passos ordenados. Todo passo é obrigatoriamente um dos 12 eventos. */
  passos: readonly TripEventName[];
};

/**
 * Grátis→compra: a tese de monetização da Seção 1 (grátis adquire audiência,
 * premium monetiza). `upgrade_view` entra uma vez por abertura do modal único
 * — o gatilho específico (1 dos 6) fica na propriedade `trigger`, então o
 * mesmo funil se destrincha por gatilho no painel sem evento novo.
 */
export const FUNNEL_FREE_TO_PURCHASE: TripFunnel = {
  id: "gratis_para_compra",
  nome: "Grátis → compra",
  descricao:
    "Do primeiro acesso ao Trip até a compra do Premium. Destrinchável por gatilho de paywall pela propriedade `trigger` de upgrade_view.",
  passos: [
    TRIP_EVENTS.signup,
    TRIP_EVENTS.tripCreated,
    TRIP_EVENTS.upgradeView,
    TRIP_EVENTS.upgradePurchase,
  ],
};

/**
 * Visto→lead: o segundo motor de receita (destinos que exigem visto geram
 * leads contextuais para a consultoria). O card de visto só é renderizado
 * quando o destino exige visto para brasileiros (VJT-009), então o par
 * `trip_created` (com `destino_pais`) → `visa_cta_click` já dá a taxa de
 * conversão por destino sem precisar de um evento de impressão.
 */
export const FUNNEL_VISA_TO_LEAD: TripFunnel = {
  id: "visto_para_lead",
  nome: "Visto → lead",
  descricao:
    "Do primeiro acesso até o clique no CTA da consultoria no card de visto. Segmentável por destino pela propriedade `destino_pais` de trip_created.",
  passos: [TRIP_EVENTS.signup, TRIP_EVENTS.tripCreated, TRIP_EVENTS.visaCtaClick],
};

export const TRIP_FUNNELS: readonly TripFunnel[] = [FUNNEL_FREE_TO_PURCHASE, FUNNEL_VISA_TO_LEAD];

// ---------------------------------------------------------------------------
// Configuração de ambiente
// ---------------------------------------------------------------------------

export const POSTHOG_DEFAULT_HOST = "https://us.i.posthog.com";

export type AnalyticsEnv = {
  VITE_POSTHOG_KEY?: string;
  VITE_POSTHOG_HOST?: string;
  VITE_ANALYTICS_ENABLED?: string;
};

export type AnalyticsConfig = { apiKey: string; apiHost: string };

/**
 * Config do PostHog a partir do ambiente, ou `null` quando analytics está
 * desligado. Opt-in igual ao Sentry (`sentry.ts`): sem `VITE_POSTHOG_KEY` o
 * produto inteiro roda sem analytics, então dev e preview seguem funcionando
 * sem configuração nenhuma.
 *
 * Kill switch: `VITE_ANALYTICS_ENABLED="false"` desliga a captura mesmo com a
 * chave presente — desligar em produção é trocar uma variável, não um deploy
 * de código (Seção 2: "feature arriscada nasce com kill switch").
 */
export function analyticsConfigFromEnv(env: AnalyticsEnv): AnalyticsConfig | null {
  const apiKey = env.VITE_POSTHOG_KEY?.trim();
  if (!apiKey) return null;
  if (env.VITE_ANALYTICS_ENABLED?.trim() === "false") return null;

  const host = env.VITE_POSTHOG_HOST?.trim();
  return { apiKey, apiHost: host || POSTHOG_DEFAULT_HOST };
}

/**
 * Remove chaves com valor `undefined`/`null` antes de enviar. Evita propriedade
 * fantasma no PostHog (uma chave enviada uma vez fica no schema do projeto
 * para sempre) quando um campo opcional não tem valor naquele disparo.
 */
export function limparPropriedades(props: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined && v !== null));
}
