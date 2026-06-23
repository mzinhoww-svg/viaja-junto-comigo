import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useJourney, useRequestRealtime } from "@/hooks/useJourney";
import { StepCard } from "@/components/viajaly/StepCard";
import { HandoffCard } from "@/components/viajaly/HandoffCard";

// Componentes pesados por aba: code-splitting — carregam só quando a aba abre,
// e os exclusivos do console saem do bundle inicial do app.
const DocumentList = lazy(() => import("@/components/viajaly/DocumentList").then((m) => ({ default: m.DocumentList })));
const DS160Form = lazy(() => import("@/components/viajaly/DS160Form").then((m) => ({ default: m.DS160Form })));
const TaxList = lazy(() => import("@/components/viajaly/TaxList").then((m) => ({ default: m.TaxList })));
const ScheduleList = lazy(() => import("@/components/viajaly/ScheduleList").then((m) => ({ default: m.ScheduleList })));
const AccessAuditCard = lazy(() => import("@/components/viajaly/AccessAuditCard").then((m) => ({ default: m.AccessAuditCard })));
const ConclusionPanel = lazy(() => import("@/components/viajaly/ConclusionPanel").then((m) => ({ default: m.ConclusionPanel })));
const RoteiroCardConsole = lazy(() => import("@/components/viajaly/RoteiroCard").then((m) => ({ default: m.RoteiroCardConsole })));
const MilhasCardConsole = lazy(() => import("@/components/viajaly/MilhasCard").then((m) => ({ default: m.MilhasCardConsole })));
const PassportStatusEditor = lazy(() => import("@/components/viajaly/PassportStatusEditor").then((m) => ({ default: m.PassportStatusEditor })));
const EmergencyContactsEditor = lazy(() => import("@/components/viajaly/EmergencyContactsEditor").then((m) => ({ default: m.EmergencyContactsEditor })));
const BriefingReadOnly = lazy(() => import("@/components/viajaly/BriefingForm").then((m) => ({ default: m.BriefingReadOnly })));
const MessageThread = lazy(() => import("@/components/viajaly/MessageThread").then((m) => ({ default: m.MessageThread })));
const ContractPanel = lazy(() => import("@/components/viajaly/ContractPanel").then((m) => ({ default: m.ContractPanel })));
import { WaQuickActions } from "@/components/viajaly/WaQuickActions";
import { OutcomeBadge, type VisaOutcome } from "@/components/viajaly/OutcomeBadge";
import { StatusPill } from "@/components/viajaly/StatusPill";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/money";
import { ChevronLeft, Pencil, Share2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/console/cliente/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Cliente — Viajaly Console" }] }),
  component: ConsoleClient,
});

type Tab = "jornada" | "pagamentos" | "contrato" | "documentos" | "ds160" | "taxas" | "agenda" | "passaporte" | "roteiro" | "milhas" | "mensagens" | "historico" | "conclusao" | "acesso";

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

  const ds160Review = useQuery({
    queryKey: ["ds160-review", id],
    queryFn: async () => {
      const { data: travelers } = await supabase.from("travelers").select("id").eq("request_id", id);
      const ids = (travelers ?? []).map((t) => t.id);
      if (ids.length === 0) return 0;
      const { count } = await supabase
        .from("ds160_submission")
        .select("traveler_id", { count: "exact", head: true })
        .in("traveler_id", ids)
        .eq("status", "pending_review");
      return count ?? 0;
    },
  });

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
    { key: "pagamentos", label: "Pagamentos" },
    { key: "contrato", label: "Contrato" },
    { key: "documentos", label: "Documentos" },
    { key: "ds160", label: "DS-160" },
    { key: "taxas", label: "Taxas" },
    { key: "agenda", label: "Agenda" },
    { key: "passaporte", label: "Passaporte" },
    { key: "roteiro", label: "Roteiro" },
    { key: "milhas", label: "Milhas" },
    { key: "mensagens", label: "Mensagens" },
    { key: "historico", label: "Histórico" },
    { key: "conclusao", label: "Conclusão" },
    { key: "acesso", label: "Acesso" },
  ];

  return (
    <section>
      <Link to="/console" className="inline-flex items-center gap-1 text-ink-soft text-sm hover:text-coral">
        <ChevronLeft size={16} /> Pipeline
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-3xl font-display font-extrabold text-navy">{req.data.lead_name}</h1>
            <OutcomeBadge outcome={req.data.visa_outcome as VisaOutcome} size="sm" />
            {req.data.archived_at && <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">Arquivado</span>}
            {(ds160Review.data ?? 0) > 0 && (
              <button onClick={() => setTab("ds160")} className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200">
                DS-160 aguardando revisão
              </button>
            )}
          </div>
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

      <WaQuickActions
        phone={req.data.whatsapp_e164 ?? req.data.lead_phone ?? ""}
        clientName={req.data.lead_name}
      />




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

      <Suspense fallback={<p className="mt-6 text-sm text-ink-muted">Carregando…</p>}>
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

      {tab === "pagamentos" && (
        <div className="mt-6 max-w-2xl">
          <PaymentsPanel
            request={req.data}
            pending={flipPayment.isPending}
            onToggle={() => flipPayment.mutate(req.data!.payment_status !== "paid")}
          />
        </div>
      )}

      {tab === "contrato" && (
        <div className="mt-6 max-w-3xl">
          <ContractPanel requestId={id} request={req.data} />
        </div>
      )}

      {tab === "documentos" && (
        <div className="mt-6">
          <DocumentList requestId={id} variant="console" />
        </div>
      )}

      {tab === "ds160" && (
        <div className="mt-6 max-w-3xl">
          <DS160Form requestId={id} variant="console" />
        </div>
      )}

      {tab === "taxas" && (
        <div className="mt-6 max-w-3xl">
          <TaxList requestId={id} variant="console" />
        </div>
      )}

      {tab === "agenda" && (
        <div className="mt-6 max-w-3xl">
          <ScheduleList requestId={id} variant="console" />
        </div>
      )}



      {tab === "passaporte" && (
        <div className="mt-6 max-w-2xl space-y-4">
          <PassportStatusEditor requestId={id} status={req.data.passport_status ?? "coletando"} notes={req.data.passport_notes ?? null} />
          <BriefingReadOnly requestId={id} productKey="passaporte" />
        </div>
      )}

      {tab === "roteiro" && (
        <div className="mt-6 max-w-3xl space-y-4">
          <RoteiroCardConsole requestId={id} />
          <BriefingReadOnly requestId={id} productKey="roteiro" />
        </div>
      )}

      {tab === "milhas" && (
        <div className="mt-6 max-w-3xl space-y-4">
          <MilhasCardConsole requestId={id} />
          <BriefingReadOnly requestId={id} productKey="milhas" />
        </div>
      )}

      {tab === "mensagens" && (
        <div className="mt-6 max-w-3xl">
          <MessageThread requestId={id} isAdmin={true} />
        </div>
      )}

      {tab === "historico" && (
        <div className="mt-6 max-w-3xl">
          <HistoryTimeline requestId={id} />
        </div>
      )}

      {tab === "conclusao" && (
        <div className="mt-6 max-w-3xl space-y-6">
          <ConclusionPanel request={{
            id,
            visa_outcome: req.data.visa_outcome as VisaOutcome,
            visa_decision_at: req.data.visa_decision_at ?? null,
            visa_validity_until: req.data.visa_validity_until ?? null,
            archived_at: req.data.archived_at ?? null,
            client_rating: req.data.client_rating ?? null,
            client_feedback: req.data.client_feedback ?? null,
          }} />
          <EmergencyContactsEditor />
        </div>
      )}

      {tab === "acesso" && (
        <div className="mt-6 max-w-2xl">
          <AccessAuditCard requestId={id} />
        </div>
      )}
      </Suspense>
    </section>
  );
}

function PaymentsPanel({
  request,
  pending,
  onToggle,
}: {
  request: { payment_status: string; payment_method?: string | null; payment_installments?: number | null; payment_card_last4?: string | null; payment_attempts?: number | null; proposal_total_cents?: number | null };
  pending: boolean;
  onToggle: () => void;
}) {
  const paid = request.payment_status === "paid";
  const method = request.payment_method === "card" ? "Cartão" : request.payment_method === "pix" ? "Pix" : "—";
  return (
    <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-navy">Pagamento da consultoria</h2>
        <StatusPill variant={paid ? "done" : request.payment_status === "declined" ? "danger" : "warn"}>{request.payment_status}</StatusPill>
      </div>
      <dl className="grid grid-cols-2 gap-y-3 text-sm">
        <dt className="text-ink-soft">Valor</dt><dd className="text-navy font-semibold font-mono">{formatBRL(request.proposal_total_cents ?? 0)}</dd>
        <dt className="text-ink-soft">Método</dt><dd className="text-ink">{method}</dd>
        {request.payment_installments ? (<><dt className="text-ink-soft">Parcelas</dt><dd className="text-ink">{request.payment_installments}x</dd></>) : null}
        {request.payment_card_last4 ? (<><dt className="text-ink-soft">Final do cartão</dt><dd className="text-ink font-mono">•••• {request.payment_card_last4}</dd></>) : null}
        <dt className="text-ink-soft">Tentativas</dt><dd className="text-ink">{request.payment_attempts ?? 0}</dd>
      </dl>
      <Button size="sm" variant="outline" disabled={pending} onClick={onToggle}>
        {paid ? "Reverter pagamento" : "Marcar como pago"}
      </Button>
    </div>
  );
}

function HistoryTimeline({ requestId }: { requestId: string }) {
  const q = useQuery({
    queryKey: ["history", requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, kind, title, body, created_at, audience")
        .eq("request_id", requestId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
  if (q.isLoading) return <p className="text-ink-muted text-sm">Carregando histórico…</p>;
  if (!q.data || q.data.length === 0) return <p className="text-ink-muted text-sm">Sem eventos registrados ainda.</p>;
  return (
    <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5">
      <h2 className="font-display font-bold text-navy mb-4">Histórico do caso</h2>
      <ol className="relative border-l border-[var(--color-border)] ml-2 space-y-4">
        {q.data.map((n) => (
          <li key={n.id} className="ml-4">
            <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full bg-coral" />
            <p className="text-sm font-semibold text-navy">{n.title}</p>
            {n.body && <p className="text-xs text-ink-soft">{n.body}</p>}
            <p className="text-[11px] text-ink-muted mt-0.5">{new Date(n.created_at).toLocaleString("pt-BR")} · {n.audience}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
