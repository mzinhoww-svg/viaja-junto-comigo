/**
 * Fonte única da lógica de plano/paywall (VJT-011, VIAJALY-TRIP.md Seção 2).
 * Módulo puro: sem I/O, sem acesso a Supabase — mesma convenção do
 * trip-math.ts/trip-budget.ts. `useEntitlement()` (src/hooks/useEntitlement.ts)
 * é o único ponto de leitura da tabela `entitlements` no client; nenhum
 * componente deve checar plano ad hoc ou duplicar as regras de limite abaixo.
 */

export type PlanTier = "free" | "premium";
export type EntitlementOrigin = "stripe" | "pacote_visto" | "manual";

export type EntitlementRow = {
  plano: PlanTier;
  origem: EntitlementOrigin | null;
  expiresAt: string | null;
};

export type Entitlement = {
  tier: PlanTier;
  origem: EntitlementOrigin | null;
  isPremium: boolean;
};

/**
 * Resolve a linha crua de `entitlements` para o plano efetivo. Sem linha
 * (usuário nunca ativado) = free. `expires_at` vencido também rebaixa para
 * free, mesmo com `plano = 'premium'` gravado — nenhum outro módulo deve
 * reimplementar essa checagem de expiração.
 */
export function resolveEntitlement(row: EntitlementRow | null, nowIso: string): Entitlement {
  if (!row || row.plano !== "premium") {
    return { tier: "free", origem: row?.origem ?? null, isPremium: false };
  }
  const expirado = row.expiresAt !== null && row.expiresAt <= nowIso;
  if (expirado) {
    return { tier: "free", origem: row.origem, isPremium: false };
  }
  return { tier: "premium", origem: row.origem, isPremium: true };
}

/** Os 6 gatilhos de paywall (Seção 2) — todos abrem o mesmo `PaywallModal`. */
export type PaywallTrigger =
  | "segunda_viagem"
  | "convidar_membro"
  | "roteiro_dia_6"
  | "exportar_pdf"
  | "cota_ia"
  | "checklist_premium";

export const PAYWALL_TRIGGERS: readonly PaywallTrigger[] = [
  "segunda_viagem",
  "convidar_membro",
  "roteiro_dia_6",
  "exportar_pdf",
  "cota_ia",
  "checklist_premium",
];

export type PaywallCopy = { titulo: string; descricao: string };

export const PAYWALL_COPY: Record<PaywallTrigger, PaywallCopy> = {
  segunda_viagem: {
    titulo: "Planeje quantas viagens quiser",
    descricao:
      "O plano gratuito inclui 1 viagem por vez. Assine o Premium para ter viagens ilimitadas.",
  },
  convidar_membro: {
    titulo: "Viaje em grupo",
    descricao:
      "O plano gratuito é individual. Assine o Premium para convidar até 5 pessoas para a mesma viagem.",
  },
  roteiro_dia_6: {
    titulo: "Roteiro sem limite de dias",
    descricao:
      "O plano gratuito inclui até 5 dias de roteiro. Assine o Premium para um roteiro ilimitado.",
  },
  exportar_pdf: {
    titulo: "Leve o roteiro no bolso",
    descricao:
      "Exportar o roteiro em PDF é um recurso Premium — ideal para consultar offline durante a viagem.",
  },
  cota_ia: {
    titulo: "Mais conversas com o assistente",
    descricao:
      "O plano gratuito inclui 10 mensagens por mês com o assistente de IA. Assine o Premium para 100 mensagens por mês.",
  },
  checklist_premium: {
    titulo: "Checklist completo do seu jeito",
    descricao:
      "O plano gratuito traz o essencial (~30 itens). Assine o Premium para o checklist completo (80-120 itens) com packs por destino.",
  },
};

/** Free = 1 viagem por vez (gatilho "criar 2ª viagem"). */
export const FREE_TRIP_LIMIT = 1;

export function canCreateAnotherTrip(tier: PlanTier, ownedTripCount: number): boolean {
  return tier === "premium" || ownedTripCount < FREE_TRIP_LIMIT;
}

/** Free = solo (1 membro, o próprio owner); Premium = até 5 (gatilho "convidar membro"). */
export const FREE_MEMBER_LIMIT = 1;
export const PREMIUM_MEMBER_LIMIT = 5;

export function memberLimit(tier: PlanTier): number {
  return tier === "premium" ? PREMIUM_MEMBER_LIMIT : FREE_MEMBER_LIMIT;
}

export function canInviteMember(tier: PlanTier, currentMemberCount: number): boolean {
  return currentMemberCount < memberLimit(tier);
}

/** Free = 10 msgs/mês; Premium = 100 msgs/mês (gatilho "esgotar cota de IA"). */
export const FREE_AI_MSG_LIMIT = 10;
export const PREMIUM_AI_MSG_LIMIT = 100;

export function aiMsgLimit(tier: PlanTier): number {
  return tier === "premium" ? PREMIUM_AI_MSG_LIMIT : FREE_AI_MSG_LIMIT;
}

export function isAiQuotaExhausted(tier: PlanTier, usedThisMonth: number): boolean {
  return usedThisMonth >= aiMsgLimit(tier);
}

/**
 * Preço vigente do Premium cobrado no checkout Stripe (VJT-012): pagamento
 * único, por pessoa, valor de lançamento (R$ 97 é o preço de tabela exibido
 * no `PaywallModal`, não cobrado enquanto o lançamento estiver vigente).
 */
export const PREMIUM_PRICE_BRL_CENTS = 6700;
