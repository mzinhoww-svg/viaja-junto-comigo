/**
 * VJT-020 — viagem exemplo pública (`/trip/exemplo`) e clonagem no cadastro.
 *
 * Módulo puro: sem I/O, sem Supabase, sem React — mesma convenção de
 * `trip-math.ts` e `entitlements.ts`. Toda agregação numérica daqui delega a
 * `trip-math.ts`; nenhuma fórmula da Seção 2 é reescrita neste arquivo.
 */

import { canCreateAnotherTrip, type PaywallTrigger, type PlanTier } from "@/lib/entitlements";
import type { ItineraryDay } from "@/lib/itinerary";
import { calcularTripMath, type TripMathResult } from "@/lib/trip-math";

export type TemplateChecklistItem = {
  id: string;
  titulo: string;
  done: boolean;
  marco: number | null;
  ordem: number;
};

export type TemplateChecklist = {
  id: string;
  tipo: string;
  nome: string;
  ordem: number;
  itens: TemplateChecklistItem[];
};

export type TemplateBudgetItem = {
  id: string;
  nome: string;
  estimadoBrlCents: number | null;
  estimadoDestinoCents: number | null;
  pagoBrlCents: number;
  pagoDestinoCents: number;
};

export type TemplateBudgetCategory = {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
  itens: TemplateBudgetItem[];
};

export type TemplateTrip = {
  id: string;
  nome: string;
  destinoPais: string;
  destinoCidade: string | null;
  dataViagem: string | null;
  numPessoas: number;
  numCriancas: number;
  moedaDestino: string | null;
  cambioManual: number | null;
  categorias: TemplateBudgetCategory[];
  checklists: TemplateChecklist[];
  dias: ItineraryDay[];
  /**
   * Total agregado das economias, em centavos, vindo da RPC
   * `template_trip_savings_total`. É um número e nada mais: `savings_entries`
   * carrega `created_by` de um usuário real e por isso NÃO é lida linha a
   * linha pelo visitante deslogado (VJT-020, decisão registrada na Seção 7).
   */
  savingsTotalBrlCents: number;
};

export type TemplateTripResumo = {
  math: TripMathResult;
  totalDias: number;
  totalItensChecklist: number;
  totalItensChecklistDone: number;
  totalItensOrcamento: number;
};

/**
 * Roda as fórmulas da Seção 2 sobre a viagem exemplo. `hoje` é injetável para
 * o teste não depender da data do relógio (a viagem exemplo tem data futura,
 * então o modo esperado é `planejando` — mas isso muda sozinho com o tempo).
 */
export function resumirTemplateTrip(trip: TemplateTrip, hoje?: Date): TemplateTripResumo {
  const itens = trip.categorias.flatMap((c) => c.itens);
  const itensChecklist = trip.checklists.flatMap((c) => c.itens);

  const math = calcularTripMath({
    budgetItemsEstimado: itens.map((i) => ({
      brlCents: i.estimadoBrlCents,
      destinoCents: i.estimadoDestinoCents,
    })),
    budgetItemsPago: itens.map((i) => ({
      brlCents: i.pagoBrlCents,
      destinoCents: i.pagoDestinoCents,
    })),
    savingsEntriesBrlCents: [trip.savingsTotalBrlCents],
    cambioManual: trip.cambioManual,
    dataViagem: trip.dataViagem,
    checklistItensDone: itensChecklist.filter((i) => i.done).length,
    checklistItensTotal: itensChecklist.length,
    hoje,
  });

  return {
    math,
    totalDias: trip.dias.length,
    totalItensChecklist: itensChecklist.length,
    totalItensChecklistDone: itensChecklist.filter((i) => i.done).length,
    totalItensOrcamento: itens.length,
  };
}

// ---------------------------------------------------------------------------
// Fluxo do CTA "Criar minha viagem a partir deste exemplo"
// ---------------------------------------------------------------------------

/**
 * Sentinela do retorno do login. Propositalmente não-numérica: o parser de
 * search param do router converteria `?clonar=1` para o número 1, e a rota
 * passaria a depender do tipo que o parser escolheu.
 */
export const TEMPLATE_CLONE_FLAG = "sim";

/** Para onde o login devolve o visitante depois de autenticar. */
export const TEMPLATE_CLONE_NEXT = `/trip/exemplo?clonar=${TEMPLATE_CLONE_FLAG}`;

export type TemplateCtaStep =
  | { tipo: "login"; next: string }
  | { tipo: "abrir-clone"; tripId: string }
  | { tipo: "paywall"; trigger: PaywallTrigger }
  | { tipo: "clonar" };

/**
 * Decide o que o CTA faz, dado o estado do visitante. Separado da UI para ser
 * testável sem router nem Supabase — os 4 caminhos são o coração do ticket.
 *
 * `cloneExistenteId` vem antes do limite de plano de propósito: quem já clonou
 * este exemplo está voltando para a PRÓPRIA viagem, e mostrar paywall de
 * "segunda viagem" para alguém que só quer reabrir a primeira seria um beco
 * sem saída. O limite de plano continua valendo para quem ainda não clonou, e
 * é lido de `canCreateAnotherTrip` — a mesma fonte única que o
 * `CreateTripGate` usa, nunca uma regra paralela.
 */
export function proximoPassoCta(input: {
  temSessao: boolean;
  cloneExistenteId: string | null;
  tier: PlanTier;
  viagensDoUsuario: number;
}): TemplateCtaStep {
  if (!input.temSessao) return { tipo: "login", next: TEMPLATE_CLONE_NEXT };
  if (input.cloneExistenteId) return { tipo: "abrir-clone", tripId: input.cloneExistenteId };
  if (!canCreateAnotherTrip(input.tier, input.viagensDoUsuario)) {
    return { tipo: "paywall", trigger: "segunda_viagem" };
  }
  return { tipo: "clonar" };
}

/**
 * Traduz os erros que a RPC levanta para algo que a persona P1 entenda. O
 * texto cru (`template_not_found`) chega junto do erro do PostgREST e nunca
 * deve ir para a tela.
 */
export function mensagemDeErroClone(erroCru: string): string {
  if (erroCru.includes("auth_required")) {
    return "Sua sessão expirou. Entre de novo para criar sua viagem.";
  }
  if (erroCru.includes("template_not_found")) {
    return "Este exemplo não está mais disponível.";
  }
  return "Não foi possível criar sua viagem agora. Tente novamente.";
}
