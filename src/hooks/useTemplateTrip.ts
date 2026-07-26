import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ownedTripCountQueryKey } from "@/hooks/useOwnedTripCount";
import type { ItineraryDay, SlotPeriod } from "@/lib/itinerary";
import {
  mensagemDeErroClone,
  type TemplateBudgetCategory,
  type TemplateChecklist,
  type TemplateTrip,
} from "@/lib/trip-template";

export function templateTripQueryKey() {
  return ["trip", "template"] as const;
}

export function templateCloneQueryKey(templateId: string | undefined) {
  return ["trip", "template-clone", templateId] as const;
}

/**
 * Carrega a viagem exemplo (VJT-020). Roda com a chave anônima e SEM sessão:
 * tudo o que ela lê está coberto pelas policies de SELECT público em trips
 * com `is_template` e nas 6 filhas.
 *
 * A trip é achada por `is_template`, não por uuid fixo: o uuid do exemplo é
 * dado de banco, e um literal aqui viraria deploy toda vez que o exemplo
 * mudasse. Como o `anon` só enxerga trips template, a busca não tem como
 * alcançar a viagem de ninguém.
 */
export function useTemplateTrip() {
  return useQuery({
    queryKey: templateTripQueryKey(),
    // A viagem exemplo é conteúdo editorial, não dado do usuário: não faz
    // sentido refetch a cada foco de janela.
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<TemplateTrip | null> => {
      const { data: tripRow, error: tripError } = await supabase
        .from("trips")
        .select(
          "id, nome, destino_pais, destino_cidade, data_viagem, num_pessoas, num_criancas, moeda_destino, cambio_manual",
        )
        .eq("is_template", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (tripError) throw tripError;
      if (!tripRow) return null;

      const tripId = tripRow.id;

      const [categorias, itensOrcamento, listas, dias, savings] = await Promise.all([
        supabase
          .from("budget_categories")
          .select("id, nome, cor, ordem")
          .eq("trip_id", tripId)
          .order("ordem"),
        supabase
          .from("budget_items")
          .select(
            "id, category_id, nome, valor_estimado_brl_cents, valor_estimado_destino_cents, valor_pago_brl_cents, valor_pago_destino_cents",
          )
          .eq("trip_id", tripId),
        supabase.from("checklists").select("id, tipo, nome, ordem").eq("trip_id", tripId),
        supabase
          .from("itinerary_days")
          .select("id, dia_numero, ordem, data")
          .eq("trip_id", tripId)
          .order("dia_numero"),
        supabase.rpc("template_trip_savings_total", { p_trip_id: tripId }),
      ]);

      for (const r of [categorias, itensOrcamento, listas, dias, savings]) {
        if (r.error) throw r.error;
      }

      const listaIds = (listas.data ?? []).map((l) => l.id);
      const diaIds = (dias.data ?? []).map((d) => d.id);

      const [itensChecklist, slots] = await Promise.all([
        listaIds.length
          ? supabase
              .from("checklist_items")
              .select("id, checklist_id, titulo, done, marco, ordem")
              .in("checklist_id", listaIds)
              .order("ordem")
          : Promise.resolve({ data: [], error: null }),
        diaIds.length
          ? supabase
              .from("itinerary_slots")
              .select("id, day_id, periodo, onde_ir, onde_comer, observacoes")
              .in("day_id", diaIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (itensChecklist.error) throw itensChecklist.error;
      if (slots.error) throw slots.error;

      const categoriasView: TemplateBudgetCategory[] = (categorias.data ?? []).map((c) => ({
        id: c.id,
        nome: c.nome,
        cor: c.cor,
        ordem: c.ordem,
        itens: (itensOrcamento.data ?? [])
          .filter((i) => i.category_id === c.id)
          .map((i) => ({
            id: i.id,
            nome: i.nome,
            estimadoBrlCents: i.valor_estimado_brl_cents,
            estimadoDestinoCents: i.valor_estimado_destino_cents,
            pagoBrlCents: i.valor_pago_brl_cents,
            pagoDestinoCents: i.valor_pago_destino_cents,
          })),
      }));

      const checklistsView: TemplateChecklist[] = (listas.data ?? [])
        .map((l) => ({
          id: l.id,
          tipo: l.tipo as string,
          nome: l.nome,
          ordem: l.ordem,
          itens: (itensChecklist.data ?? [])
            .filter((i) => i.checklist_id === l.id)
            .map((i) => ({
              id: i.id,
              titulo: i.titulo,
              done: i.done,
              marco: i.marco,
              ordem: i.ordem,
            })),
        }))
        .sort((a, b) => a.ordem - b.ordem);

      const diasView: ItineraryDay[] = (dias.data ?? []).map((d) => ({
        id: d.id,
        diaNumero: d.dia_numero,
        ordem: d.ordem,
        data: d.data,
        slots: (slots.data ?? [])
          .filter((s) => s.day_id === d.id)
          .map((s) => ({
            id: s.id,
            periodo: s.periodo as SlotPeriod,
            ondeIr: s.onde_ir,
            ondeComer: s.onde_comer,
            observacoes: s.observacoes,
          })),
      }));

      return {
        id: tripRow.id,
        nome: tripRow.nome,
        destinoPais: tripRow.destino_pais,
        destinoCidade: tripRow.destino_cidade,
        dataViagem: tripRow.data_viagem,
        numPessoas: tripRow.num_pessoas,
        numCriancas: tripRow.num_criancas,
        moedaDestino: tripRow.moeda_destino,
        cambioManual: tripRow.cambio_manual,
        categorias: categoriasView,
        checklists: checklistsView,
        dias: diasView,
        savingsTotalBrlCents: Number(savings.data ?? 0),
      };
    },
  });
}

/**
 * O clone que o usuário logado já fez DESTE exemplo, se houver. É o que
 * transforma o CTA em "abrir minha viagem" na segunda visita, em vez de
 * empurrar um paywall de segunda viagem para quem só quer voltar à primeira.
 * Sem sessão, devolve null sem ir ao banco.
 */
export function useMyTemplateClone(templateId: string | undefined) {
  return useQuery({
    queryKey: templateCloneQueryKey(templateId),
    enabled: !!templateId,
    queryFn: async (): Promise<string | null> => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return null;

      const { data, error } = await supabase
        .from("trips")
        .select("id")
        .eq("owner_id", userId)
        .eq("cloned_from_template_id", templateId as string)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },
  });
}

/**
 * Clona a viagem exemplo para o usuário logado. Toda a cópia acontece na RPC
 * security definer `clone_template_trip` — uma transação só, do lado do
 * banco: uma clonagem parcial por queda de rede no meio de 7 inserts
 * separados deixaria o usuário com uma viagem quebrada e sem como refazê-la
 * (a idempotência a consideraria "já clonada").
 */
export function useCloneTemplateTrip() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string): Promise<string> => {
      const { data, error } = await supabase.rpc("clone_template_trip", {
        p_trip_id: templateId,
      });
      if (error) throw new Error(mensagemDeErroClone(error.message));
      return data as string;
    },
    onSuccess: (_tripId, templateId) => {
      // Mesmas chaves que `useCreateTrip` invalida — uma viagem nova muda o
      // "current trip" e a contagem que alimenta o gate de segunda viagem.
      qc.invalidateQueries({ queryKey: ["trip", "current"] });
      qc.invalidateQueries({ queryKey: ownedTripCountQueryKey() });
      qc.invalidateQueries({ queryKey: templateCloneQueryKey(templateId) });
    },
  });
}
