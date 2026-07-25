import type { PlanTier } from "@/lib/entitlements";

/** Alias local — fonte única do tipo é `@/lib/entitlements` (VJT-011). */
export type ItineraryPlanTier = PlanTier;

export type SlotPeriod = "manha" | "tarde" | "noite";

export const SLOT_PERIODS: readonly SlotPeriod[] = ["manha", "tarde", "noite"];

export type ItinerarySlot = {
  id: string;
  periodo: SlotPeriod;
  ondeIr: string | null;
  ondeComer: string | null;
  observacoes: string | null;
};

export type ItineraryDay = {
  id: string;
  diaNumero: number;
  ordem: number;
  data: string | null;
  slots: ItinerarySlot[];
};

export const FREE_ITINERARY_DAY_LIMIT = 5;

export function getItineraryDayLimit(tier: ItineraryPlanTier): number | null {
  return tier === "premium" ? null : FREE_ITINERARY_DAY_LIMIT;
}

export function isDayLimitReached(currentDayCount: number, tier: ItineraryPlanTier): boolean {
  const limit = getItineraryDayLimit(tier);
  return limit !== null && currentDayCount >= limit;
}

export function canExportItineraryPdf(tier: ItineraryPlanTier): boolean {
  return tier === "premium";
}

/** dia_numero/ordem nunca são digitados pelo usuário — sempre o próximo da sequência. */
export function nextDayPosition(days: ItineraryDay[]): { diaNumero: number; ordem: number } {
  const maxDiaNumero = days.reduce((max, d) => Math.max(max, d.diaNumero), 0);
  const maxOrdem = days.reduce((max, d) => Math.max(max, d.ordem), -1);
  return { diaNumero: maxDiaNumero + 1, ordem: maxOrdem + 1 };
}

export type DayNumberUpdate = { id: string; diaNumero: number; ordem: number };

/**
 * Renumera os dias após remover `removedDiaNumero`, mantendo 1..N sequencial.
 * A lista de updates é ordenada por diaNumero ascendente: aplicada em sequência
 * (não em paralelo), cada update libera o número que o próximo update ocupa,
 * o que preserva a constraint unique(trip_id, dia_numero) no banco.
 */
export function renumberAfterRemoval(
  days: ItineraryDay[],
  removedDiaNumero: number,
): DayNumberUpdate[] {
  return days
    .filter((d) => d.diaNumero > removedDiaNumero)
    .sort((a, b) => a.diaNumero - b.diaNumero)
    .map((d) => ({ id: d.id, diaNumero: d.diaNumero - 1, ordem: d.ordem - 1 }));
}

export type MoveDirection = "up" | "down";

/**
 * Plano de swap entre um dia e seu vizinho, em 3 passos, para não colidir com
 * unique(trip_id, dia_numero): move o dia alvo para um número temporário fora
 * da faixa em uso antes de completar a troca.
 */
export function computeMovePlan(
  days: ItineraryDay[],
  dayId: string,
  direction: MoveDirection,
): DayNumberUpdate[] {
  const sorted = [...days].sort((a, b) => a.diaNumero - b.diaNumero);
  const index = sorted.findIndex((d) => d.id === dayId);
  if (index === -1) return [];

  const neighborIndex = direction === "up" ? index - 1 : index + 1;
  if (neighborIndex < 0 || neighborIndex >= sorted.length) return [];

  const current = sorted[index];
  const neighbor = sorted[neighborIndex];
  const tempDiaNumero = sorted.reduce((max, d) => Math.max(max, d.diaNumero), 0) + 1;

  return [
    { id: current.id, diaNumero: tempDiaNumero, ordem: tempDiaNumero - 1 },
    { id: neighbor.id, diaNumero: current.diaNumero, ordem: current.diaNumero - 1 },
    { id: current.id, diaNumero: neighbor.diaNumero, ordem: neighbor.diaNumero - 1 },
  ];
}

export function emptySlotsForNewDay(makeId: () => string): ItinerarySlot[] {
  return SLOT_PERIODS.map((periodo) => ({
    id: makeId(),
    periodo,
    ondeIr: null,
    ondeComer: null,
    observacoes: null,
  }));
}

export function duplicateSlots(source: ItinerarySlot[], makeId: () => string): ItinerarySlot[] {
  return SLOT_PERIODS.map((periodo) => {
    const original = source.find((s) => s.periodo === periodo);
    return {
      id: makeId(),
      periodo,
      ondeIr: original?.ondeIr ?? null,
      ondeComer: original?.ondeComer ?? null,
      observacoes: original?.observacoes ?? null,
    };
  });
}
