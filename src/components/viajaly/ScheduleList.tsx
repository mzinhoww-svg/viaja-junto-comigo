import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScheduleIntentCard, type Intent } from "./ScheduleIntentCard";
import { Skeleton } from "@/components/ui/skeleton";
import { SERVICES, type Service, type Consulate } from "@/lib/schedule-shared";

type Traveler = { id: string; name: string; is_lead: boolean; agency_id: string };

export function ScheduleList({ requestId, variant }: { requestId: string; variant: "portal" | "console" }) {
  const q = useQuery({
    queryKey: ["agenda", requestId],
    enabled: !!requestId,
    queryFn: async () => {
      const { data: reqRow, error: rErr } = await supabase
        .from("requests").select("id, agency_id").eq("id", requestId).maybeSingle();
      if (rErr) throw rErr;
      const agency_id = reqRow?.agency_id;

      const { data: travelers, error: tErr } = await supabase
        .from("travelers").select("id, name, is_lead")
        .eq("request_id", requestId)
        .order("is_lead", { ascending: false });
      if (tErr) throw tErr;
      const tids = (travelers ?? []).map((t) => t.id);

      let intents: Intent[] = [];
      if (tids.length) {
        const { data, error } = await supabase
          .from("schedule_intents")
          .select("id, traveler_id, service, status, wish_dates, wish_period, consulate, notes, confirmed_date")
          .in("traveler_id", tids);
        if (error) throw error;
        intents = (data ?? []) as Intent[];
      }

      let slots: Record<string, Record<string, string[]>> = {};
      if (agency_id) {
        const { data: win } = await supabase
          .from("schedule_window").select("slots").eq("agency_id", agency_id).maybeSingle();
        slots = (win?.slots as Record<string, Record<string, string[]>>) ?? {};
      }

      return { travelers: (travelers ?? []) as Omit<Traveler, "agency_id">[], intents, slots };
    },
  });

  // Realtime updates
  useEffect(() => {
    if (!requestId) return;
    const channel = supabase
      .channel(`agenda-${requestId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "schedule_intents" }, () => {
        q.refetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "schedule_window" }, () => {
        q.refetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  if (q.isLoading) return <Skeleton className="h-40 rounded-2xl" />;
  if (!q.data || q.data.travelers.length === 0) return <p className="text-ink-muted text-sm">Sem viajantes.</p>;

  return (
    <div className="space-y-6">
      {q.data.travelers.map((t) => (
        <div key={t.id} className="space-y-3">
          <h3 className="font-display font-bold text-navy">{t.name}</h3>
          {SERVICES.map((svc: Service) => {
            const intent = q.data!.intents.find((i) => i.traveler_id === t.id && i.service === svc);
            if (!intent) return null;
            const consulate = (intent.consulate ?? "SP") as Consulate;
            const available = q.data!.slots?.[svc]?.[consulate] ?? [];
            return (
              <ScheduleIntentCard
                key={intent.id}
                intent={intent}
                travelerName={t.name}
                availableDates={available}
                variant={variant}
                requestId={requestId}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
