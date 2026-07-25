import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  calcularValorRegistradoNoMes,
  mesAnoAtual,
  type SavingsEntrySummary,
} from "@/lib/trip-savings";
import { calcularTripMath, type TripMathResult } from "@/lib/trip-math";
import { tripDashboardQueryKey, tripSavingsQueryKey } from "@/lib/trip-query-keys";
import { capture } from "@/lib/posthog";
import { TRIP_EVENTS } from "@/lib/trip-analytics";

export type SavingsEntry = {
  id: string;
  mesAno: string;
  valorBrlCents: number;
  /**
   * `null` quando o autor excluiu a conta (VJT-017) — `created_by` vira NULL
   * via ON DELETE SET NULL em vez de apagar a linha, para não tirar o
   * valor do acumulado coletivo da trip. Ver `entryAutorLabel` (trip-savings.ts).
   */
  createdBy: string | null;
  createdAt: string;
};

export type TripSavingsData = {
  tripMath: TripMathResult;
  entries: SavingsEntry[];
  valorRegistradoNoMesBrlCents: number;
};

const POSTGRES_UNIQUE_VIOLATION = "23505";

/**
 * savings_entries também alimenta o Dashboard (VJT-004,
 * `["trip","dashboard",tripId]`, via `tripMath.acumuladoBrlCents`) — toda
 * mutação aqui precisa invalidar as duas, senão o progresso combinado do
 * Dashboard fica desatualizado até um reload.
 */
export function invalidateSavings(qc: QueryClient, tripId: string) {
  qc.invalidateQueries({ queryKey: tripSavingsQueryKey(tripId) });
  qc.invalidateQueries({ queryKey: tripDashboardQueryKey(tripId) });
}

export function useTripSavings(tripId: string | undefined) {
  return useQuery({
    queryKey: tripSavingsQueryKey(tripId),
    enabled: !!tripId,
    queryFn: async (): Promise<TripSavingsData> => {
      const id = tripId as string;

      const { data: tripRow, error: tripError } = await supabase
        .from("trips")
        .select("data_viagem, cambio_manual")
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

      const { data: savingsRows, error: savingsError } = await supabase
        .from("savings_entries")
        .select("id, mes_ano, valor_brl_cents, created_by, created_at")
        .eq("trip_id", id)
        .order("mes_ano", { ascending: false });
      if (savingsError) throw savingsError;

      const entries: SavingsEntry[] = (savingsRows ?? []).map((row) => ({
        id: row.id,
        mesAno: row.mes_ano,
        valorBrlCents: row.valor_brl_cents,
        createdBy: row.created_by,
        createdAt: row.created_at,
      }));

      const tripMath = calcularTripMath({
        budgetItemsEstimado: (budgetItems ?? []).map((b) => ({
          brlCents: b.valor_estimado_brl_cents,
          destinoCents: b.valor_estimado_destino_cents,
        })),
        budgetItemsPago: (budgetItems ?? []).map((b) => ({
          brlCents: b.valor_pago_brl_cents,
          destinoCents: b.valor_pago_destino_cents,
        })),
        savingsEntriesBrlCents: entries.map((e) => e.valorBrlCents),
        cambioManual: tripRow.cambio_manual,
        dataViagem: tripRow.data_viagem,
        checklistItensDone: 0,
        checklistItensTotal: 0,
      });

      const summaries: SavingsEntrySummary[] = entries.map((e) => ({
        mesAno: e.mesAno,
        valorBrlCents: e.valorBrlCents,
      }));
      const valorRegistradoNoMesBrlCents = calcularValorRegistradoNoMes(summaries, mesAnoAtual());

      return { tripMath, entries, valorRegistradoNoMesBrlCents };
    },
  });
}

export function useAddSavingsEntry(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { mesAno: string; valorBrlCents: number }) => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const userId = userData.user?.id;
      if (!userId) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from("savings_entries").insert({
        trip_id: tripId,
        mes_ano: input.mesAno,
        valor_brl_cents: input.valorBrlCents,
        created_by: userId,
      });
      if (error) {
        if (error.code === POSTGRES_UNIQUE_VIOLATION) {
          throw new Error("Você já registrou um valor para este mês. Edite o valor existente.");
        }
        throw error;
      }
    },
    // `savings_entry_created` (VJT-015): só a criação. Editar ou apagar um
    // registro existente não é entrada nova de economia.
    onSuccess: (_data, input) => {
      capture(TRIP_EVENTS.savingsEntryCreated, {
        trip_id: tripId,
        mes_ano: input.mesAno,
        valor_brl_cents: input.valorBrlCents,
      });
      invalidateSavings(qc, tripId);
    },
  });
}

export function useUpdateSavingsEntry(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; valorBrlCents: number }) => {
      const { error } = await supabase
        .from("savings_entries")
        .update({ valor_brl_cents: input.valorBrlCents })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => invalidateSavings(qc, tripId),
  });
}

export function useDeleteSavingsEntry(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("savings_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateSavings(qc, tripId),
  });
}
