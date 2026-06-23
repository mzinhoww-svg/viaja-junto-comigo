import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { renderContract } from "@/lib/contract-template";
import { CheckCircle2 } from "lucide-react";

// Visão read-only do contrato no console (admin). Mostra o snapshot imutável já
// assinado (contracts.body_html) ou um preview gerado por renderContract.
export function ContractPanel({
  requestId,
  request,
}: {
  requestId: string;
  request: {
    agency_id: string;
    lead_name: string;
    lead_email: string;
    proposal_total_cents: number;
    contract_signed: boolean | null;
    sign_name: string | null;
    signed_at: string | null;
  };
}) {
  const items = useQuery({
    queryKey: ["contract-items-console", requestId],
    queryFn: async () => {
      const { data, error } = await supabase.from("proposal_items").select("*").eq("request_id", requestId).order("sort");
      if (error) throw error;
      return data;
    },
  });
  const ctx = useQuery({
    queryKey: ["contract-ctx-console", requestId],
    queryFn: async () => {
      const [a, t] = await Promise.all([
        supabase.from("agencies").select("name").eq("id", request.agency_id).maybeSingle(),
        supabase.from("travelers").select("name, is_lead").eq("request_id", requestId),
      ]);
      return {
        agencyName: a.data?.name ?? "Viajaly",
        travelers: (t.data ?? []).map((x) => ({ name: x.name, relation: x.is_lead ? "titular" : null })),
      };
    },
  });
  const existing = useQuery({
    queryKey: ["contract-console", requestId],
    queryFn: async () => {
      const { data } = await supabase.from("contracts").select("*").eq("request_id", requestId).maybeSingle();
      return data;
    },
  });

  const bodyHtml = useMemo(() => {
    if (existing.data?.body_html) return existing.data.body_html as string;
    if (!items.data || !ctx.data) return "";
    return renderContract({
      agencyName: ctx.data.agencyName,
      clientName: request.lead_name,
      clientEmail: request.lead_email,
      travelers: ctx.data.travelers,
      items: items.data.map((i) => ({ label: i.label, qty: i.qty, unit_price_cents: i.unit_price_cents, discount_cents: i.discount_cents })),
      totalCents: request.proposal_total_cents,
      todayISO: new Date().toISOString(),
    });
  }, [existing.data, items.data, ctx.data, request]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-display font-bold text-navy">Contrato</h2>
        {request.contract_signed ? (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-vgreen/15 text-vgreen inline-flex items-center gap-1">
            <CheckCircle2 size={14} /> Assinado
          </span>
        ) : (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[var(--color-muted)] text-ink-soft">Não assinado</span>
        )}
      </div>
      {request.contract_signed && (
        <p className="text-sm text-ink-soft">
          Assinado por <b>{request.sign_name}</b>
          {request.signed_at && <> em {new Date(request.signed_at).toLocaleString("pt-BR")}</>}.
        </p>
      )}
      {bodyHtml ? (
        <article
          className="rounded-2xl bg-white border border-[var(--color-border)] p-5 text-sm text-ink leading-relaxed prose-contract"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      ) : (
        <p className="text-sm text-ink-muted">Sem itens para gerar o contrato ainda.</p>
      )}
      <style>{`
        .prose-contract h2 { font-family: var(--font-display); font-size: 1.05rem; font-weight: 800; color: var(--color-navy); margin-bottom: .75rem; }
        .prose-contract h3 { font-weight: 700; color: var(--color-navy); margin-top: 1rem; margin-bottom: .25rem; font-size: .95rem; }
        .prose-contract p { margin-bottom: .5rem; }
        .prose-contract ul { margin: .25rem 0 .5rem 1.25rem; list-style: disc; }
        .prose-contract .muted { color: var(--color-ink-muted); }
      `}</style>
    </div>
  );
}
