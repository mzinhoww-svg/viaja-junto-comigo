import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mesAnoAtual } from "@/lib/trip-savings";

export function aiUsageQueryKey(mesAno: string) {
  return ["ai-usage", mesAno] as const;
}

/**
 * Mensagens já usadas pelo usuário no mês corrente (`ai_usage`, já existente
 * desde o VJT-001) — gate de "esgotar cota de IA" (VJT-011). O assistente em
 * si (enviar mensagem, contexto da trip) é escopo do VJT-014, ainda não
 * implementado — ver mock aceito no ticket. Reaproveita `mesAnoAtual` de
 * `trip-savings.ts` em vez de recalcular o mês corrente ad hoc.
 */
export function useAiUsage() {
  const mesAno = mesAnoAtual();
  return useQuery({
    queryKey: aiUsageQueryKey(mesAno),
    queryFn: async (): Promise<number> => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const userId = userData.user?.id;
      if (!userId) return 0;

      const { data, error } = await supabase
        .from("ai_usage")
        .select("msgs_count")
        .eq("user_id", userId)
        .eq("mes_ano", mesAno)
        .maybeSingle();
      if (error) throw error;
      return data?.msgs_count ?? 0;
    },
  });
}
