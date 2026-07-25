import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { consolidarValorBRL } from "@/lib/trip-math";
import {
  calcularFaltaPagar,
  calcularResumoCategoria,
  calcularTotaisGerais,
  categoriasDefaultFaltando,
  type BudgetCategoryRow,
  type BudgetCategorySummary,
  type BudgetItemRow,
} from "@/lib/trip-budget";
import { invalidateFinanceiro, tripBudgetQueryKey } from "@/lib/trip-query-keys";
import { capture } from "@/lib/posthog";
import { TRIP_EVENTS } from "@/lib/trip-analytics";

export type TripBudgetData = {
  moedaDestino: string | null;
  cambioManual: number | null;
  categorias: BudgetCategorySummary[];
  totalEstimadoBrlCents: number;
  totalPagoBrlCents: number;
  faltaPagarBrlCents: number;
};

export function useTripBudget(tripId: string | undefined) {
  return useQuery({
    queryKey: tripBudgetQueryKey(tripId),
    enabled: !!tripId,
    queryFn: async (): Promise<TripBudgetData> => {
      const id = tripId as string;

      const { data: tripRow, error: tripError } = await supabase
        .from("trips")
        .select("moeda_destino, cambio_manual")
        .eq("id", id)
        .single();
      if (tripError) throw tripError;

      const { data: categoryRows, error: categoryError } = await supabase
        .from("budget_categories")
        .select("id, nome, cor, ordem, is_default")
        .eq("trip_id", id)
        .order("ordem", { ascending: true });
      if (categoryError) throw categoryError;

      const { data: itemRows, error: itemError } = await supabase
        .from("budget_items")
        .select(
          "id, category_id, nome, nota, valor_estimado_brl_cents, valor_estimado_destino_cents, valor_pago_brl_cents, valor_pago_destino_cents",
        )
        .eq("trip_id", id);
      if (itemError) throw itemError;

      const categorias: BudgetCategoryRow[] = (categoryRows ?? []).map((c) => ({
        id: c.id,
        nome: c.nome,
        cor: c.cor,
        ordem: c.ordem,
        isDefault: c.is_default,
      }));

      const itens: BudgetItemRow[] = (itemRows ?? []).map((i) => ({
        id: i.id,
        categoryId: i.category_id,
        nome: i.nome,
        nota: i.nota,
        valorEstimadoBrlCents: i.valor_estimado_brl_cents,
        valorEstimadoDestinoCents: i.valor_estimado_destino_cents,
        valorPagoBrlCents: i.valor_pago_brl_cents,
        valorPagoDestinoCents: i.valor_pago_destino_cents,
      }));

      const cambioManual = tripRow.cambio_manual;
      const resumos = categorias.map((c) => calcularResumoCategoria(c, itens, cambioManual));
      const { totalEstimadoBrlCents, totalPagoBrlCents } = calcularTotaisGerais(
        itens,
        cambioManual,
      );

      return {
        moedaDestino: tripRow.moeda_destino,
        cambioManual,
        categorias: resumos,
        totalEstimadoBrlCents,
        totalPagoBrlCents,
        faltaPagarBrlCents: calcularFaltaPagar(totalEstimadoBrlCents, totalPagoBrlCents),
      };
    },
  });
}

/**
 * Cria só as categorias da paleta padrão que ainda não existem na trip (por
 * nome) — idempotente, nunca duplica uma categoria já criada manualmente ou
 * pelo wizard (ex.: "Geral").
 */
export function useCreateDefaultCategories(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: existentes, error: fetchError } = await supabase
        .from("budget_categories")
        .select("nome, ordem")
        .eq("trip_id", tripId);
      if (fetchError) throw fetchError;

      const faltando = categoriasDefaultFaltando(
        (existentes ?? []).map((c) => ({
          id: "",
          nome: c.nome,
          cor: "",
          ordem: c.ordem,
          isDefault: false,
        })),
      );
      if (faltando.length === 0) return;

      const ordemInicial = (existentes ?? []).reduce((max, c) => Math.max(max, c.ordem), -1) + 1;
      const { error } = await supabase.from("budget_categories").insert(
        faltando.map((categoria, indice) => ({
          trip_id: tripId,
          nome: categoria.nome,
          cor: categoria.cor,
          ordem: ordemInicial + indice,
          is_default: true,
        })),
      );
      if (error) throw error;
    },
    onSuccess: () => invalidateFinanceiro(qc, tripId),
  });
}

export function useAddCategory(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { nome: string; cor: string }) => {
      const { error } = await supabase.from("budget_categories").insert({
        trip_id: tripId,
        nome: input.nome,
        cor: input.cor,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateFinanceiro(qc, tripId),
  });
}

export function useDeleteCategory(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (categoryId: string) => {
      const { error } = await supabase.from("budget_categories").delete().eq("id", categoryId);
      if (error) throw error;
    },
    onSuccess: () => invalidateFinanceiro(qc, tripId),
  });
}

export function useAddBudgetItem(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      categoryId: string;
      nome: string;
      estimadoBrlCents: number;
      estimadoDestinoCents: number;
    }) => {
      const { error } = await supabase.from("budget_items").insert({
        trip_id: tripId,
        category_id: input.categoryId,
        nome: input.nome,
        valor_estimado_brl_cents: input.estimadoBrlCents > 0 ? input.estimadoBrlCents : null,
        valor_estimado_destino_cents:
          input.estimadoDestinoCents > 0 ? input.estimadoDestinoCents : null,
      });
      if (error) throw error;
    },
    // `budget_item_created` (VJT-015). `tem_valor_destino` separa quem usa
    // moeda dual de quem só orça em BRL — sem mandar o valor em si, que já
    // vive agregado no `trip_created`/dashboard.
    onSuccess: (_data, input) => {
      capture(TRIP_EVENTS.budgetItemCreated, {
        trip_id: tripId,
        category_id: input.categoryId,
        tem_valor_destino: input.estimadoDestinoCents > 0,
      });
      invalidateFinanceiro(qc, tripId);
    },
  });
}

export function useDeleteBudgetItem(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("budget_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => invalidateFinanceiro(qc, tripId),
  });
}

/**
 * Registra o valor pago de um item. Se informado na moeda destino e houver
 * câmbio manual definido, converte para BRL na escrita (o pagamento reflete o
 * câmbio do momento em que foi feito — o câmbio manual da trip não
 * retroage sobre pagamentos já registrados, só sobre estimativas futuras).
 * Sem câmbio definido, grava só o valor na moeda destino (fica sinalizado
 * por `itemPrecisaCambio` até o usuário definir o câmbio e editar de novo).
 */
export function useUpdateBudgetItemPago(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      pagoBrlCents: number;
      pagoDestinoCents: number;
      cambioManual: number | null;
    }) => {
      const valorPagoBrlCents =
        input.pagoBrlCents > 0
          ? input.pagoBrlCents
          : consolidarValorBRL(
              { brlCents: null, destinoCents: input.pagoDestinoCents || null },
              input.cambioManual,
            );

      const { error } = await supabase
        .from("budget_items")
        .update({
          valor_pago_brl_cents: valorPagoBrlCents,
          valor_pago_destino_cents: input.pagoDestinoCents,
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => invalidateFinanceiro(qc, tripId),
  });
}

export function useUpdateCambioManual(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { moedaDestino: string | null; cambioManual: number | null }) => {
      const { error } = await supabase
        .from("trips")
        .update({
          moeda_destino: input.moedaDestino,
          cambio_manual: input.cambioManual,
          cambio_atualizado_em: new Date().toISOString(),
        })
        .eq("id", tripId);
      if (error) throw error;
    },
    onSuccess: () => invalidateFinanceiro(qc, tripId),
  });
}
