import type { QueryClient } from "@tanstack/react-query";

/**
 * Única fonte de verdade das chaves de query do Financeiro. As três telas
 * (Orçamento por Categoria, Economia Mensal, Dashboard "Sua Jornada") leem
 * campos compartilhados (`budget_items`, `savings_entries`, `trips.data_viagem`,
 * `trips.cambio_manual`) — chaves duplicadas como literais em cada hook
 * divergem silenciosamente quando uma muda e a outra é esquecida.
 */
export function tripBudgetQueryKey(tripId: string | undefined) {
  return ["trip", "budget", tripId] as const;
}

export function tripSavingsQueryKey(tripId: string | undefined) {
  return ["trip", "savings", tripId] as const;
}

export function tripDashboardQueryKey(tripId: string | undefined) {
  return ["trip", "dashboard", tripId] as const;
}

/**
 * Invalida as três queries do Financeiro. `budget_items` e
 * `trips.cambio_manual`/`trips.data_viagem` alimentam as três telas — toda
 * mutação que toca esses dados precisa invalidar as três, senão as outras
 * abas ficam com dado desatualizado até um reload.
 */
export function invalidateFinanceiro(qc: QueryClient, tripId: string) {
  qc.invalidateQueries({ queryKey: tripBudgetQueryKey(tripId) });
  qc.invalidateQueries({ queryKey: tripSavingsQueryKey(tripId) });
  qc.invalidateQueries({ queryKey: tripDashboardQueryKey(tripId) });
}
