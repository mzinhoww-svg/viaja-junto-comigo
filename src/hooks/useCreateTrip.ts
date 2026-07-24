import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { determinarModoTrip } from "@/lib/trip-math";
import {
  agruparEmChecklists,
  CHECKLIST_TIPOS,
  selecionarTemplates,
  type ChecklistTemplateRow,
  type PlanTier,
} from "@/lib/trip-templates";
import {
  tripVariablesFromInput,
  validarNovaTripInput,
  type NovaTripInput,
} from "@/lib/trip-wizard";

function mapTemplateRow(row: {
  id: string;
  tipo: string;
  titulo: string;
  marco: number | null;
  prazo_dias_antes: number | null;
  tier: string;
  regiao: string | null;
  clima: string | null;
  min_duracao: number | null;
  com_crianca: boolean | null;
  destino_pack: string | null;
  ordem: number;
}): ChecklistTemplateRow {
  return {
    id: row.id,
    tipo: row.tipo as ChecklistTemplateRow["tipo"],
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
  };
}

/**
 * Cria a trip a partir do input do wizard: registra owner + trip_members,
 * clona os checklist_templates aplicáveis (tier + variáveis do destino) nas 4
 * listas fixas, e opcionalmente cria a categoria/itens de orçamento iniciais.
 */
export function useCreateTrip() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: NovaTripInput): Promise<string> => {
      const erros = validarNovaTripInput(input);
      if (erros.length) throw new Error(erros[0]);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Sessão expirada. Faça login novamente.");
      const userId = userData.user.id;

      const { data: entitlement } = await supabase
        .from("entitlements")
        .select("plano")
        .eq("user_id", userId)
        .maybeSingle();
      const tier: PlanTier = entitlement?.plano === "premium" ? "premium" : "free";

      const status = determinarModoTrip(input.dataViagem);

      const { data: trip, error: tripError } = await supabase
        .from("trips")
        .insert({
          owner_id: userId,
          nome: `Viagem para ${input.destino.cidade ?? input.destino.pais}`,
          destino_pais: input.destino.pais,
          destino_cidade: input.destino.cidade,
          data_viagem: input.dataViagem,
          num_pessoas: input.viajantes.numPessoas,
          num_criancas: input.viajantes.numCriancas,
          status,
        })
        .select("id")
        .single();
      if (tripError) throw tripError;
      const tripId = trip.id as string;

      const { error: memberError } = await supabase
        .from("trip_members")
        .insert({ trip_id: tripId, user_id: userId, role: "owner" });
      if (memberError) throw memberError;

      const { data: templateRows, error: templatesError } = await supabase
        .from("checklist_templates")
        .select(
          "id, tipo, titulo, marco, prazo_dias_antes, tier, regiao, clima, min_duracao, com_crianca, destino_pack, ordem",
        );
      if (templatesError) throw templatesError;

      const vars = tripVariablesFromInput(input);
      const templates = (templateRows ?? []).map(mapTemplateRow);
      const selecionados = selecionarTemplates(templates, tier, vars);
      const grupos = agruparEmChecklists(selecionados);

      for (const grupo of grupos) {
        const { data: checklist, error: checklistError } = await supabase
          .from("checklists")
          .insert({
            trip_id: tripId,
            tipo: grupo.tipo,
            nome: grupo.nome,
            ordem: CHECKLIST_TIPOS.indexOf(grupo.tipo),
          })
          .select("id")
          .single();
        if (checklistError) throw checklistError;

        if (grupo.itens.length) {
          const { error: itemsError } = await supabase.from("checklist_items").insert(
            grupo.itens.map((item) => ({
              checklist_id: checklist.id,
              titulo: item.titulo,
              marco: item.marco,
              prazo_dias_antes: item.prazoDiasAntes,
              ordem: item.ordem,
            })),
          );
          if (itemsError) throw itemsError;
        }
      }

      if (input.orcamento.length) {
        const { data: categoria, error: categoriaError } = await supabase
          .from("budget_categories")
          .insert({ trip_id: tripId, nome: "Geral", ordem: 0, is_default: true })
          .select("id")
          .single();
        if (categoriaError) throw categoriaError;

        const { error: itemsError } = await supabase.from("budget_items").insert(
          input.orcamento.map((item) => ({
            trip_id: tripId,
            category_id: categoria.id,
            nome: item.nome,
            valor_estimado_brl_cents: item.valorEstimadoBrlCents,
          })),
        );
        if (itemsError) throw itemsError;
      }

      return tripId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trip", "current"] });
    },
  });
}
