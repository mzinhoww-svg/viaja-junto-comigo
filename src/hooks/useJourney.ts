import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { StepStatus } from "@/components/viajaly/StepCard";
import type { Database } from "@/integrations/supabase/types";

type RequestRow = Database["public"]["Tables"]["requests"]["Row"];

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

// Safe columns for client/staff portal reads — excludes access_code,
// stripe_session_id, stripe_payment_intent_id, client_signature_ip
// (the view requests_safe also excludes those columns at the DB layer).
const REQUEST_SAFE_COLUMNS =
  "id, agency_id, lead_name, lead_email, lead_phone, combo_pct, proposal_status, contract_signed, sign_name, signed_at, payment_method, payment_status, tax_status, usd_rate, usd_as_of, usd_source, sched_window_open, created_by, created_at, proposal_subtotal_cents, proposal_discount_cents, proposal_total_cents, proposal_sent_at, proposal_accepted_at, proposal_decline_reason, whatsapp_e164, payment_amount_cents, payment_paid_at, payment_confirmed_by, access_code_expires_at, visa_outcome, visa_decision_at, visa_validity_until, archived_at, client_rating, client_feedback, travel_checklist, passport_status, passport_notes, lead_source, lead_message, lead_consent_at, lead_consent_text, assigned_to, payment_installments, payment_card_last4, payment_attempts, combo_discount_cents, manual_discount_cents, visto_plan";

export function useMyRequest() {
  return useQuery({
    queryKey: ["my-request"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests_safe")
        .select(REQUEST_SAFE_COLUMNS)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      // Cast to requests Row shape — sensitive columns (access_code, stripe_*) are
      // intentionally absent at runtime; callers must not depend on them.
      return data as unknown as RequestRow | null;
    },
  });
}

export { REQUEST_SAFE_COLUMNS };

