import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calcularDiasRestantes, construirJourneySteps, type JourneyStep } from "@/lib/trip-journey";
import { calcularTripMath, determinarModoTrip, type TripMathResult } from "@/lib/trip-math";
import { tripDashboardQueryKey, tripSavingsQueryKey } from "@/lib/trip-query-keys";

export type TripDashboardTrip = {
  id: string;
  nome: string;
  destinoPais: string;
  destinoCidade: string | null;
  dataViagem: string | null;
  cambioManual: number | null;
};

export type TripDashboardData = {
  trip: TripDashboardTrip;
  tripMath: TripMathResult;
  diasRestantes: number | null;
  steps: JourneyStep[];
  checklistItensDone: number;
  checklistItensTotal: number;
};

export function useTripDashboard(tripId: string | undefined) {
  return useQuery({
    queryKey: tripDashboardQueryKey(tripId),
    enabled: !!tripId,
    queryFn: async (): Promise<TripDashboardData> => {
      const id = tripId as string;

      const { data: tripRow, error: tripError } = await supabase
        .from("trips")
        .select("id, nome, destino_pais, destino_cidade, data_viagem, cambio_manual")
        .eq("id", id)
        .single();
      if (tripError) throw tripError;

      const { data: budgetItems, error: budgetError } = await supabase
        .from("budget_items")
        .select(
          "valor_estimado_brl_cents, valor_estimado_destino_cents, valor_pago_brl_cents, valor_pago_destino_cents",
        )
        .eq("trip_id", id);
      if (budgetError) throw budgetError;

      const { data: savingsEntries, error: savingsError } = await supabase
        .from("savings_entries")
        .select("valor_brl_cents")
        .eq("trip_id", id);
      if (savingsError) throw savingsError;

      const { data: checklists, error: checklistsError } = await supabase
        .from("checklists")
        .select("id")
        .eq("trip_id", id);
      if (checklistsError) throw checklistsError;

      const checklistIds = (checklists ?? []).map((c: { id: string }) => c.id);
      const { data: checklistItems, error: itemsError } = checklistIds.length
        ? await supabase
            .from("checklist_items")
            .select("done, marco")
            .in("checklist_id", checklistIds)
        : { data: [] as { done: boolean; marco: number | null }[], error: null };
      if (itemsError) throw itemsError;

      const trip: TripDashboardTrip = {
        id: tripRow.id,
        nome: tripRow.nome,
        destinoPais: tripRow.destino_pais,
        destinoCidade: tripRow.destino_cidade,
        dataViagem: tripRow.data_viagem,
        cambioManual: tripRow.cambio_manual,
      };

      const items = checklistItems ?? [];
      const tripMath = calcularTripMath({
        budgetItemsEstimado: (budgetItems ?? []).map((b) => ({
          brlCents: b.valor_estimado_brl_cents,
          destinoCents: b.valor_estimado_destino_cents,
        })),
        budgetItemsPago: (budgetItems ?? []).map((b) => ({
          brlCents: b.valor_pago_brl_cents,
          destinoCents: b.valor_pago_destino_cents,
        })),
        savingsEntriesBrlCents: (savingsEntries ?? []).map((s) => s.valor_brl_cents),
        cambioManual: trip.cambioManual,
        dataViagem: trip.dataViagem,
        checklistItensDone: items.filter((i) => i.done).length,
        checklistItensTotal: items.length,
      });

      const diasRestantes = calcularDiasRestantes(trip.dataViagem);
      const steps = construirJourneySteps(items, diasRestantes, tripMath.modo);

      return {
        trip,
        tripMath,
        diasRestantes,
        steps,
        checklistItensDone: items.filter((i) => i.done).length,
        checklistItensTotal: items.length,
      };
    },
  });
}

/**
 * Edita a data da viagem a partir do countdown do dashboard (inclui voltar
 * para "modo sonho" ao enviar `null`). Mantém `trips.status` coerente com
 * `determinarModoTrip`, mas o dashboard sempre recalcula o modo no client a
 * partir de `data_viagem` — a coluna é só para consumidores externos (ex. SQL).
 *
 * `data_viagem` também alimenta a Economia Mensal (VJT-005,
 * `["trip","savings",tripId]`, via `meses_restantes`/`sugestao_mensal`) —
 * invalida as duas, senão a Economia Mensal fica com valores desatualizados
 * até um reload. `["trip","current"]` é de `useCurrentTrip`/roteiro
 * (VJT-008), não relacionada ao Financeiro.
 */
export function invalidateAfterTripDateChange(qc: QueryClient, tripId: string) {
  qc.invalidateQueries({ queryKey: tripDashboardQueryKey(tripId) });
  qc.invalidateQueries({ queryKey: tripSavingsQueryKey(tripId) });
  qc.invalidateQueries({ queryKey: ["trip", "current"] });
}

export function useUpdateTripDate(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (novaDataViagem: string | null) => {
      const status = determinarModoTrip(novaDataViagem);
      const { error } = await supabase
        .from("trips")
        .update({ data_viagem: novaDataViagem, status })
        .eq("id", tripId);
      if (error) throw error;
    },
    onSuccess: () => invalidateAfterTripDateChange(qc, tripId),
  });
}
