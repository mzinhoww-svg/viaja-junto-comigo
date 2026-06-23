import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useJourney, useRequestRealtime } from "@/hooks/useJourney";
import { StepCard } from "@/components/viajaly/StepCard";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/console/cliente/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Cliente — Viajaly Console" }] }),
  component: ConsoleClient,
});

function ConsoleClient() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  useRequestRealtime(id);
  const req = useQuery({
    queryKey: ["request", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("requests").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const journey = useJourney(id);

  const flipProposal = useMutation({
    mutationFn: async (status: "accepted" | "sent") => {
      const { error } = await supabase.from("requests").update({ proposal_status: status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["request", id] }); toast.success("Atualizado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const flipSigned = useMutation({
    mutationFn: async (signed: boolean) => {
      const { error } = await supabase.from("requests").update({ contract_signed: signed, signed_at: signed ? new Date().toISOString() : null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["request", id] }); toast.success("Atualizado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const flipPayment = useMutation({
    mutationFn: async (paid: boolean) => {
      const { error } = await supabase.rpc("confirm_payment", { _request_id: id, _paid: paid });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["request", id] }); toast.success("Pagamento atualizado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!req.data) return <p className="text-ink-muted">Carregando…</p>;

  return (
    <section>
      <Link to="/console" className="inline-flex items-center gap-1 text-ink-soft text-sm hover:text-coral">
        <ChevronLeft size={16} /> Pipeline
      </Link>
      <h1 className="mt-2 text-3xl font-display font-extrabold text-navy">{req.data.lead_name}</h1>
      <p className="text-ink-soft text-sm">{req.data.lead_email} · código <span className="font-mono">{req.data.access_code}</span></p>

      <div className="grid md:grid-cols-2 gap-6 mt-8">
        <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5">
          <h2 className="font-display font-bold text-navy mb-4">Jornada</h2>
          <div className="space-y-2">
            {journey.data?.map((s) => <StepCard key={s.key} idx={s.idx} label={s.label} status={s.status} />)}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5 space-y-4">
          <h2 className="font-display font-bold text-navy">Smoke test do Realtime</h2>
          <p className="text-xs text-ink-soft">
            Use os botões abaixo: o portal do cliente reflete em &lt; 2s sem reload.
          </p>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => flipProposal.mutate(req.data!.proposal_status === "accepted" ? "sent" : "accepted")}>
                {req.data.proposal_status === "accepted" ? "Marcar proposta como enviada" : "Aceitar proposta"}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => flipSigned.mutate(!req.data!.contract_signed)}>
                {req.data.contract_signed ? "Desassinar contrato" : "Assinar contrato"}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => flipPayment.mutate(req.data!.payment_status !== "paid")}>
                {req.data.payment_status === "paid" ? "Reverter pagamento" : "Marcar pago"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
