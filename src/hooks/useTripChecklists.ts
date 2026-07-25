import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { tripDashboardQueryKey } from "@/lib/trip-query-keys";
import { capture } from "@/lib/posthog";
import { TRIP_EVENTS } from "@/lib/trip-analytics";
import {
  agruparPorMarco,
  calcularProgresso,
  contarTemplatesPremiumPorTipo,
  ordenarChecklists,
  type ChecklistItemRow,
  type ChecklistProgresso,
  type ChecklistRow,
  type GrupoPorMarco,
} from "@/lib/trip-checklists";
import type { ChecklistTipo } from "@/lib/trip-templates";

export type ChecklistListaData = {
  checklist: ChecklistRow;
  itens: ChecklistItemRow[];
  grupos: GrupoPorMarco[];
  progresso: ChecklistProgresso;
};

export type TripChecklistsData = {
  listas: ChecklistListaData[];
  progressoGlobal: ChecklistProgresso;
};

export function tripChecklistsQueryKey(tripId: string | undefined) {
  return ["trip", "checklists", tripId] as const;
}

/**
 * `checklist_items.done`/`marco` também alimentam o progresso/stepper do
 * Dashboard (VJT-004) — toda mutação precisa invalidar as duas chaves,
 * senão marcar um item aqui não atualiza o Dashboard até reload (mesma
 * lição do cross-invalidation do VJT-006/VJT-006b). Chave do Dashboard
 * vem de `trip-query-keys.ts` (fonte única), nunca redeclarada aqui.
 */
export function invalidateChecklists(qc: QueryClient, tripId: string) {
  qc.invalidateQueries({ queryKey: tripChecklistsQueryKey(tripId) });
  qc.invalidateQueries({ queryKey: tripDashboardQueryKey(tripId) });
}

export function useTripChecklists(tripId: string | undefined) {
  return useQuery({
    queryKey: tripChecklistsQueryKey(tripId),
    enabled: !!tripId,
    queryFn: async (): Promise<TripChecklistsData> => {
      const id = tripId as string;

      const { data: checklistRows, error: checklistError } = await supabase
        .from("checklists")
        .select("id, trip_id, tipo, nome, ordem")
        .eq("trip_id", id);
      if (checklistError) throw checklistError;

      const checklistIds = (checklistRows ?? []).map((c) => c.id);
      const { data: itemRows, error: itemError } = checklistIds.length
        ? await supabase
            .from("checklist_items")
            .select("id, checklist_id, titulo, done, nota, marco, prazo_dias_antes, ordem")
            .in("checklist_id", checklistIds)
        : { data: [], error: null };
      if (itemError) throw itemError;

      const checklists = ordenarChecklists(
        (checklistRows ?? []).map((c) => ({
          id: c.id,
          tripId: c.trip_id,
          tipo: c.tipo,
          nome: c.nome,
          ordem: c.ordem,
        })),
      );

      const itens: ChecklistItemRow[] = (itemRows ?? []).map((i) => ({
        id: i.id,
        checklistId: i.checklist_id,
        titulo: i.titulo,
        done: i.done,
        nota: i.nota,
        marco: i.marco,
        prazoDiasAntes: i.prazo_dias_antes,
        ordem: i.ordem,
      }));

      const listas: ChecklistListaData[] = checklists.map((checklist) => {
        const itensDaLista = itens.filter((item) => item.checklistId === checklist.id);
        return {
          checklist,
          itens: itensDaLista,
          grupos: agruparPorMarco(itensDaLista),
          progresso: calcularProgresso(itensDaLista),
        };
      });

      return {
        listas,
        progressoGlobal: calcularProgresso(itens),
      };
    },
  });
}

export function premiumChecklistCountsQueryKey() {
  return ["checklist-templates", "premium-counts"] as const;
}

/**
 * Contagem de templates premium por tipo (catálogo completo, não por trip —
 * ver `contarTemplatesPremiumPorTipo`) — alimenta a linha teaser travada do
 * gatilho "abrir item de checklist premium" (VJT-011). Leitura pública
 * (policy `templates_read`), independente de tripId.
 */
export function usePremiumChecklistCounts() {
  return useQuery({
    queryKey: premiumChecklistCountsQueryKey(),
    queryFn: async (): Promise<Partial<Record<ChecklistTipo, number>>> => {
      const { data, error } = await supabase
        .from("checklist_templates")
        .select("tipo, tier")
        .eq("tier", "premium");
      if (error) throw error;
      return contarTemplatesPremiumPorTipo(
        (data ?? []).map((row) => ({
          tipo: row.tipo as ChecklistTipo,
          tier: row.tier as "premium",
        })),
      );
    },
  });
}

export function useToggleChecklistItem(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; done: boolean }) => {
      const { error } = await supabase
        .from("checklist_items")
        .update({ done: input.done })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_data, input) => {
      // `checklist_item_done` (VJT-015) mede progresso, não interação: só a
      // marcação conta. Desmarcar (`done: false`) usa a mesma mutação e não
      // dispara evento, senão o total infla com correções do usuário.
      if (input.done) {
        capture(TRIP_EVENTS.checklistItemDone, { trip_id: tripId, item_id: input.id });
      }
      invalidateChecklists(qc, tripId);
    },
  });
}

export function useAddChecklistItem(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      checklistId: string;
      titulo: string;
      marco: number | null;
      ordem: number;
    }) => {
      const { error } = await supabase.from("checklist_items").insert({
        checklist_id: input.checklistId,
        titulo: input.titulo,
        marco: input.marco,
        ordem: input.ordem,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateChecklists(qc, tripId),
  });
}

export function useUpdateChecklistItemTitulo(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; titulo: string }) => {
      const { error } = await supabase
        .from("checklist_items")
        .update({ titulo: input.titulo })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => invalidateChecklists(qc, tripId),
  });
}

export function useDeleteChecklistItem(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("checklist_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => invalidateChecklists(qc, tripId),
  });
}
