import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useJourney, useRequestRealtime } from "@/hooks/useJourney";
import { StepCard } from "@/components/viajaly/StepCard";
import { DocumentList } from "@/components/viajaly/DocumentList";
import { DS160Form } from "@/components/viajaly/DS160Form";
import { TaxList } from "@/components/viajaly/TaxList";
import { AccessAuditCard } from "@/components/viajaly/AccessAuditCard";
import { HandoffCard } from "@/components/viajaly/HandoffCard";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Pencil, Share2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/console/cliente/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Cliente — Viajaly Console" }] }),
  component: ConsoleClient,
});

type Tab = "jornada" | "documentos" | "ds160" | "taxas" | "acesso";

function ConsoleClient() {
  const { id } = Route.useParams();
  const [tab, setTab] = useState<Tab>("jornada");
  const [showShare, setShowShare] = useState(false);
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

  const tabs: { key: Tab; label: string }[] = [
    { key: "jornada", label: "Jornada" },
    { key: "documentos", label: "Documentos" },
    { key: "ds160", label: "DS-160" },
    { key: "taxas", label: "Taxas" },
    { key: "acesso", label: "Acesso" },
  ];

  return (
    <section>
      <Link to="/console" className="inline-flex items-center gap-1 text-ink-soft text-sm hover:text-coral">
        <ChevronLeft size={16} /> Pipeline
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-navy">{req.data.lead_name}</h1>
          <p className="text-ink-soft text-sm">
            {req.data.lead_email} · código <span className="font-mono">{req.data.access_code}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowShare((v) => !v)}>
            <Share2 size={14} className="mr-1.5" /> {showShare ? "Ocultar acesso" : "Compartilhar acesso"}
          </Button>
          <Link to="/console/orcamento/$id/editar" params={{ id }}>
            <Button size="sm" className="bg-navy hover:bg-[var(--color-navy-light)] text-cream">
              <Pencil size={14} className="mr-1.5" /> Editar orçamento
            </Button>
          </Link>
        </div>
      </div>

      {showShare && (
        <div className="mt-5 max-w-2xl">
          <HandoffCard
            clientName={req.data.lead_name}
            accessCode={req.data.access_code}
            phone={req.data.lead_phone ?? req.data.whatsapp_e164 ?? ""}
            title="Link do cliente"
            subtitle="Envie sempre que precisar — o código já vem preenchido."
          />
        </div>
      )}


      <div className="mt-6 border-b border-[var(--color-border)] flex gap-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${
              tab === t.key
                ? "border-coral text-coral"
                : "border-transparent text-ink-soft hover:text-navy"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "jornada" && (
        <div className="grid md:grid-cols-2 gap-6 mt-6">
          <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5">
            <h2 className="font-display font-bold text-navy mb-4">Etapas</h2>
            <div className="space-y-2">
              {journey.data?.map((s) => <StepCard key={s.key} idx={s.idx} label={s.label} status={s.status} />)}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5 space-y-4">
            <h2 className="font-display font-bold text-navy">Controles rápidos</h2>
            <p className="text-xs text-ink-soft">Atalhos manuais — portal reflete em &lt;2s via realtime.</p>
            <div className="space-y-2">
              <Button size="sm" variant="outline" onClick={() => flipProposal.mutate(req.data!.proposal_status === "accepted" ? "sent" : "accepted")}>
                {req.data.proposal_status === "accepted" ? "Marcar proposta como enviada" : "Aceitar proposta"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => flipSigned.mutate(!req.data!.contract_signed)}>
                {req.data.contract_signed ? "Desassinar contrato" : "Assinar contrato"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => flipPayment.mutate(req.data!.payment_status !== "paid")}>
                {req.data.payment_status === "paid" ? "Reverter pagamento" : "Marcar pago"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {tab === "documentos" && (
        <div className="mt-6">
          <DocumentList requestId={id} variant="console" />
        </div>
      )}

      {tab === "acesso" && (
        <div className="mt-6 max-w-2xl">
          <AccessAuditCard requestId={id} />
        </div>
      )}
    </section>
  );
}
