import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { notaValida } from "@/lib/trip-nps";

export type TripNpsResponse = {
  nota: number;
  comentario: string | null;
};

export function tripNpsQueryKey(tripId: string | undefined) {
  return ["trip", "nps", tripId] as const;
}

/**
 * Resposta de NPS do usuário logado para esta trip (`null` se ainda não
 * respondeu). RLS `trip_nps_select_own` já restringe ao próprio usuário.
 */
export function useTripNpsResponse(tripId: string | undefined) {
  return useQuery({
    queryKey: tripNpsQueryKey(tripId),
    enabled: !!tripId,
    queryFn: async (): Promise<TripNpsResponse | null> => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const userId = userData.user?.id;
      if (!userId) return null;

      const { data, error } = await supabase
        .from("trip_nps_responses")
        .select("nota, comentario")
        .eq("trip_id", tripId as string)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data ? { nota: data.nota, comentario: data.comentario } : null;
    },
  });
}

export type SubmitTripNpsInput = {
  nota: number;
  comentario: string | null;
};

/**
 * Envia (ou atualiza, se já respondeu) o NPS desta trip — upsert por
 * `(trip_id, user_id)` em vez de duplicar linha ao reenviar.
 */
export function useSubmitTripNps(tripId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ nota, comentario }: SubmitTripNpsInput) => {
      if (!notaValida(nota)) throw new Error("nota_invalida");

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const userId = userData.user?.id;
      if (!userId) throw new Error("nao_autenticado");

      const { error } = await supabase.from("trip_nps_responses").upsert(
        {
          trip_id: tripId,
          user_id: userId,
          nota,
          comentario: comentario?.trim() ? comentario.trim() : null,
        },
        { onConflict: "trip_id,user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: tripNpsQueryKey(tripId) }),
  });
}
