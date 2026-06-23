import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OutcomeBadge, type VisaOutcome } from "@/components/viajaly/OutcomeBadge";
import { Star } from "lucide-react";

export const Route = createFileRoute("/console/relatorio")({
  ssr: false,
  head: () => ({ meta: [{ title: "Relatório — Viajaly Console" }] }),
  component: Relatorio,
});

function Relatorio() {
  const q = useQuery({
    queryKey: ["relatorio"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("id, lead_name, visa_outcome, visa_decision_at, archived_at, client_rating, client_feedback, created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const list = q.data ?? [];
  const ativos = list.filter((r) => !r.visa_outcome && !r.archived_at).length;
  const byOutcome: Record<string, number> = {};
  list.forEach((r) => { if (r.visa_outcome) byOutcome[r.visa_outcome] = (byOutcome[r.visa_outcome] ?? 0) + 1; });
  const arquivados = list.filter((r) => r.archived_at).length;

  const ratings = list.map((r) => r.client_rating).filter((x): x is number => !!x);
  const nps = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "—";

  const decididos = list.filter((r) => r.visa_decision_at);
  const tempoMedio = decididos.length
    ? Math.round(decididos.reduce((acc, r) => acc + (new Date(r.visa_decision_at!).getTime() - new Date(r.created_at).getTime()), 0) / decididos.length / (1000 * 60 * 60 * 24))
    : null;

  const feedbacks = list.filter((r) => r.client_feedback).sort((a, b) =>
    new Date(b.visa_decision_at ?? b.created_at).getTime() - new Date(a.visa_decision_at ?? a.created_at).getTime()
  ).slice(0, 10);

  return (
    <section>
      <h1 className="text-3xl font-display font-extrabold text-navy mb-1">Relatório</h1>
      <p className="text-sm text-ink-soft mb-6">Visão agregada dos casos da agência.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Ativos" value={ativos} />
        <Stat label="Aprovados" value={byOutcome.aprovado ?? 0} />
        <Stat label="Recusados" value={byOutcome.recusado ?? 0} />
        <Stat label="Em análise" value={byOutcome.admin_processing ?? 0} />
        <Stat label="Cancelados" value={byOutcome.cancelado ?? 0} />
        <Stat label="Arquivados" value={arquivados} />
        <Stat label="Tempo médio (dias)" value={tempoMedio ?? "—"} />
        <Stat label="NPS médio" value={nps} />
      </div>

      <h2 className="mt-10 mb-3 text-sm font-display font-bold text-navy uppercase tracking-wider">Últimos feedbacks</h2>
      <div className="space-y-2">
        {feedbacks.length === 0 && <p className="text-sm text-ink-soft">Nenhum feedback ainda.</p>}
        {feedbacks.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl border border-[var(--color-border)] p-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="font-semibold text-navy">{r.lead_name}</p>
              <div className="flex items-center gap-2">
                <OutcomeBadge outcome={r.visa_outcome as VisaOutcome} size="sm" />
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={14} className={i < (r.client_rating ?? 0) ? "fill-coral text-coral" : "text-ink-muted"} />
                  ))}
                </div>
              </div>
            </div>
            {r.client_feedback && <p className="mt-2 text-sm text-ink whitespace-pre-line">{r.client_feedback}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-2xl border border-[var(--color-border)] p-4">
      <p className="text-xs uppercase tracking-wider text-ink-soft font-bold">{label}</p>
      <p className="mt-1 text-2xl font-display font-extrabold text-navy">{value}</p>
    </div>
  );
}
