import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { capture } from "@/lib/posthog";
import { TRIP_EVENTS } from "@/lib/trip-analytics";

/** Id do usuário logado — usado para marcar "você" e decidir ações na lista de membros. */
export function useCurrentUserId() {
  return useQuery({
    queryKey: ["auth", "current-user-id"],
    queryFn: async (): Promise<string | null> => {
      const { data } = await supabase.auth.getUser();
      return data.user?.id ?? null;
    },
  });
}

export function tripMemberCountQueryKey(tripId: string | undefined) {
  return ["trip", "member-count", tripId] as const;
}

/**
 * Conta os membros atuais da trip — gate de "convidar membro" (VJT-011).
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

export type TripMember = {
  userId: string;
  role: Database["public"]["Enums"]["member_role"];
  joinedAt: string;
};

export function tripMembersQueryKey(tripId: string | undefined) {
  return ["trip", "members", tripId] as const;
}

/** Lista completa de membros da trip (gestão de membros, VJT-013). */
export function useTripMembers(tripId: string | undefined) {
  return useQuery({
    queryKey: tripMembersQueryKey(tripId),
    enabled: !!tripId,
    queryFn: async (): Promise<TripMember[]> => {
      const { data, error } = await supabase
        .from("trip_members")
        .select("user_id, role, joined_at")
        .eq("trip_id", tripId as string)
        .order("joined_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        userId: row.user_id,
        role: row.role,
        joinedAt: row.joined_at,
      }));
    },
  });
}

function invalidateMembers(qc: ReturnType<typeof useQueryClient>, tripId: string) {
  qc.invalidateQueries({ queryKey: tripMembersQueryKey(tripId) });
  qc.invalidateQueries({ queryKey: tripMemberCountQueryKey(tripId) });
}

/** Cria um convite (link mágico, expira em 7 dias via default do schema). */
export function useCreateTripInvite(tripId: string) {
  return useMutation({
    mutationFn: async (): Promise<{ token: string }> => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Sessão expirada. Faça login novamente.");

      const { data, error } = await supabase
        .from("trip_invites")
        .insert({ trip_id: tripId, created_by: userData.user.id })
        .select("token")
        .single();
      if (error) throw error;
      return { token: data.token };
    },
    onSuccess: () => capture(TRIP_EVENTS.inviteSent, { trip_id: tripId }),
  });
}

/** Aceita um convite via RPC (o convidado ainda não é membro, RLS normal não se aplica). */
export function useAcceptTripInvite() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (token: string): Promise<string> => {
      const { data, error } = await supabase.rpc("accept_trip_invite", { p_token: token });
      if (error) throw error;
      return data;
    },
    onSuccess: (tripId) => {
      capture(TRIP_EVENTS.inviteAccepted, { trip_id: tripId });
      qc.invalidateQueries({ queryKey: ["trip", "current"] });
      invalidateMembers(qc, tripId);
    },
  });
}

/** Remove um membro (owner remove qualquer um; qualquer membro remove a si mesmo = sair). */
export function useRemoveTripMember(tripId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string): Promise<void> => {
      const { error } = await supabase
        .from("trip_members")
        .delete()
        .eq("trip_id", tripId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateMembers(qc, tripId);
      // Cobre o caso de auto-remoção (sair da viagem): a trip some de
      // useCurrentTrip() assim que o usuário deixa de ser membro.
      qc.invalidateQueries({ queryKey: ["trip", "current"] });
    },
  });
}
