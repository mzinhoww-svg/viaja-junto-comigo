import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PhoneFrame } from "@/components/viajaly/PhoneFrame";
import { Logo } from "@/components/viajaly/Logo";
import { OutcomeBadge, type VisaOutcome } from "@/components/viajaly/OutcomeBadge";
import { LegalDisclaimer } from "@/components/viajaly/LegalDisclaimer";
import { TravelChecklist } from "@/components/viajaly/TravelChecklist";
import { FeedbackForm } from "@/components/viajaly/FeedbackForm";
import { useMyRequest, useRequestRealtime } from "@/hooks/useJourney";
import { ChevronLeft, Phone } from "lucide-react";

export const Route = createFileRoute("/portal/conclusao")({
  ssr: false,
  head: () => ({ meta: [{ title: "Kit de Viagem — Viajaly" }] }),
  component: PortalConclusao,
});

function PortalConclusao() {
  const nav = useNavigate();
  const req = useMyRequest();
  useRequestRealtime(req.data?.id);

  const contacts = useQuery({
    queryKey: ["agency_emergency_public"],
    enabled: !!req.data?.id,
    queryFn: async () => {
      const { data } = await supabase.from("agencies").select("emergency_contacts").maybeSingle();
      return ((data?.emergency_contacts as { items?: Array<{ label: string; value: string }> } | null)?.items ?? []);
    },
  });

  const r = req.data;
  if (!r) return null;

  const outcome = r.visa_outcome as VisaOutcome;
  const checklist = (r.travel_checklist as Record<string, boolean>) ?? {};

  return (
    <PhoneFrame>
      <div className="px-5 pt-8 pb-24 anim-vfade">
        <button onClick={() => nav({ to: "/portal" })} className="inline-flex items-center gap-1 text-ink-soft text-sm hover:text-coral">
          <ChevronLeft size={16} /> Hub
        </button>

        <div className={`mt-4 p-5 rounded-3xl ${outcome === "aprovado" ? "bg-emerald-600 text-white" : outcome === "recusado" ? "bg-rose-600 text-white" : outcome === "admin_processing" ? "bg-amber-500 text-white" : "bg-navy text-cream"}`}>
          <p className="text-xs uppercase tracking-wider opacity-80">Resultado do visto</p>
          <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
            {outcome
              ? <OutcomeBadge outcome={outcome} size="lg" />
              : <h1 className="text-2xl font-display font-extrabold">Aguardando o consulado</h1>}
          </div>
          {r.visa_decision_at && (
            <p className="mt-3 text-sm opacity-90">Decidido em {new Date(r.visa_decision_at).toLocaleDateString("pt-BR")}</p>
          )}
          {outcome === "aprovado" && r.visa_validity_until && (
            <p className="text-sm opacity-90">Validade até {new Date(r.visa_validity_until).toLocaleDateString("pt-BR")}</p>
          )}
        </div>

        {!outcome && (
          <p className="mt-4 text-sm text-ink-soft">
            Assim que a Letícia atualizar o resultado da sua entrevista, seu kit de viagem aparece aqui.
          </p>
        )}

        <div className="mt-4">
          <LegalDisclaimer variant={outcome === "recusado" || outcome === "admin_processing" ? "strong" : "soft"} />
        </div>

        {outcome === "aprovado" && (
          <div className="mt-5 space-y-4">
            <TravelChecklist requestId={r.id} initial={checklist} />
            <FeedbackForm requestId={r.id} initialRating={r.client_rating ?? null} initialFeedback={r.client_feedback ?? null} />
          </div>
        )}

        {(contacts.data ?? []).length > 0 && (
          <div className="mt-5 rounded-2xl bg-white border border-[var(--color-border)] p-5">
            <h3 className="font-display font-bold text-navy">Contatos de emergência</h3>
            <ul className="mt-2 space-y-2">
              {contacts.data!.map((c, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-ink">
                  <Phone size={14} className="text-coral" />
                  <span className="font-semibold">{c.label}:</span> <span>{c.value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="px-5 pb-6 -mt-4">
        <Logo size={20} />
      </div>
    </PhoneFrame>
  );
}
