import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { clonarChecklists, type ChecklistTemplateRow, type PlanTier } from "@/lib/trip-templates";

export type CreateTripInput = {
  destinoPais: string;
  destinoCidade: string | null;
  dataViagem: string | null;
  numPessoas: number;
  comCrianca: boolean;
  orcamentoInicialBrlCents: number | null;
};

async function fetchTier(userId: string): Promise<PlanTier> {
  const { data, error } = await supabase
    .from("entitlements")
    .select("plano")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.plano ?? "free";
}

type ChecklistTemplateBankRow = {
  id: string;
  tipo: ChecklistTemplateRow["tipo"];
  titulo: string;
  ordem: number;
  tier: PlanTier;
  marco: number | null;
  prazo_dias_antes: number | null;
  destino_pack: string | null;
  com_crianca: boolean | null;
  min_duracao: number | null;
};

async function fetchTemplateBank(): Promise<ChecklistTemplateRow[]> {
  const { data, error } = await supabase
    .from("checklist_templates")
    .select(
      "id, tipo, titulo, ordem, tier, marco, prazo_dias_antes, destino_pack, com_crianca, min_duracao",
    )
    .order("ordem");
  if (error) throw error;
  return (data as ChecklistTemplateBankRow[]).map((row) => ({
    id: row.id,
    tipo: row.tipo,
    titulo: row.titulo,
    ordem: row.ordem,
    tier: row.tier,
    marco: row.marco,
    prazoDiasAntes: row.prazo_dias_antes,
    destinoPack: row.destino_pack as ChecklistTemplateRow["destinoPack"],
    comCrianca: row.com_crianca,
    minDuracao: row.min_duracao,
  }));
}

export function useCreateTrip() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTripInput) => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sessão expirada. Faça login novamente.");

      const tier = await fetchTier(userId);

      const { data: trip, error: tripError } = await supabase
        .from("trips")
        .insert({
          owner_id: userId,
          destino_pais: input.destinoPais,
          destino_cidade: input.destinoCidade,
          data_viagem: input.dataViagem,
          num_pessoas: input.numPessoas,
          status: input.dataViagem ? "planejando" : "sonho",
        })
        .select("id")
        .single();
      if (tripError) throw tripError;

      const { error: memberError } = await supabase
        .from("trip_members")
        .insert({ trip_id: trip.id, user_id: userId, role: "owner" });
      if (memberError) throw memberError;

      if (input.orcamentoInicialBrlCents != null && input.orcamentoInicialBrlCents > 0) {
        const { data: categoria, error: categoriaError } = await supabase
          .from("budget_categories")
          .insert({ trip_id: trip.id, nome: "Geral", is_default: true, ordem: 0 })
          .select("id")
          .single();
        if (categoriaError) throw categoriaError;

        const { error: itemError } = await supabase.from("budget_items").insert({
          trip_id: trip.id,
          category_id: categoria.id,
          nome: "Orçamento da viagem",
          valor_estimado_brl_cents: input.orcamentoInicialBrlCents,
        });
        if (itemError) throw itemError;
      }

      const bank = await fetchTemplateBank();
      const checklists = clonarChecklists(bank, {
        tier,
        destinoPais: input.destinoPais,
        destinoCidade: input.destinoCidade,
        numDias: null,
        comCrianca: input.comCrianca,
      });

      for (const checklist of checklists) {
        if (!checklist.itens.length) continue;
        const { data: createdChecklist, error: checklistError } = await supabase
          .from("checklists")
          .insert({
            trip_id: trip.id,
            tipo: checklist.tipo,
            nome: checklist.nome,
            ordem: checklist.ordem,
          })
          .select("id")
          .single();
        if (checklistError) throw checklistError;

        const { error: itemsError } = await supabase.from("checklist_items").insert(
          checklist.itens.map((item) => ({
            checklist_id: createdChecklist.id,
            titulo: item.titulo,
            ordem: item.ordem,
            marco: item.marco,
            prazo_dias_antes: item.prazoDiasAntes,
          })),
        );
        if (itemsError) throw itemsError;
      }

      return { tripId: trip.id };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trip", "current"] });
    },
  });
}
