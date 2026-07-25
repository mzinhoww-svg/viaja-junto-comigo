import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function tripMemberCountQueryKey(tripId: string | undefined) {
  return ["trip", "member-count", tripId] as const;
}

/**
 * Conta os membros atuais da trip — gate de "convidar membro" (VJT-011).
 * O fluxo de convite em si (`trip_invites`, RPC `accept_trip_invite`) é
 * escopo do VJT-013, ainda não implementado; este hook só lê `trip_members`
 * (já existente desde o VJT-001) para saber se o limite do plano foi
 * atingido.
 */
export function useTripMemberCount(tripId: string | undefined) {
  return useQuery({
    queryKey: tripMemberCountQueryKey(tripId),
    enabled: !!tripId,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from("trip_members")
        .select("user_id", { count: "exact", head: true })
        .eq("trip_id", tripId as string);
      if (error) throw error;
      return count ?? 0;
    },
  });
}
