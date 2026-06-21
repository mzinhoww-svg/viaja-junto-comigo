import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { StepStatus } from "@/components/viajaly/StepCard";

export type JourneyStep = {
  idx: number;
  key: string;
  label: string;
  status: StepStatus;
};

/** Subscribes to all tables tied to a request and invalidates relevant queries. */
export function useRequestRealtime(requestId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!requestId) return;
    const channel = supabase
      .channel(`request:${requestId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "requests", filter: `id=eq.${requestId}` },
        () => { qc.invalidateQueries({ queryKey: ["request", requestId] }); qc.invalidateQueries({ queryKey: ["journey", requestId] }); })
      .on("postgres_changes", { event: "*", schema: "public", table: "documents" },
        () => { qc.invalidateQueries({ queryKey: ["journey", requestId] }); qc.invalidateQueries({ queryKey: ["documents", requestId] }); })
      .on("postgres_changes", { event: "*", schema: "public", table: "schedule_intents" },
        () => qc.invalidateQueries({ queryKey: ["journey", requestId] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "proposal_items", filter: `request_id=eq.${requestId}` },
        () => { qc.invalidateQueries({ queryKey: ["proposal_items", requestId] }); qc.invalidateQueries({ queryKey: ["request", requestId] }); })
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `request_id=eq.${requestId}` },
        () => qc.invalidateQueries({ queryKey: ["notifications", requestId] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [requestId, qc]);
}

export function useJourney(requestId: string | undefined) {
  return useQuery({
    queryKey: ["journey", requestId],
    enabled: !!requestId,
    queryFn: async (): Promise<JourneyStep[]> => {
      const { data, error } = await supabase.rpc("compute_journey_steps", { _request_id: requestId! });
      if (error) throw error;
      return (data ?? []) as JourneyStep[];
    },
  });
}

export function useMyRequest() {
  return useQuery({
    queryKey: ["my-request"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
