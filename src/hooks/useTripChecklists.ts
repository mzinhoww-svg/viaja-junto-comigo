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
import { tripVariablesFromTrip } from "@/lib/trip-destinations";
import type { ChecklistTipo, PlanTier, TripVariables } from "@/lib/trip-templates";

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

export function tripVariablesQueryKey(tripId: string | undefined) {
  return ["trip", "variables", tripId] as const;
}

/**
 * Variáveis de clonagem (`regiao`/`clima`/`destinoPack`/`comCriancas`) da trip
 * que está sendo vista — insumo de `usePremiumChecklistCounts` (VJT-011b).
 * Busca **pelo `tripId` da rota**, não pela primeira trip do usuário
 * (`useCurrentTrip`), porque quem já teve premium pode ter várias trips: usar
 * a primeira daria o número de outra viagem. `trips` não persiste as variáveis
 * (o wizard só as usa na clonagem), então são reconstruídas do destino salvo
 * por `tripVariablesFromTrip`.
 */
export function useTripVariables(tripId: string | undefined) {
  return useQuery({
    queryKey: tripVariablesQueryKey(tripId),
    enabled: !!tripId,
    queryFn: async (): Promise<TripVariables> => {
      const { data, error } = await supabase
        .from("trips")
        .select("destino_pais, destino_cidade, num_criancas")
        .eq("id", tripId as string)
        .single();
      if (error) throw error;
      return tripVariablesFromTrip({
        destinoPais: data.destino_pais,
        destinoCidade: data.destino_cidade,
        numCriancas: data.num_criancas,
      });
    },
  });
}

export function premiumChecklistCountsQueryKey(vars: TripVariables | undefined) {
  return [
    "checklist-templates",
    "premium-counts",
    vars
      ? {
          regiao: vars.regiao,
          clima: vars.clima,
          destinoPack: vars.destinoPack,
          comCriancas: vars.comCriancas,
          duracaoDias: vars.duracaoDias,
        }
      : null,
  ] as const;
}

/**
 * Contagem dos itens premium que **esta trip** ganharia ao virar premium —
 * alimenta a linha teaser travada do gatilho "abrir item de checklist premium"
 * (VJT-011). As variáveis da trip entram na conta via `templateAplica`
 * (VJT-011b): sem elas o número somava packs de destino que nunca seriam
 * clonados para aquela viagem. Leitura pública (policy `templates_read`), sem
 * tripId — a chave de cache é a combinação de variáveis, então duas trips com
 * o mesmo perfil de destino reaproveitam o mesmo resultado.
 */
export function usePremiumChecklistCounts(vars: TripVariables | undefined) {
  return useQuery({
    queryKey: premiumChecklistCountsQueryKey(vars),
    enabled: !!vars,
    queryFn: async (): Promise<Partial<Record<ChecklistTipo, number>>> => {
      const { data, error } = await supabase
        .from("checklist_templates")
        .select(
          "id, tipo, titulo, marco, prazo_dias_antes, tier, regiao, clima, min_duracao, com_crianca, destino_pack, ordem",
        )
        .eq("tier", "premium");
      if (error) throw error;
      return contarTemplatesPremiumPorTipo(
        (data ?? []).map((row) => ({
          id: row.id,
          tipo: row.tipo as ChecklistTipo,
          titulo: row.titulo,
          marco: row.marco,
          prazoDiasAntes: row.prazo_dias_antes,
          tier: row.tier as PlanTier,
          regiao: row.regiao,
          clima: row.clima,
          minDuracao: row.min_duracao,
          comCrianca: row.com_crianca,
          destinoPack: row.destino_pack,
          ordem: row.ordem,
        })),
        vars as TripVariables,
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
