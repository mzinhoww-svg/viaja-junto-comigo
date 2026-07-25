import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function ownedTripCountQueryKey() {
  return ["trip", "owned-count"] as const;
}

/** Quantidade de trips que o usuário logado possui (owner) — gate de "criar 2ª viagem" (VJT-011). */
export function useOwnedTripCount() {
  return useQuery({
    queryKey: ownedTripCountQueryKey(),
    queryFn: async (): Promise<number> => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const userId = userData.user?.id;
      if (!userId) return 0;

      const { count, error } = await supabase
        .from("trips")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId);
      if (error) throw error;
      return count ?? 0;
    },
  });
}
